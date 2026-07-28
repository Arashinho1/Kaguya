import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { CharacterService } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import type { VagaService } from "./VagaService.js";

export class PretensaoRuleError extends DomainError {}

const CONFIG_KEY = "pretensaoConfig";

export type PretensaoOverride = "auto" | "open" | "closed";

export interface PretensaoConfig {
  channelId: string | null;
  /** 0 = domingo ... 6 = sábado. Vazio = todos os dias. */
  daysOfWeek: number[];
  /** Minutos desde meia-noite (horário local, ver utcOffsetHours). */
  startMinute: number;
  durationMinutes: number;
  /** Fuso horário fixo (sem DST) usado pra calcular dia/hora local. Padrão -3 (Brasília). */
  utcOffsetHours: number;
  override: PretensaoOverride;
}

export const DEFAULT_PRETENSAO_CONFIG: PretensaoConfig = {
  channelId: null,
  daysOfWeek: [],
  startMinute: 0,
  durationMinutes: 0,
  utcOffsetHours: -3,
  override: "auto"
};

export interface ScheduleInput {
  daysOfWeek: number[];
  startMinute: number;
  durationMinutes: number;
  utcOffsetHours: number;
}

export type PretensaoClaimResult =
  | { kind: "ignored" }
  | { kind: "success"; vagaName: string; rankBumped: boolean }
  | { kind: "failed"; reason: string };

export class PretensaoService {
  public constructor(
    private readonly guildConfig: GuildConfigService,
    private readonly vagas: VagaService,
    private readonly characters: CharacterService
  ) {}

  public async getConfig(guild: Guild): Promise<PretensaoConfig> {
    const raw = await this.guildConfig.getSetting(guild, CONFIG_KEY);
    return normalizeConfig(raw);
  }

  private async saveConfig(guild: Guild, actorId: string, config: PretensaoConfig): Promise<PretensaoConfig> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: CONFIG_KEY,
      label: "Pretensão de vagas",
      description: "Canal, dias/horário e status manual da pretensão de vagas.",
      value: config as unknown as Prisma.InputJsonValue,
      valueType: "JSON"
    });
    return config;
  }

  public async setChannel(guild: Guild, actorId: string, channelId: string | null): Promise<PretensaoConfig> {
    const config = await this.getConfig(guild);
    return this.saveConfig(guild, actorId, { ...config, channelId });
  }

  public async setSchedule(guild: Guild, actorId: string, input: ScheduleInput): Promise<PretensaoConfig> {
    if (input.startMinute < 0 || input.startMinute >= 24 * 60) {
      throw new PretensaoRuleError("Horário de início inválido.");
    }
    if (input.durationMinutes < 0 || input.durationMinutes > 24 * 60) {
      throw new PretensaoRuleError("Duração inválida — precisa ser entre 0 e 1440 minutos.");
    }
    if (input.daysOfWeek.some((day) => day < 0 || day > 6)) {
      throw new PretensaoRuleError("Dia da semana inválido.");
    }
    if (input.utcOffsetHours < -12 || input.utcOffsetHours > 14) {
      throw new PretensaoRuleError("Fuso horário inválido.");
    }

    const config = await this.getConfig(guild);
    return this.saveConfig(guild, actorId, { ...config, ...input });
  }

  public async setOverride(guild: Guild, actorId: string, override: PretensaoOverride): Promise<PretensaoConfig> {
    const config = await this.getConfig(guild);
    return this.saveConfig(guild, actorId, { ...config, override });
  }

  /** Pura — testável sem banco. */
  public isOpen(config: PretensaoConfig, now: Date = new Date()): boolean {
    if (config.override === "open") return true;
    if (config.override === "closed") return false;

    if (config.durationMinutes <= 0) return false;

    const { dayOfWeek, minuteOfDay } = getLocalMoment(now, config.utcOffsetHours);

    if (config.daysOfWeek.length > 0 && !config.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    const start = config.startMinute;
    const end = start + config.durationMinutes;

    if (end <= 24 * 60) {
      return minuteOfDay >= start && minuteOfDay < end;
    }
    // janela cruza a meia-noite (ex: começa 23:00, dura 180min -> termina 02:00)
    return minuteOfDay >= start || minuteOfDay < end - 24 * 60;
  }

  /**
   * Tenta registrar a pretensão de uma mensagem: `ignored` quando não é o canal configurado
   * ou o conteúdo não bate com nenhuma vaga (RP livre no canal não deve ser punido); `failed`
   * quando bate com uma vaga mas alguma regra impede (ficha, vila, janela fechada, vaga não
   * habilitada); `success` quando a vaga foi concedida de verdade.
   */
  public async attemptClaim(
    guild: Guild,
    message: { channelId: string; content: string; authorId: string }
  ): Promise<PretensaoClaimResult> {
    const config = await this.getConfig(guild);
    if (!config.channelId || message.channelId !== config.channelId) {
      return { kind: "ignored" };
    }

    const key = message.content.trim();
    if (!key) return { kind: "ignored" };

    const vaga = await this.findVagaCaseInsensitive(guild, key);
    if (!vaga) {
      return { kind: "ignored" };
    }

    if (!this.isOpen(config)) {
      return { kind: "failed", reason: "A pretensão está fechada no momento." };
    }

    if (!vaga.isActive || !vaga.pretensaoEnabled) {
      return { kind: "failed", reason: `A vaga **${vaga.name}** não está disponível pra pretensão no momento.` };
    }

    const character = await this.characters.getActiveCharacter(guild, message.authorId);
    if (!character) {
      return { kind: "failed", reason: "Você precisa ter uma ficha ativa pra pretender uma vaga. Use `.ficha criar <nome>`." };
    }

    try {
      const { rankBumped } = await this.vagas.grantVaga(guild, message.authorId, vaga.key, character.id);
      return { kind: "success", vagaName: vaga.name, rankBumped };
    } catch (error) {
      if (error instanceof DomainError) {
        return { kind: "failed", reason: error.message };
      }
      throw error;
    }
  }

  private async findVagaCaseInsensitive(guild: Guild, key: string) {
    const exact = await this.vagas.findVaga(guild, key);
    if (exact) return exact;

    const candidates = await this.vagas.listVagas(guild, { includeInactive: true, query: key });
    return candidates.find((vaga) => vaga.key.toLowerCase() === key.toLowerCase()) ?? null;
  }
}

function getLocalMoment(date: Date, utcOffsetHours: number): { dayOfWeek: number; minuteOfDay: number } {
  const shifted = new Date(date.getTime() + utcOffsetHours * 3_600_000);
  return { dayOfWeek: shifted.getUTCDay(), minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

function normalizeConfig(raw: unknown): PretensaoConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PRETENSAO_CONFIG };
  }

  const value = raw as Partial<PretensaoConfig>;

  return {
    channelId: typeof value.channelId === "string" ? value.channelId : null,
    daysOfWeek: Array.isArray(value.daysOfWeek)
      ? value.daysOfWeek.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6)
      : [],
    startMinute: typeof value.startMinute === "number" ? value.startMinute : DEFAULT_PRETENSAO_CONFIG.startMinute,
    durationMinutes:
      typeof value.durationMinutes === "number" ? value.durationMinutes : DEFAULT_PRETENSAO_CONFIG.durationMinutes,
    utcOffsetHours:
      typeof value.utcOffsetHours === "number" ? value.utcOffsetHours : DEFAULT_PRETENSAO_CONFIG.utcOffsetHours,
    override: value.override === "open" || value.override === "closed" ? value.override : "auto"
  };
}
