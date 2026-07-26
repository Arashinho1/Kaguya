import type { Guild } from "discord.js";

import * as f from "../../core/formula/builders.js";
import { DomainError } from "../../core/errors.js";
import { evaluateFormula, safeParseFormula, type FormulaNode } from "../../core/formula/index.js";
import { Prisma, type CharacterProgress, type PrismaClient } from "../../generated/prisma/client.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { CharacterService, CharacterWithWorld } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export class TrainingRuleError extends DomainError {}

const TRAINING_COST_FORMULA_KEY = "trainingCostFormula";
const TRAINING_MAX_INCREASE_KEY = "trainingMaxIncreasePerAction";
const DEFAULT_MAX_INCREASE = 5;

/** Só usada quando o servidor ainda não configurou nenhum custo — totalmente substituível. */
const DEFAULT_TRAINING_COST_FORMULA: FormulaNode = f.constant(1);

export interface TrainResult {
  character: CharacterWithWorld;
  attributeKey: string;
  newValue: number;
  cost: number;
  remainingPoints: number;
}

export class TrainingService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly attributes: AttributeService,
    private readonly characters: CharacterService
  ) {}

  public async getOrCreateProgress(guild: Guild, character: CharacterWithWorld): Promise<CharacterProgress> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.characterProgress.upsert({
      where: { characterId: character.id },
      update: {},
      create: { guildId: rpgGuild.id, characterId: character.id }
    });
  }

  public async getTrainingCostFormula(guild: Guild): Promise<FormulaNode> {
    const raw = await this.guildConfig.getSetting(guild, TRAINING_COST_FORMULA_KEY);
    return safeParseFormula(raw) ?? DEFAULT_TRAINING_COST_FORMULA;
  }

  public async setLinearTrainingCost(
    guild: Guild,
    actorId: string,
    input: { baseCost: number; costPerCurrentValue: number }
  ): Promise<FormulaNode> {
    const formula = f.add(
      f.constant(input.baseCost),
      f.mul(f.variable("atual"), f.constant(input.costPerCurrentValue))
    );

    await this.guildConfig.setSetting(guild, actorId, {
      key: TRAINING_COST_FORMULA_KEY,
      label: "Custo de treino",
      description: "Fórmula (motor de regras) do custo em pontos de treino para evoluir +1 num atributo.",
      value: formula as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: true
    });

    return formula;
  }

  public async getMaxIncreasePerAction(guild: Guild): Promise<number> {
    const raw = await this.guildConfig.getSetting(guild, TRAINING_MAX_INCREASE_KEY);
    return typeof raw === "number" && raw > 0 ? raw : DEFAULT_MAX_INCREASE;
  }

  public async setMaxIncreasePerAction(guild: Guild, actorId: string, value: number): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: TRAINING_MAX_INCREASE_KEY,
      label: "Limite de evolução por ação",
      description: "Quantos pontos um atributo pode subir numa única ação de treino.",
      value,
      valueType: "NUMBER",
      isPublic: false
    });
  }

  public calculateTrainingCost(formula: FormulaNode, currentValue: number, amount: number): number {
    let total = 0;
    for (let i = 0; i < amount; i += 1) {
      const stepCost = evaluateFormula(formula, { atual: currentValue + i });
      total += Math.max(1, Math.round(stepCost));
    }
    return total;
  }

  public async trainAttribute(
    guild: Guild,
    character: CharacterWithWorld,
    attributeKey: string,
    amount: number
  ): Promise<TrainResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new TrainingRuleError("A quantidade de treino precisa ser um número inteiro positivo.");
    }

    const maxIncrease = await this.getMaxIncreasePerAction(guild);
    if (amount > maxIncrease) {
      throw new TrainingRuleError(`Você só pode evoluir até ${maxIncrease} pontos por ação de treino.`);
    }

    const attribute = await this.attributes.findAttribute(guild, attributeKey);
    if (!attribute || !attribute.isActive) {
      throw new TrainingRuleError(`Não encontrei o atributo \`${attributeKey}\` (ou ele está desativado).`);
    }

    // Relê o personagem do banco: evita gravar sobre um snapshot desatualizado se `character`
    // (passado pelo chamador) não refletir a ação de treino mais recente.
    const freshCharacter = await this.characters.getById(character.id);
    if (!freshCharacter) {
      throw new TrainingRuleError("Essa ficha não existe mais.");
    }

    const currentValue =
      this.characters.getBaseAttributeSnapshot(freshCharacter)[attributeKey] ?? attribute.baseValue;
    const newValue = currentValue + amount;

    if (attribute.maxValue !== null && newValue > attribute.maxValue) {
      throw new TrainingRuleError(
        `**${attribute.name}** não pode passar de ${attribute.maxValue} (atual: ${currentValue}).`
      );
    }

    const formula = await this.getTrainingCostFormula(guild);
    const cost = this.calculateTrainingCost(formula, currentValue, amount);

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const progress = await this.getOrCreateProgress(guild, freshCharacter);

    if (progress.trainingPoints < cost) {
      throw new TrainingRuleError(
        `Você tem ${progress.trainingPoints} ponto(s) de treino, mas evoluir **${attribute.name}** em ${amount} custa ${cost}.`
      );
    }

    const updatedCharacter = await this.characters.updateAttributeSnapshot(freshCharacter, attributeKey, newValue);

    const updatedProgress = await this.prisma.characterProgress.update({
      where: { id: progress.id },
      data: { trainingPoints: progress.trainingPoints - cost }
    });

    await this.prisma.trainingLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        actorId: character.userId,
        action: "train",
        attributeKey,
        amount,
        cost,
        before: { value: currentValue },
        after: { value: newValue }
      }
    });

    return {
      character: updatedCharacter,
      attributeKey,
      newValue,
      cost,
      remainingPoints: updatedProgress.trainingPoints
    };
  }

  public async grantPoints(
    guild: Guild,
    actorId: string,
    character: CharacterWithWorld,
    delta: number,
    reason?: string
  ): Promise<CharacterProgress> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const progress = await this.getOrCreateProgress(guild, character);
    const nextPoints = Math.max(0, progress.trainingPoints + delta);

    const updated = await this.prisma.characterProgress.update({
      where: { id: progress.id },
      data: { trainingPoints: nextPoints }
    });

    await this.prisma.trainingLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        actorId,
        action: "grant",
        amount: delta,
        before: { trainingPoints: progress.trainingPoints },
        after: { trainingPoints: nextPoints },
        reason
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "training.points.grant",
      targetType: "CharacterProgress",
      targetId: progress.id,
      before: { trainingPoints: progress.trainingPoints },
      after: { trainingPoints: nextPoints },
      reason
    });

    return updated;
  }
}
