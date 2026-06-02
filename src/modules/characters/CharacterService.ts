import type { Guild, User } from "discord.js";

import { Prisma, type Character, type PrismaClient } from "../../generated/prisma/client.js";
import { normalizeKey } from "../../utils/text.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

const CHARACTER_INCLUDE = {
  clan: true,
  village: true,
  rank: true
} satisfies Prisma.CharacterInclude;

export type CharacterWithRelations = Prisma.CharacterGetPayload<{
  include: typeof CHARACTER_INCLUDE;
}>;

export interface CreateCharacterInput {
  name: string;
  concept?: string;
  imageUrl?: string;
  clanId?: string | null;
  villageId?: string | null;
  rankId?: string | null;
}

export interface CharacterMetadata {
  concept?: string;
  imageUrl?: string;
}

export interface UpdateCharacterInput {
  name?: string;
  concept?: string | null;
  imageUrl?: string | null;
  clanId?: string | null;
  villageId?: string | null;
  rankId?: string | null;
}

export interface CharacterLinkInput {
  clan?: string | null;
  village?: string | null;
  rank?: string | null;
}

export interface ResolvedCharacterLinks {
  clanId?: string | null;
  villageId?: string | null;
  rankId?: string | null;
  errors: string[];
}

export class CharacterService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly attributes: AttributeService
  ) {}

  public async findActiveByUser(guild: Guild, userId: string): Promise<CharacterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.character.findFirst({
      where: {
        guildId: rpgGuild.id,
        userId,
        isActive: true
      },
      orderBy: { createdAt: "asc" },
      include: CHARACTER_INCLUDE
    });
  }

  public async findLatestByUser(guild: Guild, userId: string): Promise<CharacterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.character.findFirst({
      where: {
        guildId: rpgGuild.id,
        userId
      },
      orderBy: { updatedAt: "desc" },
      include: CHARACTER_INCLUDE
    });
  }

  public async findDisplayCharacter(guild: Guild, user: User): Promise<CharacterWithRelations | null> {
    return this.findActiveByUser(guild, user.id);
  }

  public async createCharacter(
    guild: Guild,
    user: User,
    input: CreateCharacterInput
  ): Promise<CharacterWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const activeAttributes = await this.attributes.listAttributes(guild);
    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const attributeValues = Object.fromEntries(
      activeAttributes.map((attribute) => [attribute.key, attribute.baseValue])
    ) as Record<string, number>;

    attributeValues.chakra = this.attributes.calculateChakra(attributeValues, chakraFormula);

    const created = await this.prisma.character.create({
      data: {
        guildId: rpgGuild.id,
        userId: user.id,
        name: input.name,
        clanId: input.clanId,
        villageId: input.villageId,
        rankId: input.rankId,
        attributes: attributeValues,
        metadata: {
          concept: input.concept,
          imageUrl: input.imageUrl
        }
      },
      include: CHARACTER_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: user.id,
      action: "character.create",
      targetType: "Character",
      targetId: created.id,
      after: this.serializeCharacter(created)
    });

    return created;
  }

  public async updateCharacterDetails(
    guild: Guild,
    actor: User,
    input: UpdateCharacterInput
  ): Promise<CharacterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findActiveByUser(guild, actor.id);

    if (!current) {
      return null;
    }

    const metadata = this.getMetadata(current);
    const nextMetadata: CharacterMetadata = {
      concept: input.concept === undefined ? metadata.concept : input.concept ?? undefined,
      imageUrl: input.imageUrl === undefined ? metadata.imageUrl : input.imageUrl ?? undefined
    };

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        name: input.name ?? current.name,
        clanId: input.clanId === undefined ? current.clanId : input.clanId,
        villageId: input.villageId === undefined ? current.villageId : input.villageId,
        rankId: input.rankId === undefined ? current.rankId : input.rankId,
        metadata: nextMetadata as Prisma.InputJsonValue
      },
      include: CHARACTER_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: actor.id,
      action: "character.update",
      targetType: "Character",
      targetId: updated.id,
      before: this.serializeCharacter(current),
      after: this.serializeCharacter(updated)
    });

    return updated;
  }

  public async refreshCharacterAttributes(guild: Guild, actor: User): Promise<CharacterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findActiveByUser(guild, actor.id);

    if (!current) {
      return null;
    }

    const activeAttributes = await this.attributes.listAttributes(guild);
    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const currentValues = this.getAttributeValues(current);
    const nextValues = { ...currentValues };

    for (const attribute of activeAttributes) {
      if (nextValues[attribute.key] === undefined) {
        nextValues[attribute.key] = attribute.baseValue;
      }
    }

    nextValues.chakra = this.attributes.calculateChakra(nextValues, chakraFormula);

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        attributes: nextValues
      },
      include: CHARACTER_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: actor.id,
      action: "character.attributes.refresh",
      targetType: "Character",
      targetId: updated.id,
      before: { attributes: current.attributes as Prisma.InputJsonValue },
      after: { attributes: updated.attributes as Prisma.InputJsonValue }
    });

    return updated;
  }

  public async setCharacterActive(
    guild: Guild,
    actor: User,
    active: boolean
  ): Promise<CharacterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = active
      ? await this.findLatestByUser(guild, actor.id)
      : await this.findActiveByUser(guild, actor.id);

    if (!current) {
      return null;
    }

    if (active) {
      await this.prisma.character.updateMany({
        where: {
          guildId: rpgGuild.id,
          userId: actor.id,
          isActive: true,
          id: { not: current.id }
        },
        data: { isActive: false }
      });
    }

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: { isActive: active },
      include: CHARACTER_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: actor.id,
      action: active ? "character.activate" : "character.deactivate",
      targetType: "Character",
      targetId: updated.id,
      before: this.serializeCharacter(current),
      after: this.serializeCharacter(updated)
    });

    return updated;
  }

  public async resolveCharacterLinks(
    guild: Guild,
    input: CharacterLinkInput
  ): Promise<ResolvedCharacterLinks> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const [clans, villages, ranks] = await Promise.all([
      this.prisma.clan.findMany({ where: { guildId: rpgGuild.id, isActive: true } }),
      this.prisma.village.findMany({ where: { guildId: rpgGuild.id, isActive: true } }),
      this.prisma.rankDefinition.findMany({ where: { guildId: rpgGuild.id, isActive: true } })
    ]);
    const result: ResolvedCharacterLinks = { errors: [] };

    if (input.clan !== undefined) {
      const clan = resolveByNameOrId(clans, input.clan);
      result.clanId = clan?.id ?? (input.clan === null ? null : undefined);

      if (input.clan !== null && !clan) {
        result.errors.push(`Não encontrei clã ativo chamado \`${input.clan}\`.`);
      }
    }

    if (input.village !== undefined) {
      const village = resolveByNameOrId(villages, input.village);
      result.villageId = village?.id ?? (input.village === null ? null : undefined);

      if (input.village !== null && !village) {
        result.errors.push(`Não encontrei vila ativa chamada \`${input.village}\`.`);
      }
    }

    if (input.rank !== undefined) {
      const rank = resolveRank(ranks, input.rank);
      result.rankId = rank?.id ?? (input.rank === null ? null : undefined);

      if (input.rank !== null && !rank) {
        result.errors.push(`Não encontrei rank ativo chamado \`${input.rank}\`.`);
      }
    }

    return result;
  }

  public getAttributeValues(character: Character): Record<string, number> {
    if (!character.attributes || typeof character.attributes !== "object" || Array.isArray(character.attributes)) {
      return {};
    }

    const values: Record<string, number> = {};

    for (const [key, value] of Object.entries(character.attributes)) {
      if (typeof value === "number") {
        values[key] = value;
      }
    }

    return values;
  }

  public getMetadata(character: Character): CharacterMetadata {
    if (!character.metadata || typeof character.metadata !== "object" || Array.isArray(character.metadata)) {
      return {};
    }

    const record = character.metadata as Record<string, unknown>;

    return {
      concept: typeof record.concept === "string" ? record.concept : undefined,
      imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined
    };
  }

  private serializeCharacter(character: Character): Prisma.InputJsonObject {
    return {
      id: character.id,
      userId: character.userId,
      name: character.name,
      clanId: character.clanId,
      villageId: character.villageId,
      rankId: character.rankId,
      isActive: character.isActive,
      attributes: character.attributes as Prisma.InputJsonValue,
      metadata: character.metadata as Prisma.InputJsonValue
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

function resolveByNameOrId<T extends { id: string; name: string }>(
  entries: T[],
  input: string | null
): T | null {
  if (input === null) {
    return null;
  }

  const value = input.trim();
  const lowerValue = value.toLowerCase();

  return entries.find((entry) => entry.id === value || entry.name.toLowerCase() === lowerValue) ?? null;
}

function resolveRank<T extends { id: string; key: string; name: string }>(
  entries: T[],
  input: string | null
): T | null {
  if (input === null) {
    return null;
  }

  const value = input.trim();
  const normalizedKey = normalizeKey(value);
  const lowerValue = value.toLowerCase();

  return (
    entries.find(
      (entry) =>
        entry.id === value ||
        entry.key === normalizedKey ||
        entry.name.toLowerCase() === lowerValue
    ) ?? null
  );
}
