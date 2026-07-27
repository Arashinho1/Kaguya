import type { Guild } from "discord.js";

import * as f from "../../core/formula/builders.js";
import { evaluateFormula, safeParseFormula, type FormulaContext, type FormulaNode } from "../../core/formula/index.js";
import { DomainError } from "../../core/errors.js";
import { Prisma, type AttributeDefinition, type PrismaClient } from "../../generated/prisma/client.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

const CHAKRA_FORMULA_KEY = "chakraFormula";

/** Só usada quando o servidor ainda não configurou nenhuma fórmula — totalmente substituível. */
const DEFAULT_CHAKRA_FORMULA: FormulaNode = f.floor(
  f.add(f.variable("forca"), f.variable("velocidade"), f.variable("resistencia"))
);

export class AttributeRuleError extends DomainError {}

export interface CreateAttributeInput {
  key: string;
  name: string;
  description?: string;
  baseValue?: number;
  minValue?: number;
  maxValue?: number | null;
  sortOrder?: number;
}

export interface UpdateAttributeInput {
  name?: string;
  description?: string | null;
  baseValue?: number;
  minValue?: number;
  maxValue?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** Fórmula simplificada de soma-ponderada, usada pelo comando de conveniência `.atributo chakra`. */
export interface WeightedSumChakraInput {
  sourceAttributeKeys: string[];
  sourceMultiplier: number;
  isolatedMultiplier: number;
  directBonus: number;
}

export class AttributeService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService
  ) {}

  public async listAttributes(
    guild: Guild,
    options: { includeInactive?: boolean } = {}
  ): Promise<AttributeDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.attributeDefinition.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true })
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findAttribute(guild: Guild, key: string): Promise<AttributeDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.attributeDefinition.findUnique({
      where: { guildId_key: { guildId: rpgGuild.id, key } }
    });
  }

  public async createAttribute(
    guild: Guild,
    actorId: string,
    input: CreateAttributeInput
  ): Promise<AttributeDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findAttribute(guild, input.key)) {
      throw new AttributeRuleError(`Já existe um atributo com a chave \`${input.key}\`.`);
    }

    const created = await this.prisma.attributeDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key: input.key,
        name: input.name,
        description: input.description,
        baseValue: input.baseValue ?? 0,
        minValue: input.minValue ?? 0,
        maxValue: input.maxValue,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.create",
      targetType: "AttributeDefinition",
      targetId: created.id,
      after: serializeAttribute(created)
    });

    return created;
  }

  public async updateAttribute(
    guild: Guild,
    actorId: string,
    key: string,
    input: UpdateAttributeInput
  ): Promise<AttributeDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findAttribute(guild, key);

    if (!current) {
      return null;
    }

    const updated = await this.prisma.attributeDefinition.update({
      where: { id: current.id },
      data: input
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.update",
      targetType: "AttributeDefinition",
      targetId: updated.id,
      before: serializeAttribute(current),
      after: serializeAttribute(updated)
    });

    return updated;
  }

  public async deleteAttribute(guild: Guild, actorId: string, key: string): Promise<AttributeDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findAttribute(guild, key);

    if (!current) {
      return null;
    }

    await this.prisma.attributeDefinition.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.delete",
      targetType: "AttributeDefinition",
      targetId: current.id,
      before: serializeAttribute(current)
    });

    return current;
  }

  public async getChakraFormula(guild: Guild): Promise<FormulaNode> {
    const raw = await this.guildConfig.getSetting(guild, CHAKRA_FORMULA_KEY);
    return safeParseFormula(raw) ?? DEFAULT_CHAKRA_FORMULA;
  }

  public async setChakraFormula(guild: Guild, actorId: string, formula: FormulaNode): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: CHAKRA_FORMULA_KEY,
      label: "Fórmula de Chakra",
      description: "Fórmula (motor de regras) usada para calcular o Chakra derivado dos atributos base.",
      value: formula as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: true
    });
  }

  /** Constrói e salva a fórmula clássica soma-ponderada via o motor de fórmulas genérico. */
  public async setWeightedSumChakraFormula(
    guild: Guild,
    actorId: string,
    input: WeightedSumChakraInput
  ): Promise<FormulaNode> {
    if (input.sourceAttributeKeys.length === 0) {
      throw new AttributeRuleError("Informe ao menos um atributo de origem para o Chakra.");
    }

    const formula = f.floor(
      f.add(
        f.mul(
          f.add(...input.sourceAttributeKeys.map((key) => f.variable(key))),
          f.constant(input.sourceMultiplier),
          f.constant(input.isolatedMultiplier)
        ),
        f.constant(input.directBonus)
      )
    );

    await this.setChakraFormula(guild, actorId, formula);
    return formula;
  }

  public calculateChakra(context: FormulaContext, formula: FormulaNode): number {
    return Math.max(0, Math.floor(evaluateFormula(formula, context)));
  }

  /** Tabela atual de chakra fixo por rank, se a fórmula em uso for esse formato (lookup em "rank"). */
  public async getChakraRankTable(guild: Guild): Promise<Record<string, number>> {
    const formula = await this.getChakraFormula(guild);
    return formula.op === "lookup" && formula.key === "rank" ? { ...formula.table } : {};
  }

  /**
   * Define/atualiza o valor de chakra de um único rank, preservando os demais já
   * configurados. Se a fórmula atual não for uma lookup por rank, começa uma nova
   * (substitui qualquer fórmula por soma-ponderada configurada antes).
   */
  public async setChakraRankValue(guild: Guild, actorId: string, rankKey: string, value: number): Promise<FormulaNode> {
    const table = await this.getChakraRankTable(guild);
    table[rankKey] = value;

    const formula = f.lookup("rank", table);
    await this.setChakraFormula(guild, actorId, formula);
    return formula;
  }
}

function serializeAttribute(attribute: AttributeDefinition): Prisma.InputJsonObject {
  return {
    id: attribute.id,
    key: attribute.key,
    name: attribute.name,
    description: attribute.description,
    baseValue: attribute.baseValue,
    minValue: attribute.minValue,
    maxValue: attribute.maxValue,
    sortOrder: attribute.sortOrder,
    isActive: attribute.isActive
  };
}
