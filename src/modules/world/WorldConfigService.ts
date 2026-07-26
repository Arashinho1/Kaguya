import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { Clan, PrismaClient, RankDefinition, Village } from "../../generated/prisma/client.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export class WorldRuleError extends DomainError {}

export interface ClanInput {
  name: string;
  description?: string;
  bonuses?: Record<string, number>;
  memberLimit?: number | null;
}

export interface VillageInput {
  name: string;
  description?: string;
  bonuses?: Record<string, number>;
}

export interface RankInput {
  key: string;
  name: string;
  description?: string;
  bonuses?: Record<string, number>;
  sortOrder?: number;
}

export class WorldConfigService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService
  ) {}

  // ─── Clãs ────────────────────────────────────────────────────────────────

  public async listClans(guild: Guild, options: { includeInactive?: boolean } = {}): Promise<Clan[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.clan.findMany({
      where: { guildId: rpgGuild.id, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" }
    });
  }

  public async findClan(guild: Guild, name: string): Promise<Clan | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.clan.findUnique({ where: { guildId_name: { guildId: rpgGuild.id, name } } });
  }

  public async countActiveCharactersInClan(clanId: string): Promise<number> {
    return this.prisma.character.count({ where: { clanId, isActive: true } });
  }

  public async createClan(guild: Guild, actorId: string, input: ClanInput): Promise<Clan> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findClan(guild, input.name)) {
      throw new WorldRuleError(`Já existe um clã chamado **${input.name}**.`);
    }

    const created = await this.prisma.clan.create({
      data: {
        guildId: rpgGuild.id,
        name: input.name,
        description: input.description,
        bonuses: normalizeBonuses(input.bonuses),
        memberLimit: input.memberLimit ?? null
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.clan.create",
      targetType: "Clan",
      targetId: created.id,
      after: { name: created.name }
    });

    return created;
  }

  public async updateClan(
    guild: Guild,
    actorId: string,
    name: string,
    input: Partial<Omit<ClanInput, "name">> & { isActive?: boolean }
  ): Promise<Clan | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findClan(guild, name);
    if (!current) return null;

    const updated = await this.prisma.clan.update({
      where: { id: current.id },
      data: {
        description: input.description,
        bonuses: input.bonuses ? normalizeBonuses(input.bonuses) : undefined,
        memberLimit: input.memberLimit,
        isActive: input.isActive
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.clan.update",
      targetType: "Clan",
      targetId: updated.id
    });

    return updated;
  }

  public async deleteClan(guild: Guild, actorId: string, name: string): Promise<Clan | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findClan(guild, name);
    if (!current) return null;

    await this.prisma.clan.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.clan.delete",
      targetType: "Clan",
      targetId: current.id
    });

    return current;
  }

  // ─── Vilas ───────────────────────────────────────────────────────────────

  public async listVillages(guild: Guild, options: { includeInactive?: boolean } = {}): Promise<Village[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.village.findMany({
      where: { guildId: rpgGuild.id, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" }
    });
  }

  public async findVillage(guild: Guild, name: string): Promise<Village | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.village.findUnique({ where: { guildId_name: { guildId: rpgGuild.id, name } } });
  }

  public async createVillage(guild: Guild, actorId: string, input: VillageInput): Promise<Village> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findVillage(guild, input.name)) {
      throw new WorldRuleError(`Já existe uma vila chamada **${input.name}**.`);
    }

    const created = await this.prisma.village.create({
      data: {
        guildId: rpgGuild.id,
        name: input.name,
        description: input.description,
        bonuses: normalizeBonuses(input.bonuses)
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.village.create",
      targetType: "Village",
      targetId: created.id,
      after: { name: created.name }
    });

    return created;
  }

  public async updateVillage(
    guild: Guild,
    actorId: string,
    name: string,
    input: Partial<Omit<VillageInput, "name">> & { isActive?: boolean }
  ): Promise<Village | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVillage(guild, name);
    if (!current) return null;

    const updated = await this.prisma.village.update({
      where: { id: current.id },
      data: {
        description: input.description,
        bonuses: input.bonuses ? normalizeBonuses(input.bonuses) : undefined,
        isActive: input.isActive
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.village.update",
      targetType: "Village",
      targetId: updated.id
    });

    return updated;
  }

  public async deleteVillage(guild: Guild, actorId: string, name: string): Promise<Village | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVillage(guild, name);
    if (!current) return null;

    await this.prisma.village.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.village.delete",
      targetType: "Village",
      targetId: current.id
    });

    return current;
  }

  // ─── Ranks ───────────────────────────────────────────────────────────────

  public async listRanks(guild: Guild, options: { includeInactive?: boolean } = {}): Promise<RankDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.rankDefinition.findMany({
      where: { guildId: rpgGuild.id, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findRank(guild: Guild, key: string): Promise<RankDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.rankDefinition.findUnique({ where: { guildId_key: { guildId: rpgGuild.id, key } } });
  }

  public async createRank(guild: Guild, actorId: string, input: RankInput): Promise<RankDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findRank(guild, input.key)) {
      throw new WorldRuleError(`Já existe um rank com a chave \`${input.key}\`.`);
    }

    const created = await this.prisma.rankDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key: input.key,
        name: input.name,
        description: input.description,
        bonuses: normalizeBonuses(input.bonuses),
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.rank.create",
      targetType: "RankDefinition",
      targetId: created.id,
      after: { key: created.key }
    });

    return created;
  }

  public async updateRank(
    guild: Guild,
    actorId: string,
    key: string,
    input: Partial<Omit<RankInput, "key">> & { isActive?: boolean }
  ): Promise<RankDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findRank(guild, key);
    if (!current) return null;

    const updated = await this.prisma.rankDefinition.update({
      where: { id: current.id },
      data: {
        name: input.name,
        description: input.description,
        bonuses: input.bonuses ? normalizeBonuses(input.bonuses) : undefined,
        sortOrder: input.sortOrder,
        isActive: input.isActive
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.rank.update",
      targetType: "RankDefinition",
      targetId: updated.id
    });

    return updated;
  }

  public async deleteRank(guild: Guild, actorId: string, key: string): Promise<RankDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findRank(guild, key);
    if (!current) return null;

    await this.prisma.rankDefinition.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "world.rank.delete",
      targetType: "RankDefinition",
      targetId: current.id
    });

    return current;
  }
}

export function normalizeBonuses(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number"
    )
  );
}
