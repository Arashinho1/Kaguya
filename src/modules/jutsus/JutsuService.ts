import type { Guild, User } from "discord.js";

import {
  Prisma,
  type Character,
  type CharacterJutsu,
  type JutsuDefinition,
  type JutsuType,
  type PrismaClient,
  type RankDefinition
} from "../../generated/prisma/client.js";
import { normalizeKey } from "../../utils/text.js";
import type { CharacterService } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

const JUTSU_INCLUDE = {
  type: true,
  requiredRank: true
} satisfies Prisma.JutsuDefinitionInclude;

const LEARNED_JUTSU_INCLUDE = {
  jutsu: {
    include: JUTSU_INCLUDE
  }
} satisfies Prisma.CharacterJutsuInclude;

export type JutsuWithRelations = Prisma.JutsuDefinitionGetPayload<{
  include: typeof JUTSU_INCLUDE;
}>;

export type LearnedJutsuWithRelations = Prisma.CharacterJutsuGetPayload<{
  include: typeof LEARNED_JUTSU_INCLUDE;
}>;

export interface CreateJutsuInput {
  key: string;
  name: string;
  description?: string | null;
  type?: string | null;
  requiredRank?: string | null;
  chakraCost?: number;
  requirements?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
}

export interface UpdateJutsuInput {
  name?: string;
  description?: string | null;
  type?: string | null;
  requiredRank?: string | null;
  chakraCost?: number;
  isActive?: boolean;
}

export interface JutsuOverview {
  totalCount: number;
  activeCount: number;
  learnedCount: number;
}

export class JutsuRuleError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "JutsuRuleError";
  }
}

export class JutsuService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly characters: CharacterService
  ) {}

  public async getOverview(guild: Guild, user: User): Promise<JutsuOverview> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, user.id);
    const [totalCount, activeCount, learnedCount] = await Promise.all([
      this.prisma.jutsuDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.jutsuDefinition.count({ where: { guildId: rpgGuild.id, isActive: true } }),
      character
        ? this.prisma.characterJutsu.count({
            where: {
              guildId: rpgGuild.id,
              characterId: character.id
            }
          })
        : Promise.resolve(0)
    ]);

    return {
      totalCount,
      activeCount,
      learnedCount
    };
  }

  public async listJutsus(
    guild: Guild,
    options: { includeInactive?: boolean } = {}
  ): Promise<JutsuWithRelations[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.jutsuDefinition.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true })
      },
      include: JUTSU_INCLUDE,
      orderBy: [{ requiredRank: { sortOrder: "asc" } }, { name: "asc" }]
    });
  }

  public async listKnownJutsus(guild: Guild, user: User): Promise<LearnedJutsuWithRelations[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, user.id);

    if (!character) {
      return [];
    }

    return this.prisma.characterJutsu.findMany({
      where: {
        guildId: rpgGuild.id,
        characterId: character.id
      },
      include: LEARNED_JUTSU_INCLUDE,
      orderBy: { learnedAt: "asc" }
    });
  }

  public async createJutsu(
    guild: Guild,
    actorId: string,
    input: CreateJutsuInput
  ): Promise<JutsuWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const key = normalizeJutsuKey(input.key);
    const [type, requiredRank] = await Promise.all([
      this.resolveType(guild, input.type),
      this.resolveRank(guild, input.requiredRank)
    ]);

    await this.assertJutsuKeyAvailable(rpgGuild.id, key);

    const created = await this.prisma.jutsuDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key,
        name: input.name,
        description: input.description,
        typeId: type?.id,
        requiredRankId: requiredRank?.id,
        chakraCost: input.chakraCost ?? 0,
        requirements: input.requirements ?? {},
        metadata: input.metadata ?? {}
      },
      include: JUTSU_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "jutsu.create",
      targetType: "JutsuDefinition",
      targetId: created.id,
      after: serializeJutsu(created)
    });

    return created;
  }

  public async updateJutsu(
    guild: Guild,
    actorId: string,
    identifier: string,
    input: UpdateJutsuInput
  ): Promise<JutsuWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findJutsuByIdentifier(guild, identifier, { includeInactive: true });

    if (!current) {
      return null;
    }

    const [type, requiredRank] = await Promise.all([
      input.type === undefined ? Promise.resolve(undefined) : this.resolveType(guild, input.type),
      input.requiredRank === undefined ? Promise.resolve(undefined) : this.resolveRank(guild, input.requiredRank)
    ]);

    const updated = await this.prisma.jutsuDefinition.update({
      where: { id: current.id },
      data: {
        name: input.name,
        description: input.description,
        typeId: input.type === undefined ? undefined : type?.id ?? null,
        requiredRankId: input.requiredRank === undefined ? undefined : requiredRank?.id ?? null,
        chakraCost: input.chakraCost,
        isActive: input.isActive
      },
      include: JUTSU_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "jutsu.update",
      targetType: "JutsuDefinition",
      targetId: updated.id,
      before: serializeJutsu(current),
      after: serializeJutsu(updated)
    });

    return updated;
  }

  public async updateJutsuRules(
    guild: Guild,
    actorId: string,
    identifier: string,
    input: { requirements?: Prisma.InputJsonObject; metadata?: Prisma.InputJsonObject }
  ): Promise<JutsuWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findJutsuByIdentifier(guild, identifier, { includeInactive: true });

    if (!current) {
      return null;
    }

    const updated = await this.prisma.jutsuDefinition.update({
      where: { id: current.id },
      data: input,
      include: JUTSU_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "jutsu.rules.update",
      targetType: "JutsuDefinition",
      targetId: updated.id,
      before: serializeJutsu(current),
      after: serializeJutsu(updated)
    });

    return updated;
  }

  public async learnJutsu(
    guild: Guild,
    user: User,
    identifier: string
  ): Promise<LearnedJutsuWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, user.id);

    if (!character) {
      throw new JutsuRuleError(["Você precisa ter uma ficha ativa para aprender jutsus."]);
    }

    const jutsu = await this.findJutsuByIdentifier(guild, identifier);

    if (!jutsu) {
      throw new JutsuRuleError(["Não encontrei um jutsu ativo com esse nome ou chave."]);
    }

    const existing = await this.prisma.characterJutsu.findUnique({
      where: {
        characterId_jutsuId: {
          characterId: character.id,
          jutsuId: jutsu.id
        }
      }
    });

    if (existing) {
      throw new JutsuRuleError([`**${character.name}** já aprendeu **${jutsu.name}**.`]);
    }

    const knownJutsus = await this.prisma.characterJutsu.findMany({
      where: {
        guildId: rpgGuild.id,
        characterId: character.id
      },
      include: LEARNED_JUTSU_INCLUDE
    });
    const errors = validateJutsuRequirements(jutsu, character, knownJutsus, this.characters.getAttributeValues(character));

    if (errors.length > 0) {
      throw new JutsuRuleError(errors);
    }

    const learned = await this.prisma.characterJutsu.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        jutsuId: jutsu.id
      },
      include: LEARNED_JUTSU_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: user.id,
      action: "jutsu.learn",
      targetType: "CharacterJutsu",
      targetId: learned.id,
      after: {
        characterId: character.id,
        jutsuId: jutsu.id
      }
    });

    return learned;
  }

  public formatJutsu(jutsu: JutsuWithRelations): string {
    return [
      `**${jutsu.name}** \`${jutsu.key}\``,
      `Tipo: **${jutsu.type?.name ?? "Não definido"}** | Rank: **${jutsu.requiredRank?.name ?? "Livre"}** | Chakra: **${jutsu.chakraCost}**`,
      jutsu.description ?? "Sem descrição."
    ].join("\n");
  }

  private async findJutsuByIdentifier(
    guild: Guild,
    identifier: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<JutsuWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const value = identifier.trim();
    const key = normalizeJutsuKey(value);

    return this.prisma.jutsuDefinition.findFirst({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true }),
        OR: [
          { id: value },
          { key },
          { name: { equals: value, mode: "insensitive" } }
        ]
      },
      include: JUTSU_INCLUDE
    });
  }

  private async resolveType(guild: Guild, input: string | null | undefined): Promise<JutsuType | null> {
    if (input === undefined) {
      return null;
    }

    if (input === null || isClearValue(input)) {
      return null;
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const value = input.trim();
    const key = normalizeJutsuKey(value);
    const type = await this.prisma.jutsuType.findFirst({
      where: {
        guildId: rpgGuild.id,
        isActive: true,
        OR: [
          { id: value },
          { key },
          { name: { equals: value, mode: "insensitive" } }
        ]
      }
    });

    if (!type) {
      throw new JutsuRuleError([`Não encontrei tipo de jutsu ativo chamado \`${input}\`.`]);
    }

    return type;
  }

  private async resolveRank(guild: Guild, input: string | null | undefined): Promise<RankDefinition | null> {
    if (input === undefined) {
      return null;
    }

    if (input === null || isClearValue(input)) {
      return null;
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const value = input.trim();
    const key = normalizeJutsuKey(value);
    const rank = await this.prisma.rankDefinition.findFirst({
      where: {
        guildId: rpgGuild.id,
        isActive: true,
        OR: [
          { id: value },
          { key },
          { name: { equals: value, mode: "insensitive" } }
        ]
      }
    });

    if (!rank) {
      throw new JutsuRuleError([`Não encontrei rank ativo chamado \`${input}\`.`]);
    }

    return rank;
  }

  private async assertJutsuKeyAvailable(guildId: string, key: string): Promise<void> {
    const existing = await this.prisma.jutsuDefinition.findUnique({
      where: {
        guildId_key: {
          guildId,
          key
        }
      }
    });

    if (existing) {
      throw new JutsuRuleError([`Já existe um jutsu com a chave \`${key}\`.`]);
    }
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

function validateJutsuRequirements(
  jutsu: JutsuWithRelations,
  character: Character & { rank?: RankDefinition | null },
  knownJutsus: LearnedJutsuWithRelations[],
  attributes: Record<string, number>
): string[] {
  const requirements = asRecord(jutsu.requirements);
  const errors: string[] = [];

  if (jutsu.requiredRank) {
    const characterRank = character.rank;

    if (!characterRank) {
      errors.push(`**${jutsu.name}** exige rank mínimo **${jutsu.requiredRank.name}**.`);
    } else if (characterRank.sortOrder < jutsu.requiredRank.sortOrder) {
      errors.push(`**${jutsu.name}** exige rank mínimo **${jutsu.requiredRank.name}**.`);
    }
  }

  const attributeRequirements = {
    ...asRecord(requirements.attributes),
    ...asRecord(requirements.atributos),
    ...asRecord(requirements.min_attributes),
    ...asRecord(requirements.atributos_minimos)
  };

  for (const [rawKey, rawValue] of Object.entries(attributeRequirements)) {
    if (typeof rawValue !== "number") {
      continue;
    }

    const key = normalizeJutsuKey(rawKey);

    if ((attributes[key] ?? 0) < rawValue) {
      errors.push(`**${jutsu.name}** exige \`${key}\` >= **${rawValue}**.`);
    }
  }

  const requiredJutsus = getStringList(requirements, [
    "jutsu",
    "jutsus",
    "jutsus_necessarios",
    "required_jutsus",
    "requires"
  ]);

  for (const required of requiredJutsus) {
    const key = normalizeJutsuKey(required);
    const hasJutsu = knownJutsus.some((entry) =>
      entry.jutsu.id === required ||
      entry.jutsu.key === key ||
      entry.jutsu.name.toLowerCase() === required.toLowerCase()
    );

    if (!hasJutsu) {
      errors.push(`**${jutsu.name}** exige conhecer \`${required}\`.`);
    }
  }

  return errors;
}

function serializeJutsu(jutsu: JutsuWithRelations): Prisma.InputJsonObject {
  return {
    id: jutsu.id,
    key: jutsu.key,
    name: jutsu.name,
    description: jutsu.description,
    typeId: jutsu.typeId,
    requiredRankId: jutsu.requiredRankId,
    chakraCost: jutsu.chakraCost,
    requirements: jutsu.requirements as Prisma.InputJsonValue,
    metadata: jutsu.metadata as Prisma.InputJsonValue,
    isActive: jutsu.isActive
  };
}

function normalizeJutsuKey(value: string): string {
  return normalizeKey(value) ?? value.trim().toLowerCase().replace(/\s+/g, "_");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getStringList(record: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = [];

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          values.push(item.trim());
        }
      }
    }
  }

  return [...new Set(values)];
}

function isClearValue(value: string): boolean {
  return ["-", "limpar", "null", "nenhum", "nenhuma"].includes(value.trim().toLowerCase());
}
