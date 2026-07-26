import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import {
  Prisma,
  type CharacterPericia,
  type PericiaDefinition,
  type PrismaClient
} from "../../generated/prisma/client.js";
import type { CharacterWithWorld } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export class PericiaRuleError extends DomainError {}

const LEVEL_THRESHOLDS_KEY = "periciaLevelThresholds";

/** Só usada quando o servidor ainda não configurou nenhuma curva — totalmente substituível. */
const DEFAULT_LEVEL_THRESHOLDS: Record<number, number> = { 1: 0, 2: 100, 3: 250, 4: 450, 5: 700 };

export interface CreatePericiaInput {
  key: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdatePericiaInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PericiaProgressView {
  pericia: PericiaDefinition;
  xp: number;
  level: number;
  xpForNextLevel: number | null;
}

export class PericiaService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService
  ) {}

  public async listPericias(
    guild: Guild,
    options: { includeInactive?: boolean } = {}
  ): Promise<PericiaDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.periciaDefinition.findMany({
      where: { guildId: rpgGuild.id, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findPericia(guild: Guild, key: string): Promise<PericiaDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.periciaDefinition.findUnique({ where: { guildId_key: { guildId: rpgGuild.id, key } } });
  }

  public async createPericia(guild: Guild, actorId: string, input: CreatePericiaInput): Promise<PericiaDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findPericia(guild, input.key)) {
      throw new PericiaRuleError(`Já existe uma perícia com a chave \`${input.key}\`.`);
    }

    const created = await this.prisma.periciaDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key: input.key,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "pericia.create",
      targetType: "PericiaDefinition",
      targetId: created.id,
      after: { key: created.key }
    });

    return created;
  }

  public async updatePericia(
    guild: Guild,
    actorId: string,
    key: string,
    input: UpdatePericiaInput
  ): Promise<PericiaDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findPericia(guild, key);
    if (!current) return null;

    const updated = await this.prisma.periciaDefinition.update({ where: { id: current.id }, data: input });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "pericia.update",
      targetType: "PericiaDefinition",
      targetId: updated.id
    });

    return updated;
  }

  public async deletePericia(guild: Guild, actorId: string, key: string): Promise<PericiaDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findPericia(guild, key);
    if (!current) return null;

    await this.prisma.periciaDefinition.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "pericia.delete",
      targetType: "PericiaDefinition",
      targetId: current.id
    });

    return current;
  }

  public async getLevelThresholds(guild: Guild): Promise<Record<number, number>> {
    const raw = await this.guildConfig.getSetting(guild, LEVEL_THRESHOLDS_KEY);
    const normalized = normalizeThresholds(raw);
    return Object.keys(normalized).length > 0 ? normalized : DEFAULT_LEVEL_THRESHOLDS;
  }

  public async setLevelThresholds(
    guild: Guild,
    actorId: string,
    thresholds: Record<number, number>
  ): Promise<Record<number, number>> {
    const normalized = normalizeThresholds(thresholds);

    if (Object.keys(normalized).length === 0) {
      throw new PericiaRuleError("Informe ao menos um nível com seu XP mínimo (ex: 1:0,2:100).");
    }

    await this.guildConfig.setSetting(guild, actorId, {
      key: LEVEL_THRESHOLDS_KEY,
      label: "Curva de nível das perícias",
      description: "Mapa nível → XP mínimo necessário para alcançá-lo.",
      value: normalized as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: true
    });

    return normalized;
  }

  public calculateLevel(xp: number, thresholds: Record<number, number>): number {
    const levels = Object.entries(thresholds)
      .map(([level, minXp]) => ({ level: Number.parseInt(level, 10), minXp }))
      .sort((a, b) => a.minXp - b.minXp);

    let current = levels[0]?.level ?? 1;
    for (const entry of levels) {
      if (xp >= entry.minXp) {
        current = entry.level;
      }
    }
    return current;
  }

  public async getOrCreateProgress(
    guild: Guild,
    character: CharacterWithWorld,
    pericia: PericiaDefinition
  ): Promise<CharacterPericia> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.characterPericia.upsert({
      where: { characterId_periciaId: { characterId: character.id, periciaId: pericia.id } },
      update: {},
      create: { guildId: rpgGuild.id, characterId: character.id, periciaId: pericia.id }
    });
  }

  public async getProgressView(guild: Guild, character: CharacterWithWorld): Promise<PericiaProgressView[]> {
    const [pericias, thresholds, progressRows] = await Promise.all([
      this.listPericias(guild),
      this.getLevelThresholds(guild),
      this.prisma.characterPericia.findMany({ where: { characterId: character.id } })
    ]);

    const progressMap = new Map(progressRows.map((row) => [row.periciaId, row]));
    const sortedLevels = Object.entries(thresholds)
      .map(([level, minXp]) => ({ level: Number.parseInt(level, 10), minXp }))
      .sort((a, b) => a.minXp - b.minXp);

    return pericias.map((pericia) => {
      const progress = progressMap.get(pericia.id);
      const xp = progress?.xp ?? 0;
      // Recalculado ao vivo (não usa progress.level) para refletir mudanças na curva de
      // nível feitas depois do último grantXp — mesmo princípio do Chakra: nunca cacheado.
      const level = this.calculateLevel(xp, thresholds);
      const nextThreshold = sortedLevels.find((entry) => entry.minXp > xp);

      return { pericia, xp, level, xpForNextLevel: nextThreshold?.minXp ?? null };
    });
  }

  public async grantXp(
    guild: Guild,
    actorId: string,
    character: CharacterWithWorld,
    periciaKey: string,
    amount: number,
    reason?: string
  ): Promise<CharacterPericia> {
    if (!Number.isInteger(amount) || amount === 0) {
      throw new PericiaRuleError("A quantidade de XP precisa ser um número inteiro diferente de zero.");
    }

    const pericia = await this.findPericia(guild, periciaKey);
    if (!pericia || !pericia.isActive) {
      throw new PericiaRuleError(`Não encontrei a perícia \`${periciaKey}\` (ou ela está desativada).`);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const progress = await this.getOrCreateProgress(guild, character, pericia);
    const thresholds = await this.getLevelThresholds(guild);

    const xpBefore = progress.xp;
    const xpAfter = Math.max(0, xpBefore + amount);
    const levelBefore = progress.level;
    const levelAfter = this.calculateLevel(xpAfter, thresholds);

    const updated = await this.prisma.characterPericia.update({
      where: { id: progress.id },
      data: { xp: xpAfter, level: levelAfter }
    });

    await this.prisma.periciaXpLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        periciaId: pericia.id,
        actorId,
        xpGained: amount,
        xpBefore,
        xpAfter,
        levelBefore,
        levelAfter,
        reason
      }
    });

    return updated;
  }
}

function normalizeThresholds(value: unknown): Record<number, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<number, number> = {};
  for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
    const level = Number.parseInt(key, 10);
    if (Number.isInteger(level) && typeof amount === "number") {
      result[level] = amount;
    }
  }
  return result;
}
