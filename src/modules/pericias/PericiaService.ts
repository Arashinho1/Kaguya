import type { Guild } from "discord.js";

import { DEFAULT_PERICIA_CONFIG } from "../../config/defaults.js";
import {
  Prisma,
  type Character,
  type CharacterPericia,
  type PericiaDefinition,
  type PericiaXpLog,
  type PrismaClient
} from "../../generated/prisma/client.js";
import { normalizeKey } from "../../utils/text.js";
import type { CharacterService } from "../characters/CharacterService.js";
import type { JutsuWithRelations } from "../jutsus/JutsuService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export const PERICIA_MAX_XP = 100;
export const PERICIA_MAX_LEVEL = 5;
export const PERICIA_MIN_LEVEL = 1;

export interface PericiaConfig {
  baseXpPerUse: number;
  rankMultipliers: Record<string, number>;
  dailyXpCap: number;
  postCapXpGain: number;
}

export interface CreatePericiaInput {
  key: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdatePericiaInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PericiaProgressEntry {
  pericia: PericiaDefinition;
  progress: CharacterPericia;
}

export interface GrantPericiaXpResult {
  pericia: PericiaDefinition;
  progress: CharacterPericia;
  log: PericiaXpLog;
  xpGained: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  capped: boolean;
}

export interface AdjustPericiaProgressResult {
  character: Character;
  pericia: PericiaDefinition;
  progress: CharacterPericia;
  log: PericiaXpLog;
}

export class PericiaRuleError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "PericiaRuleError";
  }
}

export class PericiaService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly characters: CharacterService
  ) {}

  public async listPericias(
    guild: Guild,
    options: { includeInactive?: boolean } = {}
  ): Promise<PericiaDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.periciaDefinition.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true })
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findPericia(guild: Guild, key: string): Promise<PericiaDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const normalizedKey = normalizeKey(key) ?? key.trim().toLowerCase();

    return this.prisma.periciaDefinition.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: normalizedKey
        }
      }
    });
  }

  public async createPericia(
    guild: Guild,
    actorId: string,
    input: CreatePericiaInput
  ): Promise<PericiaDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const key = normalizeKey(input.key) ?? input.key.trim().toLowerCase();

    if (!key) {
      throw new PericiaRuleError(["Informe uma chave válida para a perícia."]);
    }

    const created = await this.prisma.periciaDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "pericia.create",
      targetType: "PericiaDefinition",
      targetId: created.id,
      after: this.serializePericia(created)
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

    if (!current) {
      return null;
    }

    const updated = await this.prisma.periciaDefinition.update({
      where: { id: current.id },
      data: input
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "pericia.update",
      targetType: "PericiaDefinition",
      targetId: updated.id,
      before: this.serializePericia(current),
      after: this.serializePericia(updated)
    });

    return updated;
  }

  public async setPericiaActive(
    guild: Guild,
    actorId: string,
    key: string,
    isActive: boolean
  ): Promise<PericiaDefinition | null> {
    return this.updatePericia(guild, actorId, key, { isActive });
  }

  public async getPericiaConfig(guild: Guild): Promise<PericiaConfig> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "periciaConfig"
        }
      }
    });

    return normalizePericiaConfig(setting?.value);
  }

  public async setPericiaConfig(
    guild: Guild,
    actorId: string,
    input: Partial<PericiaConfig>
  ): Promise<PericiaConfig> {
    const current = await this.getPericiaConfig(guild);
    const next = normalizePericiaConfig({
      ...current,
      ...input
    });

    await this.guildConfig.setSetting(guild, actorId, {
      key: "periciaConfig",
      label: "Configuração de perícias",
      description: "Define XP base, multiplicadores por rank de jutsu e cap diário de XP das perícias.",
      value: next as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: false
    });

    return next;
  }

  public async listProgress(guild: Guild, character: Character): Promise<PericiaProgressEntry[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const pericias = await this.listPericias(guild);

    if (pericias.length === 0) {
      return [];
    }

    const existing = await this.prisma.characterPericia.findMany({
      where: {
        guildId: rpgGuild.id,
        characterId: character.id,
        periciaId: { in: pericias.map((pericia) => pericia.id) }
      }
    });
    const existingByPericiaId = new Map(existing.map((entry) => [entry.periciaId, entry]));

    const entries: PericiaProgressEntry[] = [];

    for (const pericia of pericias) {
      const progress =
        existingByPericiaId.get(pericia.id) ??
        (await this.getOrCreateProgress(rpgGuild.id, character.id, pericia.id));

      entries.push({ pericia, progress });
    }

    return entries;
  }

  /**
   * Concede XP de perícia pelo uso de um jutsu. Retorna `null` quando o tipo do jutsu
   * não está vinculado a nenhuma perícia (nada a fazer).
   */
  public async grantXpForJutsuUse(
    guild: Guild,
    character: Character,
    jutsu: JutsuWithRelations,
    actorId: string
  ): Promise<GrantPericiaXpResult | null> {
    const periciaId = jutsu.type?.periciaId ?? null;

    if (!periciaId) {
      return null;
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const pericia = await this.prisma.periciaDefinition.findUnique({ where: { id: periciaId } });

    if (!pericia || !pericia.isActive) {
      return null;
    }

    const config = await this.getPericiaConfig(guild);
    const current = await this.getOrCreateProgress(rpgGuild.id, character.id, pericia.id);
    const todayKey = getDayKey();

    const xpGainedToday = current.xpDayKey === todayKey ? current.xpGainedToday : 0;
    const rankMultiplier = config.rankMultipliers[jutsu.jutsuRank ?? ""] ?? 1;
    const rawXpGain = Math.max(1, Math.round(config.baseXpPerUse * rankMultiplier));

    const remainingBeforeCap = Math.max(0, config.dailyXpCap - xpGainedToday);
    const capped = remainingBeforeCap <= 0;
    const xpGained = capped ? Math.max(0, config.postCapXpGain) : Math.min(rawXpGain, remainingBeforeCap);
    const nextXpGainedToday = xpGainedToday + (capped ? 0 : xpGained);

    const xpBefore = current.xp;
    const levelBefore = current.level;
    const { xp: xpAfter, level: levelAfter } = applyPericiaXpGain(xpBefore, levelBefore, xpGained);

    const progress = await this.prisma.characterPericia.update({
      where: { id: current.id },
      data: {
        xp: xpAfter,
        level: levelAfter,
        xpGainedToday: nextXpGainedToday,
        xpDayKey: todayKey
      }
    });

    const log = await this.prisma.periciaXpLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        periciaId: pericia.id,
        jutsuId: jutsu.id,
        actorId,
        xpGained,
        xpBefore,
        xpAfter,
        levelBefore,
        levelAfter,
        reason: `Uso de ${jutsu.name}`,
        metadata: {
          jutsuKey: jutsu.key,
          jutsuRank: jutsu.jutsuRank,
          capped
        }
      }
    });

    return {
      pericia,
      progress,
      log,
      xpGained,
      xpBefore,
      xpAfter,
      levelBefore,
      levelAfter,
      capped
    };
  }

  public async adjustProgress(
    guild: Guild,
    actorId: string,
    targetUserId: string,
    periciaKey: string,
    input: { xpDelta?: number; level?: number; reason?: string }
  ): Promise<AdjustPericiaProgressResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, targetUserId);

    if (!character) {
      throw new PericiaRuleError(["Esse usuário precisa ter uma ficha ativa para ajustar perícias."]);
    }

    const pericia = await this.findPericia(guild, periciaKey);

    if (!pericia) {
      throw new PericiaRuleError([`Não encontrei uma perícia com a chave \`${periciaKey}\`.`]);
    }

    const current = await this.getOrCreateProgress(rpgGuild.id, character.id, pericia.id);
    const xpBefore = current.xp;
    const levelBefore = current.level;

    let xpAfter = xpBefore;
    let levelAfter = levelBefore;

    if (typeof input.level === "number") {
      levelAfter = clamp(Math.trunc(input.level), PERICIA_MIN_LEVEL, PERICIA_MAX_LEVEL);
      xpAfter = levelAfter >= PERICIA_MAX_LEVEL ? Math.min(xpBefore, PERICIA_MAX_XP) : xpBefore;
    }

    if (typeof input.xpDelta === "number" && input.xpDelta !== 0) {
      const applied = applyPericiaXpGain(xpAfter, levelAfter, Math.trunc(input.xpDelta));
      xpAfter = applied.xp;
      levelAfter = applied.level;
    }

    if (xpAfter === xpBefore && levelAfter === levelBefore) {
      throw new PericiaRuleError(["Informe uma alteração de XP ou nível para ajustar."]);
    }

    const progress = await this.prisma.characterPericia.update({
      where: { id: current.id },
      data: { xp: xpAfter, level: levelAfter }
    });

    const log = await this.prisma.periciaXpLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        periciaId: pericia.id,
        actorId,
        xpGained: xpAfter - xpBefore,
        xpBefore,
        xpAfter,
        levelBefore,
        levelAfter,
        reason: input.reason ?? "Ajuste manual"
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "pericia.progress.adjust",
      targetType: "CharacterPericia",
      targetId: progress.id,
      before: { xp: xpBefore, level: levelBefore },
      after: { characterId: character.id, targetUserId, periciaKey: pericia.key, xp: xpAfter, level: levelAfter },
      reason: input.reason
    });

    return { character, pericia, progress, log };
  }

  private async getOrCreateProgress(
    guildId: string,
    characterId: string,
    periciaId: string
  ): Promise<CharacterPericia> {
    return this.prisma.characterPericia.upsert({
      where: {
        characterId_periciaId: {
          characterId,
          periciaId
        }
      },
      update: {},
      create: {
        guildId,
        characterId,
        periciaId,
        xpDayKey: getDayKey()
      }
    });
  }

  private serializePericia(pericia: PericiaDefinition): Prisma.InputJsonObject {
    return {
      id: pericia.id,
      key: pericia.key,
      name: pericia.name,
      description: pericia.description,
      sortOrder: pericia.sortOrder,
      isActive: pericia.isActive
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

/**
 * Aplica ganho de XP com carry entre níveis (100 XP = +1 nível), travando em
 * nível 5 / 100 XP no topo da progressão.
 */
export function applyPericiaXpGain(
  currentXp: number,
  currentLevel: number,
  xpGain: number
): { xp: number; level: number } {
  let xp = currentXp + xpGain;
  let level = currentLevel;

  while (xp >= PERICIA_MAX_XP && level < PERICIA_MAX_LEVEL) {
    xp -= PERICIA_MAX_XP;
    level += 1;
  }

  if (level >= PERICIA_MAX_LEVEL) {
    level = PERICIA_MAX_LEVEL;
    xp = Math.min(xp, PERICIA_MAX_XP);
  }

  return { xp: Math.max(0, xp), level: clamp(level, PERICIA_MIN_LEVEL, PERICIA_MAX_LEVEL) };
}

export function formatPericiaConfig(config: PericiaConfig): string {
  const multipliers = Object.entries(config.rankMultipliers)
    .map(([rank, multiplier]) => `${rank}=${multiplier}x`)
    .join(", ");

  return [
    `XP base por uso: **${config.baseXpPerUse}**`,
    `Multiplicadores por rank: ${multipliers || "—"}`,
    `Cap diário de XP: **${config.dailyXpCap}**`,
    `Ganho após o cap: **${config.postCapXpGain}**`
  ].join("\n");
}

function getDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePericiaConfig(value: unknown): PericiaConfig {
  const record = asRecord(value);
  const baseXpPerUse = normalizeNumber(record.baseXpPerUse, DEFAULT_PERICIA_CONFIG.baseXpPerUse, 0);
  const dailyXpCap = Math.max(0, Math.trunc(normalizeNumber(record.dailyXpCap, DEFAULT_PERICIA_CONFIG.dailyXpCap, 0)));
  const postCapXpGain = Math.max(
    0,
    Math.trunc(normalizeNumber(record.postCapXpGain, DEFAULT_PERICIA_CONFIG.postCapXpGain, 0))
  );

  return {
    baseXpPerUse,
    rankMultipliers: normalizeRankMultipliers(record.rankMultipliers),
    dailyXpCap,
    postCapXpGain
  };
}

function normalizeRankMultipliers(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PERICIA_CONFIG.rankMultipliers };
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])
  );

  return entries.length > 0 ? Object.fromEntries(entries) : { ...DEFAULT_PERICIA_CONFIG.rankMultipliers };
}

function normalizeNumber(value: unknown, fallback: number, min: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
