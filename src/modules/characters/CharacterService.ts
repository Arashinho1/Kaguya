import type { Guild, User } from "discord.js";

import {
  Prisma,
  type AttributeDefinition,
  type Character,
  type Clan,
  type PrismaClient,
  type RankDefinition,
  type Village
} from "../../generated/prisma/client.js";
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
  worldBonusSnapshot?: Record<string, number>;
  worldDirectChakraBonus?: number;
}

export interface UpdateCharacterInput {
  name?: string;
  concept?: string | null;
  imageUrl?: string | null;
  clanId?: string | null;
  villageId?: string | null;
  rankId?: string | null;
}

export interface CharacterAttributeAdjustment {
  character: CharacterWithRelations;
  beforeBaseAttributes: Record<string, number>;
  afterBaseAttributes: Record<string, number>;
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

export class CharacterRuleError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "CharacterRuleError";
  }
}

interface CharacterWorldInput {
  userId: string;
  clanId?: string | null;
  villageId?: string | null;
  rankId?: string | null;
  ignoredCharacterId?: string;
}

interface WorldBonusApplication {
  values: Record<string, number>;
  bonusSnapshot: Record<string, number>;
  directChakraBonus: number;
}

interface ParsedWorldBonuses {
  attributeBonuses: Record<string, number>;
  directChakraBonus: number;
}

interface WorldLinks {
  clanId?: string | null;
  villageId?: string | null;
  rankId?: string | null;
}

interface WorldRuleContext {
  clan: Clan | null;
  village: Village | null;
  rank: RankDefinition | null;
  activeRanks: RankDefinition[];
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

    await this.assertCharacterWorldRules(guild, {
      userId: user.id,
      clanId: input.clanId,
      villageId: input.villageId,
      rankId: input.rankId
    });

    const attributeBuild = await this.buildCharacterAttributes(guild, {
      clanId: input.clanId,
      villageId: input.villageId,
      rankId: input.rankId
    });
    const metadata = this.withWorldBonusMetadata(
      {
        concept: input.concept,
        imageUrl: input.imageUrl
      },
      attributeBuild
    );

    const created = await this.prisma.character.create({
      data: {
        guildId: rpgGuild.id,
        userId: user.id,
        name: input.name,
        clanId: input.clanId,
        villageId: input.villageId,
        rankId: input.rankId,
        attributes: attributeBuild.values,
        metadata: metadata as Prisma.InputJsonValue
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
      imageUrl: input.imageUrl === undefined ? metadata.imageUrl : input.imageUrl ?? undefined,
      worldBonusSnapshot: metadata.worldBonusSnapshot,
      worldDirectChakraBonus: metadata.worldDirectChakraBonus
    };
    const nextClanId = input.clanId === undefined ? current.clanId : input.clanId;
    const nextVillageId = input.villageId === undefined ? current.villageId : input.villageId;
    const nextRankId = input.rankId === undefined ? current.rankId : input.rankId;
    const linksChanged =
      input.clanId !== undefined || input.villageId !== undefined || input.rankId !== undefined;

    if (linksChanged) {
      await this.assertCharacterWorldRules(guild, {
        userId: actor.id,
        clanId: nextClanId,
        villageId: nextVillageId,
        rankId: nextRankId,
        ignoredCharacterId: current.id
      });
    }

    const attributeBuild =
      !linksChanged
        ? null
        : await this.buildCharacterAttributes(
            guild,
            {
              clanId: nextClanId,
              villageId: nextVillageId,
              rankId: nextRankId
            },
            this.getBaseAttributeValues(current)
          );

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        name: input.name ?? current.name,
        clanId: nextClanId,
        villageId: nextVillageId,
        rankId: nextRankId,
        ...(attributeBuild ? { attributes: attributeBuild.values } : {}),
        metadata: this.withWorldBonusMetadata(nextMetadata, attributeBuild) as Prisma.InputJsonValue
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

    await this.assertCharacterWorldRules(guild, {
      userId: actor.id,
      clanId: current.clanId,
      villageId: current.villageId,
      rankId: current.rankId,
      ignoredCharacterId: current.id
    });

    const attributeBuild = await this.buildCharacterAttributes(
      guild,
      {
        clanId: current.clanId,
        villageId: current.villageId,
        rankId: current.rankId
      },
      this.getBaseAttributeValues(current)
    );

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        attributes: attributeBuild.values,
        metadata: this.withWorldBonusMetadata(this.getMetadata(current), attributeBuild) as Prisma.InputJsonValue
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

  public async adjustActiveCharacterBaseAttributes(
    guild: Guild,
    actorId: string,
    userId: string,
    deltas: Record<string, number>,
    options: { action?: string; reason?: string } = {}
  ): Promise<CharacterAttributeAdjustment | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findActiveByUser(guild, userId);

    if (!current) {
      return null;
    }

    const beforeBaseAttributes = this.getBaseAttributeValues(current);
    const afterBaseAttributes = { ...beforeBaseAttributes };

    for (const [key, delta] of Object.entries(deltas)) {
      if (key === "chakra" || !Number.isFinite(delta) || delta === 0) {
        continue;
      }

      afterBaseAttributes[key] = (afterBaseAttributes[key] ?? 0) + delta;
    }

    const attributeBuild = await this.buildCharacterAttributes(
      guild,
      {
        clanId: current.clanId,
        villageId: current.villageId,
        rankId: current.rankId
      },
      afterBaseAttributes
    );

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        attributes: attributeBuild.values,
        metadata: this.withWorldBonusMetadata(this.getMetadata(current), attributeBuild) as Prisma.InputJsonValue
      },
      include: CHARACTER_INCLUDE
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: options.action ?? "character.attributes.adjust",
      targetType: "Character",
      targetId: updated.id,
      before: {
        baseAttributes: beforeBaseAttributes,
        attributes: current.attributes as Prisma.InputJsonValue
      },
      after: {
        deltas,
        baseAttributes: afterBaseAttributes,
        attributes: updated.attributes as Prisma.InputJsonValue
      },
      reason: options.reason
    });

    return {
      character: updated,
      beforeBaseAttributes,
      afterBaseAttributes
    };
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

    let attributeBuild: WorldBonusApplication | null = null;

    if (active) {
      await this.assertCharacterWorldRules(guild, {
        userId: actor.id,
        clanId: current.clanId,
        villageId: current.villageId,
        rankId: current.rankId,
        ignoredCharacterId: current.id
      });

      attributeBuild = await this.buildCharacterAttributes(
        guild,
        {
          clanId: current.clanId,
          villageId: current.villageId,
          rankId: current.rankId
        },
        this.getBaseAttributeValues(current)
      );

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
      data: {
        isActive: active,
        ...(attributeBuild ? { attributes: attributeBuild.values } : {}),
        ...(attributeBuild
          ? {
              metadata: this.withWorldBonusMetadata(
                this.getMetadata(current),
                attributeBuild
              ) as Prisma.InputJsonValue
            }
          : {})
      },
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
      imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined,
      worldBonusSnapshot: normalizeNumberRecord(record.worldBonusSnapshot),
      worldDirectChakraBonus:
        typeof record.worldDirectChakraBonus === "number" ? record.worldDirectChakraBonus : undefined
    };
  }

  public getWorldEffectSummary(character: Character): string | null {
    const metadata = this.getMetadata(character);
    const bonusLines = Object.entries(metadata.worldBonusSnapshot ?? {})
      .filter(([, value]) => value !== 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `\`${key}\`: ${formatSigned(value)}`);

    if (metadata.worldDirectChakraBonus) {
      bonusLines.push(`\`chakra\`: ${formatSigned(metadata.worldDirectChakraBonus)} direto`);
    }

    return bonusLines.length > 0 ? bonusLines.join("\n") : null;
  }

  private async buildCharacterAttributes(
    guild: Guild,
    links: WorldLinks,
    baseOverrides: Record<string, number> = {}
  ): Promise<WorldBonusApplication> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const activeAttributes = await this.attributes.listAttributes(guild);
    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const attributesByKey = new Map(activeAttributes.map((attribute) => [attribute.key, attribute]));
    const values: Record<string, number> = {};

    for (const attribute of activeAttributes) {
      if (attribute.key === "chakra") {
        continue;
      }

      values[attribute.key] = clampAttributeValue(
        baseOverrides[attribute.key] ?? attribute.baseValue,
        attribute
      );
    }

    const [clan, village, rank] = await Promise.all([
      links.clanId
        ? this.prisma.clan.findFirst({
            where: {
              id: links.clanId,
              guildId: rpgGuild.id,
              isActive: true
            }
          })
        : Promise.resolve(null),
      links.villageId
        ? this.prisma.village.findFirst({
            where: {
              id: links.villageId,
              guildId: rpgGuild.id,
              isActive: true
            }
          })
        : Promise.resolve(null),
      links.rankId
        ? this.prisma.rankDefinition.findFirst({
            where: {
              id: links.rankId,
              guildId: rpgGuild.id,
              isActive: true
            }
          })
        : Promise.resolve(null)
    ]);
    const bonuses = mergeWorldBonuses([
      parseWorldBonuses(clan?.bonuses, { includeTopLevel: true }),
      parseWorldBonuses(village?.metadata, { includeTopLevel: false }),
      parseWorldBonuses(rank?.metadata, { includeTopLevel: false })
    ]);
    const bonusSnapshot: Record<string, number> = {};

    for (const [key, bonus] of Object.entries(bonuses.attributeBonuses)) {
      if (key === "chakra" || bonus === 0) {
        continue;
      }

      const attribute = attributesByKey.get(key);

      if (!attribute) {
        continue;
      }

      values[key] = clampAttributeValue((values[key] ?? attribute.baseValue) + bonus, attribute);
      bonusSnapshot[key] = (bonusSnapshot[key] ?? 0) + bonus;
    }

    const chakraDefinition = attributesByKey.get("chakra");
    const chakra = this.attributes.calculateChakra(values, chakraFormula) + bonuses.directChakraBonus;
    values.chakra = chakraDefinition ? clampAttributeValue(chakra, chakraDefinition) : Math.max(0, Math.floor(chakra));

    return {
      values,
      bonusSnapshot,
      directChakraBonus: bonuses.directChakraBonus
    };
  }

  public getBaseAttributeValues(character: Character): Record<string, number> {
    const currentValues = this.getAttributeValues(character);
    const bonusSnapshot = this.getMetadata(character).worldBonusSnapshot ?? {};
    const baseValues = { ...currentValues };

    delete baseValues.chakra;

    for (const [key, bonus] of Object.entries(bonusSnapshot)) {
      if (baseValues[key] !== undefined) {
        baseValues[key] -= bonus;
      }
    }

    return baseValues;
  }

  private withWorldBonusMetadata(
    metadata: CharacterMetadata,
    attributeBuild: WorldBonusApplication | null
  ): CharacterMetadata {
    if (!attributeBuild) {
      return metadata;
    }

    return {
      ...metadata,
      worldBonusSnapshot: attributeBuild.bonusSnapshot,
      worldDirectChakraBonus: attributeBuild.directChakraBonus
    };
  }

  private async assertCharacterWorldRules(
    guild: Guild,
    input: CharacterWorldInput
  ): Promise<void> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const [clan, village, rank, ranks] = await Promise.all([
      input.clanId
        ? this.prisma.clan.findFirst({
            where: {
              id: input.clanId,
              guildId: rpgGuild.id,
              isActive: true
            }
          })
        : Promise.resolve(null),
      input.villageId
        ? this.prisma.village.findFirst({
            where: {
              id: input.villageId,
              guildId: rpgGuild.id,
              isActive: true
            }
          })
        : Promise.resolve(null),
      input.rankId
        ? this.prisma.rankDefinition.findFirst({
            where: {
              id: input.rankId,
              guildId: rpgGuild.id,
              isActive: true
            }
          })
        : Promise.resolve(null),
      this.prisma.rankDefinition.findMany({
        where: {
          guildId: rpgGuild.id,
          isActive: true
        }
      })
    ]);
    const errors: string[] = [];

    if (input.clanId && !clan) {
      errors.push("O clã escolhido não está ativo neste servidor.");
    }

    if (input.villageId && !village) {
      errors.push("A vila escolhida não está ativa neste servidor.");
    }

    if (input.rankId && !rank) {
      errors.push("O rank escolhido não está ativo neste servidor.");
    }

    if (clan?.memberLimit !== null && clan?.memberLimit !== undefined) {
      const activeMembers = await this.prisma.character.count({
        where: {
          guildId: rpgGuild.id,
          clanId: clan.id,
          isActive: true,
          ...(input.ignoredCharacterId ? { id: { not: input.ignoredCharacterId } } : {})
        }
      });

      if (activeMembers >= clan.memberLimit) {
        errors.push(`O clã **${clan.name}** já atingiu o limite de ${clan.memberLimit} membro(s).`);
      }
    }

    const context: WorldRuleContext = {
      clan,
      village,
      rank,
      activeRanks: ranks
    };

    if (clan) {
      errors.push(...validateWorldRestrictions(`O clã **${clan.name}**`, clan.restrictions, context));
    }

    if (village) {
      errors.push(...validateWorldRestrictions(`A vila **${village.name}**`, village.metadata, context));
    }

    if (rank) {
      errors.push(...validateWorldRestrictions(`O rank **${rank.name}**`, rank.metadata, context));
    }

    if (errors.length > 0) {
      throw new CharacterRuleError(errors);
    }
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

function parseWorldBonuses(
  value: unknown,
  options: { includeTopLevel: boolean }
): ParsedWorldBonuses {
  const record = asRecord(value);
  const attributeBonuses: Record<string, number> = {};
  let directChakraBonus = 0;
  const sources = [
    ...(options.includeTopLevel ? [record] : []),
    asRecord(record.bonuses),
    asRecord(record.bonus),
    asRecord(record["bônus"]),
    asRecord(record.attributes),
    asRecord(record.atributos),
    asRecord(record.attributeBonuses),
    asRecord(record.attribute_bonuses),
    asRecord(record.bonus_atributos)
  ];

  for (const source of sources) {
    for (const [rawKey, rawValue] of Object.entries(source)) {
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        continue;
      }

      const key = normalizeKey(rawKey) ?? rawKey.trim().toLowerCase();

      if (isDirectChakraBonusKey(key)) {
        directChakraBonus += rawValue;
        continue;
      }

      if (isReservedBonusKey(key)) {
        continue;
      }

      attributeBonuses[key] = (attributeBonuses[key] ?? 0) + rawValue;
    }
  }

  return {
    attributeBonuses,
    directChakraBonus
  };
}

function mergeWorldBonuses(entries: ParsedWorldBonuses[]): ParsedWorldBonuses {
  const merged: ParsedWorldBonuses = {
    attributeBonuses: {},
    directChakraBonus: 0
  };

  for (const entry of entries) {
    merged.directChakraBonus += entry.directChakraBonus;

    for (const [key, value] of Object.entries(entry.attributeBonuses)) {
      merged.attributeBonuses[key] = (merged.attributeBonuses[key] ?? 0) + value;
    }
  }

  return merged;
}

function validateWorldRestrictions(
  sourceLabel: string,
  rawRestrictions: unknown,
  context: WorldRuleContext
): string[] {
  const restrictions = extractRestrictions(rawRestrictions);
  const errors: string[] = [];
  const allowedClans = getStringList(restrictions, [
    "cla",
    "clã",
    "clas",
    "clãs",
    "clan",
    "clans",
    "clan_id",
    "clan_ids",
    "cla_obrigatorio",
    "clã_obrigatório",
    "clas_permitidos",
    "clãs_permitidos",
    "allowed_clans",
    "required_clan"
  ]);

  if (allowedClans.length > 0) {
    if (!context.clan) {
      errors.push(`${sourceLabel} exige um clã: ${formatAllowedValues(allowedClans)}.`);
    } else if (!matchesClan(context.clan, allowedClans)) {
      errors.push(`${sourceLabel} só permite os clãs: ${formatAllowedValues(allowedClans)}.`);
    }
  }

  const allowedVillages = getStringList(restrictions, [
    "vila",
    "vilas",
    "village",
    "villages",
    "vila_obrigatoria",
    "vilas_permitidas",
    "village_id",
    "village_ids",
    "required_village",
    "allowed_villages"
  ]);

  if (allowedVillages.length > 0) {
    if (!context.village) {
      errors.push(`${sourceLabel} exige uma vila: ${formatAllowedValues(allowedVillages)}.`);
    } else if (!matchesVillage(context.village, allowedVillages)) {
      errors.push(`${sourceLabel} só permite as vilas: ${formatAllowedValues(allowedVillages)}.`);
    }
  }

  const allowedRanks = getStringList(restrictions, [
    "rank",
    "ranks",
    "rank_key",
    "rank_keys",
    "ranks_permitidos",
    "allowed_ranks"
  ]);

  if (allowedRanks.length > 0) {
    if (!context.rank) {
      errors.push(`${sourceLabel} exige um rank: ${formatAllowedValues(allowedRanks)}.`);
    } else if (!matchesRank(context.rank, allowedRanks)) {
      errors.push(`${sourceLabel} só permite os ranks: ${formatAllowedValues(allowedRanks)}.`);
    }
  }

  const minimumRank = getStringValue(restrictions, [
    "rank_minimo",
    "rank_mínimo",
    "min_rank",
    "minimum_rank",
    "rank_minimum",
    "minrank"
  ]);

  if (minimumRank) {
    const minimum = resolveRank(context.activeRanks, minimumRank);

    if (!minimum) {
      errors.push(`${sourceLabel} tem um rank mínimo configurado que não existe: \`${minimumRank}\`.`);
    } else if (!context.rank) {
      errors.push(`${sourceLabel} exige rank mínimo **${minimum.name}**.`);
    } else if (context.rank.sortOrder < minimum.sortOrder) {
      errors.push(`${sourceLabel} exige rank mínimo **${minimum.name}**.`);
    }
  }

  return errors;
}

function clampAttributeValue(value: number, attribute: AttributeDefinition): number {
  const min = attribute.minValue;
  const max = attribute.maxValue;
  const floored = Math.floor(value);

  if (max !== null && floored > max) {
    return max;
  }

  return Math.max(min, floored);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function extractRestrictions(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  const nested = asRecord(record.restrictions);
  const nestedPt = asRecord(record.restricoes);
  const nestedPtAccent = asRecord(record["restrições"]);

  return {
    ...record,
    ...nested,
    ...nestedPt,
    ...nestedPtAccent
  };
}

function normalizeNumberRecord(value: unknown): Record<string, number> | undefined {
  const record = asRecord(value);
  const entries = Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === "number");

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function getStringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getStringList(record: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = [];

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      values.push(value.trim());
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim().length > 0) {
          values.push(item.trim());
        }
      }
    }
  }

  return [...new Set(values)];
}

function matchesClan(clan: Clan, allowedValues: string[]): boolean {
  return allowedValues.some((value) => {
    const normalized = normalizeKey(value);
    return (
      clan.id === value ||
      clan.name.toLowerCase() === value.toLowerCase() ||
      normalized === normalizeKey(clan.name)
    );
  });
}

function matchesVillage(village: Village, allowedValues: string[]): boolean {
  return allowedValues.some((value) => {
    const normalized = normalizeKey(value);
    return village.id === value || village.name.toLowerCase() === value.toLowerCase() || normalized === normalizeKey(village.name);
  });
}

function matchesRank(rank: RankDefinition, allowedValues: string[]): boolean {
  return allowedValues.some((value) => {
    const normalized = normalizeKey(value);
    return (
      rank.id === value ||
      rank.key === normalized ||
      rank.name.toLowerCase() === value.toLowerCase()
    );
  });
}

function formatAllowedValues(values: string[]): string {
  return values.map((value) => `\`${value}\``).join(", ");
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function isDirectChakraBonusKey(key: string): boolean {
  return [
    "chakra",
    "bonus_chakra",
    "chakra_bonus",
    "direct_chakra_bonus",
    "bonus_direto_chakra",
    "bonusdiretochakra",
    "directchakrabonus"
  ].includes(key);
}

function isReservedBonusKey(key: string): boolean {
  return ["attributes", "atributos", "attribute_bonuses", "attributebonuses"].includes(key);
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
