import type { Guild } from "discord.js";

import {
  Prisma,
  type Clan,
  type PrismaClient,
  type RankDefinition,
  type Village
} from "../../generated/prisma/client.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export type WorldEntityType = "clan" | "village" | "rank";

export interface WorldOverview {
  clansCount: number;
  activeClansCount: number;
  villagesCount: number;
  activeVillagesCount: number;
  ranksCount: number;
  activeRanksCount: number;
}

export interface CreateClanInput {
  name: string;
  description?: string | null;
  memberLimit?: number | null;
  bonuses?: Prisma.InputJsonObject;
  restrictions?: Prisma.InputJsonObject;
}

export interface UpdateClanInput {
  name?: string;
  description?: string | null;
  memberLimit?: number | null;
  isActive?: boolean;
}

export interface CreateVillageInput {
  name: string;
  description?: string | null;
  metadata?: Prisma.InputJsonObject;
}

export interface UpdateVillageInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateRankInput {
  key: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  metadata?: Prisma.InputJsonObject;
}

export interface UpdateRankInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export class WorldConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "WorldConfigError";
  }
}

export class WorldConfigService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService
  ) {}

  public async getOverview(guild: Guild): Promise<WorldOverview> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    const [
      clansCount,
      activeClansCount,
      villagesCount,
      activeVillagesCount,
      ranksCount,
      activeRanksCount
    ] = await Promise.all([
      this.prisma.clan.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.clan.count({ where: { guildId: rpgGuild.id, isActive: true } }),
      this.prisma.village.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.village.count({ where: { guildId: rpgGuild.id, isActive: true } }),
      this.prisma.rankDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.rankDefinition.count({ where: { guildId: rpgGuild.id, isActive: true } })
    ]);

    return {
      clansCount,
      activeClansCount,
      villagesCount,
      activeVillagesCount,
      ranksCount,
      activeRanksCount
    };
  }

  public async listClans(guild: Guild, options: { includeInactive?: boolean } = {}): Promise<Clan[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.clan.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true })
      },
      orderBy: [{ name: "asc" }]
    });
  }

  public async listVillages(
    guild: Guild,
    options: { includeInactive?: boolean } = {}
  ): Promise<Village[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.village.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true })
      },
      orderBy: [{ name: "asc" }]
    });
  }

  public async listRanks(
    guild: Guild,
    options: { includeInactive?: boolean } = {}
  ): Promise<RankDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.rankDefinition.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true })
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async createClan(
    guild: Guild,
    actorId: string,
    input: CreateClanInput
  ): Promise<Clan> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    await this.assertClanNameAvailable(rpgGuild.id, input.name);

    const created = await this.prisma.clan.create({
      data: {
        guildId: rpgGuild.id,
        name: input.name,
        description: input.description,
        memberLimit: input.memberLimit,
        bonuses: input.bonuses ?? {},
        restrictions: input.restrictions ?? {}
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.clan.create",
      targetType: "Clan",
      targetId: created.id,
      after: serializeClan(created)
    });

    return created;
  }

  public async updateClan(
    guild: Guild,
    actorId: string,
    identifier: string,
    input: UpdateClanInput
  ): Promise<Clan | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findClanByIdentifier(rpgGuild.id, identifier);

    if (!current) {
      return null;
    }

    if (input.name && !sameText(input.name, current.name)) {
      await this.assertClanNameAvailable(rpgGuild.id, input.name, current.id);
    }

    const updated = await this.prisma.clan.update({
      where: { id: current.id },
      data: input
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.clan.update",
      targetType: "Clan",
      targetId: updated.id,
      before: serializeClan(current),
      after: serializeClan(updated)
    });

    return updated;
  }

  public async updateClanRules(
    guild: Guild,
    actorId: string,
    identifier: string,
    input: { bonuses?: Prisma.InputJsonObject; restrictions?: Prisma.InputJsonObject }
  ): Promise<Clan | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findClanByIdentifier(rpgGuild.id, identifier);

    if (!current) {
      return null;
    }

    const updated = await this.prisma.clan.update({
      where: { id: current.id },
      data: input
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.clan.rules.update",
      targetType: "Clan",
      targetId: updated.id,
      before: serializeClan(current),
      after: serializeClan(updated)
    });

    return updated;
  }

  public async createVillage(
    guild: Guild,
    actorId: string,
    input: CreateVillageInput
  ): Promise<Village> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    await this.assertVillageNameAvailable(rpgGuild.id, input.name);

    const created = await this.prisma.village.create({
      data: {
        guildId: rpgGuild.id,
        name: input.name,
        description: input.description,
        metadata: input.metadata ?? {}
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.village.create",
      targetType: "Village",
      targetId: created.id,
      after: serializeVillage(created)
    });

    return created;
  }

  public async updateVillage(
    guild: Guild,
    actorId: string,
    identifier: string,
    input: UpdateVillageInput
  ): Promise<Village | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVillageByIdentifier(rpgGuild.id, identifier);

    if (!current) {
      return null;
    }

    if (input.name && !sameText(input.name, current.name)) {
      await this.assertVillageNameAvailable(rpgGuild.id, input.name, current.id);
    }

    const updated = await this.prisma.village.update({
      where: { id: current.id },
      data: input
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.village.update",
      targetType: "Village",
      targetId: updated.id,
      before: serializeVillage(current),
      after: serializeVillage(updated)
    });

    return updated;
  }

  public async updateVillageMetadata(
    guild: Guild,
    actorId: string,
    identifier: string,
    metadata: Prisma.InputJsonObject
  ): Promise<Village | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVillageByIdentifier(rpgGuild.id, identifier);

    if (!current) {
      return null;
    }

    const updated = await this.prisma.village.update({
      where: { id: current.id },
      data: { metadata }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.village.metadata.update",
      targetType: "Village",
      targetId: updated.id,
      before: serializeVillage(current),
      after: serializeVillage(updated)
    });

    return updated;
  }

  public async createRank(
    guild: Guild,
    actorId: string,
    input: CreateRankInput
  ): Promise<RankDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const key = normalizeKey(input.key);

    await this.assertRankKeyAvailable(rpgGuild.id, key);

    const created = await this.prisma.rankDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        metadata: input.metadata ?? {}
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.rank.create",
      targetType: "RankDefinition",
      targetId: created.id,
      after: serializeRank(created)
    });

    return created;
  }

  public async updateRank(
    guild: Guild,
    actorId: string,
    identifier: string,
    input: UpdateRankInput
  ): Promise<RankDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findRankByIdentifier(rpgGuild.id, identifier);

    if (!current) {
      return null;
    }

    const updated = await this.prisma.rankDefinition.update({
      where: { id: current.id },
      data: input
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.rank.update",
      targetType: "RankDefinition",
      targetId: updated.id,
      before: serializeRank(current),
      after: serializeRank(updated)
    });

    return updated;
  }

  public async updateRankMetadata(
    guild: Guild,
    actorId: string,
    identifier: string,
    metadata: Prisma.InputJsonObject
  ): Promise<RankDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findRankByIdentifier(rpgGuild.id, identifier);

    if (!current) {
      return null;
    }

    const updated = await this.prisma.rankDefinition.update({
      where: { id: current.id },
      data: { metadata }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.rank.metadata.update",
      targetType: "RankDefinition",
      targetId: updated.id,
      before: serializeRank(current),
      after: serializeRank(updated)
    });

    return updated;
  }

  private async findClanByIdentifier(guildId: string, identifier: string): Promise<Clan | null> {
    const value = identifier.trim();

    return this.prisma.clan.findFirst({
      where: {
        guildId,
        OR: [{ id: value }, { name: { equals: value, mode: "insensitive" } }]
      }
    });
  }

  private async findVillageByIdentifier(guildId: string, identifier: string): Promise<Village | null> {
    const value = identifier.trim();

    return this.prisma.village.findFirst({
      where: {
        guildId,
        OR: [{ id: value }, { name: { equals: value, mode: "insensitive" } }]
      }
    });
  }

  private async findRankByIdentifier(
    guildId: string,
    identifier: string
  ): Promise<RankDefinition | null> {
    const value = identifier.trim();
    const key = normalizeKey(value);

    return this.prisma.rankDefinition.findFirst({
      where: {
        guildId,
        OR: [
          { id: value },
          { key },
          { name: { equals: value, mode: "insensitive" } }
        ]
      }
    });
  }

  private async assertClanNameAvailable(
    guildId: string,
    name: string,
    ignoredId?: string
  ): Promise<void> {
    const existing = await this.prisma.clan.findFirst({
      where: {
        guildId,
        name: { equals: name, mode: "insensitive" },
        ...(ignoredId ? { id: { not: ignoredId } } : {})
      }
    });

    if (existing) {
      throw new WorldConfigError(`Já existe um clã chamado **${existing.name}** neste servidor.`);
    }
  }

  private async assertVillageNameAvailable(
    guildId: string,
    name: string,
    ignoredId?: string
  ): Promise<void> {
    const existing = await this.prisma.village.findFirst({
      where: {
        guildId,
        name: { equals: name, mode: "insensitive" },
        ...(ignoredId ? { id: { not: ignoredId } } : {})
      }
    });

    if (existing) {
      throw new WorldConfigError(`Já existe uma vila chamada **${existing.name}** neste servidor.`);
    }
  }

  private async assertRankKeyAvailable(
    guildId: string,
    key: string,
    ignoredId?: string
  ): Promise<void> {
    const existing = await this.prisma.rankDefinition.findFirst({
      where: {
        guildId,
        key,
        ...(ignoredId ? { id: { not: ignoredId } } : {})
      }
    });

    if (existing) {
      throw new WorldConfigError(`Já existe um rank com a chave \`${existing.key}\` neste servidor.`);
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

export function normalizeKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase("pt-BR") === right.trim().toLocaleLowerCase("pt-BR");
}

function serializeClan(clan: Clan): Prisma.InputJsonObject {
  return {
    id: clan.id,
    name: clan.name,
    description: clan.description,
    bonuses: clan.bonuses as Prisma.InputJsonValue,
    restrictions: clan.restrictions as Prisma.InputJsonValue,
    memberLimit: clan.memberLimit,
    isActive: clan.isActive
  };
}

function serializeVillage(village: Village): Prisma.InputJsonObject {
  return {
    id: village.id,
    name: village.name,
    description: village.description,
    metadata: village.metadata as Prisma.InputJsonValue,
    isActive: village.isActive
  };
}

function serializeRank(rank: RankDefinition): Prisma.InputJsonObject {
  return {
    id: rank.id,
    key: rank.key,
    name: rank.name,
    description: rank.description,
    sortOrder: rank.sortOrder,
    metadata: rank.metadata as Prisma.InputJsonValue,
    isActive: rank.isActive
  };
}
