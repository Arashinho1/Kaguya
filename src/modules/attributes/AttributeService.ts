import type { Guild } from "discord.js";

import { DEFAULT_CHAKRA_FORMULA } from "../../config/defaults.js";
import { Prisma, type AttributeDefinition, type PrismaClient } from "../../generated/prisma/client.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export interface ChakraFormula {
  sourceAttributeKeys: string[];
  sourceMultiplier: number;
  isolatedMultiplier: number;
  directBonus: number;
}

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
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key
        }
      }
    });
  }

  public async createAttribute(
    guild: Guild,
    actorId: string,
    input: CreateAttributeInput
  ): Promise<AttributeDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

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

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.create",
      targetType: "AttributeDefinition",
      targetId: created.id,
      after: this.serializeAttribute(created)
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

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.update",
      targetType: "AttributeDefinition",
      targetId: updated.id,
      before: this.serializeAttribute(current),
      after: this.serializeAttribute(updated)
    });

    return updated;
  }

  public async setAttributeActive(
    guild: Guild,
    actorId: string,
    key: string,
    isActive: boolean
  ): Promise<AttributeDefinition | null> {
    return this.updateAttribute(guild, actorId, key, { isActive });
  }

  public async deleteAttribute(
    guild: Guild,
    actorId: string,
    key: string
  ): Promise<AttributeDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findAttribute(guild, key);

    if (!current) {
      return null;
    }

    await this.prisma.attributeDefinition.delete({
      where: { id: current.id }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.delete",
      targetType: "AttributeDefinition",
      targetId: current.id,
      before: this.serializeAttribute(current)
    });

    return current;
  }

  public async getChakraFormula(guild: Guild): Promise<ChakraFormula> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "chakraFormula"
        }
      }
    });

    return normalizeChakraFormula(setting?.value);
  }

  public async setChakraFormula(
    guild: Guild,
    actorId: string,
    formula: ChakraFormula
  ): Promise<ChakraFormula> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "chakraFormula"
        }
      }
    });

    const normalized = normalizeChakraFormula(formula);

    await this.prisma.guildSetting.upsert({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "chakraFormula"
        }
      },
      update: {
        label: "Fórmula de Chakra",
        description: "Define como o Chakra derivado é calculado a partir dos atributos base.",
        value: normalized as unknown as Prisma.InputJsonValue,
        valueType: "JSON",
        isPublic: true
      },
      create: {
        guildId: rpgGuild.id,
        key: "chakraFormula",
        label: "Fórmula de Chakra",
        description: "Define como o Chakra derivado é calculado a partir dos atributos base.",
        value: normalized as unknown as Prisma.InputJsonValue,
        valueType: "JSON",
        isPublic: true
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "attribute.chakra_formula.update",
      targetType: "GuildSetting",
      targetId: "chakraFormula",
      before: current ? { value: current.value } : null,
      after: { value: normalized as unknown as Prisma.InputJsonValue }
    });

    return normalized;
  }

  public calculateChakra(
    attributes: Record<string, number>,
    formula: ChakraFormula = createDefaultChakraFormula()
  ): number {
    const sourceTotal = formula.sourceAttributeKeys.reduce(
      (total, key) => total + (attributes[key] ?? 0),
      0
    );
    const rawChakra =
      sourceTotal * formula.sourceMultiplier * formula.isolatedMultiplier + formula.directBonus;

    return Math.max(0, Math.floor(rawChakra));
  }

  private serializeAttribute(attribute: AttributeDefinition): Prisma.InputJsonObject {
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

  private async writeAuditLog(input: {
    guildId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        guildId: input.guildId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before === null ? Prisma.JsonNull : input.before,
        after: input.after === null ? Prisma.JsonNull : input.after
      }
    });
  }
}

export function formatChakraFormula(formula: ChakraFormula): string {
  const source = formula.sourceAttributeKeys.join(" + ");
  return `floor((${source}) * ${formula.sourceMultiplier} * ${formula.isolatedMultiplier} + ${formula.directBonus})`;
}

function normalizeChakraFormula(value: unknown): ChakraFormula {
  const fallback = createDefaultChakraFormula();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const sourceAttributeKeys = Array.isArray(record.sourceAttributeKeys)
    ? record.sourceAttributeKeys.filter((key): key is string => typeof key === "string")
    : fallback.sourceAttributeKeys;

  return {
    sourceAttributeKeys:
      sourceAttributeKeys.length > 0 ? sourceAttributeKeys : fallback.sourceAttributeKeys,
    sourceMultiplier:
      typeof record.sourceMultiplier === "number" ? record.sourceMultiplier : fallback.sourceMultiplier,
    isolatedMultiplier:
      typeof record.isolatedMultiplier === "number"
        ? record.isolatedMultiplier
        : fallback.isolatedMultiplier,
    directBonus: typeof record.directBonus === "number" ? record.directBonus : fallback.directBonus
  };
}

function createDefaultChakraFormula(): ChakraFormula {
  return {
    sourceAttributeKeys: [...DEFAULT_CHAKRA_FORMULA.sourceAttributeKeys],
    sourceMultiplier: DEFAULT_CHAKRA_FORMULA.sourceMultiplier,
    isolatedMultiplier: DEFAULT_CHAKRA_FORMULA.isolatedMultiplier,
    directBonus: DEFAULT_CHAKRA_FORMULA.directBonus
  };
}
