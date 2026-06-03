import type { Guild } from "discord.js";

import { DEFAULT_TRAINING_CONFIG } from "../../config/defaults.js";
import {
  Prisma,
  type AttributeDefinition,
  type CharacterProgress,
  type PrismaClient,
  type TrainingLog
} from "../../generated/prisma/client.js";
import { normalizeKey } from "../../utils/text.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { CharacterService, CharacterWithRelations } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export interface TrainingConfig {
  baseCost: number;
  costPerCurrentValue: number;
  maxIncreasePerAction: number;
}

export interface TrainingOverview {
  character: CharacterWithRelations | null;
  progress: CharacterProgress | null;
  baseAttributes: Record<string, number>;
  effectiveAttributes: Record<string, number>;
  config: TrainingConfig;
}

export interface TrainingGrantResult {
  character: CharacterWithRelations;
  progress: CharacterProgress;
  log: TrainingLog;
}

export interface TrainingResult {
  character: CharacterWithRelations;
  progress: CharacterProgress;
  log: TrainingLog;
  attribute: AttributeDefinition;
  beforeValue: number;
  afterValue: number;
  cost: number;
}

export class TrainingRuleError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "TrainingRuleError";
  }
}

export class TrainingService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly attributes: AttributeService,
    private readonly characters: CharacterService
  ) {}

  public async getOverview(guild: Guild, userId: string): Promise<TrainingOverview> {
    const config = await this.getTrainingConfig(guild);
    const character = await this.characters.findActiveByUser(guild, userId);

    if (!character) {
      return {
        character: null,
        progress: null,
        baseAttributes: {},
        effectiveAttributes: {},
        config
      };
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const progress = await this.ensureProgress(rpgGuild.id, character.id);

    return {
      character,
      progress,
      baseAttributes: this.characters.getBaseAttributeValues(character),
      effectiveAttributes: this.characters.getAttributeValues(character),
      config
    };
  }

  public async getTrainingConfig(guild: Guild): Promise<TrainingConfig> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "trainingConfig"
        }
      }
    });

    return normalizeTrainingConfig(setting?.value);
  }

  public async setTrainingConfig(
    guild: Guild,
    actorId: string,
    input: Partial<TrainingConfig>
  ): Promise<TrainingConfig> {
    const current = await this.getTrainingConfig(guild);
    const next = normalizeTrainingConfig({
      ...current,
      ...input
    });

    await this.guildConfig.setSetting(guild, actorId, {
      key: "trainingConfig",
      label: "Configuração de treino",
      description: "Define custo e limite de evolução de atributos pelo painel de treino.",
      value: next as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: false
    });

    return next;
  }

  public async grantTrainingPoints(
    guild: Guild,
    actorId: string,
    targetUserId: string,
    amount: number,
    reason?: string
  ): Promise<TrainingGrantResult> {
    const normalizedAmount = Math.trunc(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount === 0) {
      throw new TrainingRuleError(["Informe uma quantidade inteira diferente de zero."]);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, targetUserId);

    if (!character) {
      throw new TrainingRuleError(["Esse usuário precisa ter uma ficha ativa para receber pontos de treino."]);
    }

    const current = await this.ensureProgress(rpgGuild.id, character.id);
    const nextPoints = current.trainingPoints + normalizedAmount;

    if (nextPoints < 0) {
      throw new TrainingRuleError([
        `A ficha **${character.name}** tem apenas **${current.trainingPoints}** ponto(s) de treino.`
      ]);
    }

    const progress = await this.prisma.characterProgress.update({
      where: { id: current.id },
      data: { trainingPoints: nextPoints }
    });
    const log = await this.prisma.trainingLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        actorId,
        action: "training.points.grant",
        amount: normalizedAmount,
        before: { trainingPoints: current.trainingPoints },
        after: { trainingPoints: progress.trainingPoints },
        reason
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "training.points.grant",
      targetType: "CharacterProgress",
      targetId: progress.id,
      before: { trainingPoints: current.trainingPoints },
      after: {
        characterId: character.id,
        targetUserId,
        amount: normalizedAmount,
        trainingPoints: progress.trainingPoints
      },
      reason
    });

    return {
      character,
      progress,
      log
    };
  }

  public async trainAttribute(
    guild: Guild,
    userId: string,
    attributeInput: string,
    amount: number
  ): Promise<TrainingResult> {
    const key = normalizeKey(attributeInput) ?? attributeInput.trim().toLowerCase();
    const normalizedAmount = Math.trunc(amount);

    if (!key) {
      throw new TrainingRuleError(["Informe a chave do atributo que será treinado."]);
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new TrainingRuleError(["A evolução precisa ser um número inteiro positivo."]);
    }

    if (key === "chakra") {
      throw new TrainingRuleError(["Chakra é derivado pela fórmula do servidor e não pode ser treinado diretamente."]);
    }

    const [config, attribute, rpgGuild] = await Promise.all([
      this.getTrainingConfig(guild),
      this.attributes.findAttribute(guild, key),
      this.guildConfig.ensureGuild(guild)
    ]);

    if (normalizedAmount > config.maxIncreasePerAction) {
      throw new TrainingRuleError([
        `Você pode evoluir no máximo **${config.maxIncreasePerAction}** ponto(s) por ação.`
      ]);
    }

    if (!attribute || !attribute.isActive) {
      throw new TrainingRuleError([`Não encontrei um atributo ativo com a chave \`${key}\`.`]);
    }

    const character = await this.characters.findActiveByUser(guild, userId);

    if (!character) {
      throw new TrainingRuleError(["Você precisa ter uma ficha ativa para treinar atributos."]);
    }

    const baseAttributes = this.characters.getBaseAttributeValues(character);
    const beforeValue = baseAttributes[key] ?? attribute.baseValue;
    const afterValue = beforeValue + normalizedAmount;

    if (attribute.maxValue !== null && afterValue > attribute.maxValue) {
      throw new TrainingRuleError([
        `**${attribute.name}** tem limite máximo **${attribute.maxValue}**. Treino solicitado chegaria em **${afterValue}**.`
      ]);
    }

    const cost = calculateTrainingCost(beforeValue, normalizedAmount, config);
    const currentProgress = await this.ensureProgress(rpgGuild.id, character.id);

    if (currentProgress.trainingPoints < cost) {
      throw new TrainingRuleError([
        `Você precisa de **${cost}** ponto(s) de treino, mas tem **${currentProgress.trainingPoints}**.`
      ]);
    }

    const adjustment = await this.characters.adjustActiveCharacterBaseAttributes(
      guild,
      userId,
      userId,
      { [key]: normalizedAmount },
      {
        action: "training.attribute.train",
        reason: `Treino de ${attribute.name}`
      }
    );

    if (!adjustment) {
      throw new TrainingRuleError(["Você precisa ter uma ficha ativa para treinar atributos."]);
    }

    const progress = await this.prisma.characterProgress.update({
      where: { id: currentProgress.id },
      data: { trainingPoints: currentProgress.trainingPoints - cost }
    });
    const log = await this.prisma.trainingLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        actorId: userId,
        action: "training.attribute.train",
        attributeKey: key,
        amount: normalizedAmount,
        cost,
        before: {
          baseAttributes: adjustment.beforeBaseAttributes,
          trainingPoints: currentProgress.trainingPoints
        },
        after: {
          baseAttributes: adjustment.afterBaseAttributes,
          trainingPoints: progress.trainingPoints
        }
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: userId,
      action: "training.attribute.train",
      targetType: "Character",
      targetId: adjustment.character.id,
      before: {
        attributeKey: key,
        value: beforeValue,
        trainingPoints: currentProgress.trainingPoints
      },
      after: {
        attributeKey: key,
        value: afterValue,
        trainingPoints: progress.trainingPoints,
        cost
      }
    });

    return {
      character: adjustment.character,
      progress,
      log,
      attribute,
      beforeValue,
      afterValue,
      cost
    };
  }

  private async ensureProgress(guildId: string, characterId: string): Promise<CharacterProgress> {
    return this.prisma.characterProgress.upsert({
      where: { characterId },
      update: {},
      create: {
        guildId,
        characterId
      }
    });
  }

  private async writeAuditLog(input: {
    guildId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    reason?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        guildId: input.guildId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before === null ? Prisma.JsonNull : input.before,
        after: input.after === null ? Prisma.JsonNull : input.after,
        reason: input.reason
      }
    });
  }
}

export function calculateTrainingCost(
  currentValue: number,
  amount: number,
  config: TrainingConfig
): number {
  let total = 0;

  for (let step = 0; step < amount; step += 1) {
    total += config.baseCost + (currentValue + step) * config.costPerCurrentValue;
  }

  return Math.max(1, Math.ceil(total));
}

export function formatTrainingConfig(config: TrainingConfig): string {
  return [
    `Custo base: **${config.baseCost}**`,
    `Custo por valor atual: **${config.costPerCurrentValue}**`,
    `Máximo por treino: **${config.maxIncreasePerAction}**`
  ].join("\n");
}

function normalizeTrainingConfig(value: unknown): TrainingConfig {
  const record = asRecord(value);
  const baseCost = normalizeNumber(record.baseCost, DEFAULT_TRAINING_CONFIG.baseCost, 0);
  const costPerCurrentValue = normalizeNumber(
    record.costPerCurrentValue,
    DEFAULT_TRAINING_CONFIG.costPerCurrentValue,
    0
  );
  const maxIncreasePerAction = Math.max(
    1,
    Math.trunc(normalizeNumber(record.maxIncreasePerAction, DEFAULT_TRAINING_CONFIG.maxIncreasePerAction, 1))
  );

  return {
    baseCost,
    costPerCurrentValue,
    maxIncreasePerAction
  };
}

function normalizeNumber(value: unknown, fallback: number, min: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
