import type { Guild } from "discord.js";

import { env } from "../../config/env.js";
import { DomainError } from "../../core/errors.js";
import * as f from "../../core/formula/builders.js";
import { evaluateFormula, safeParseFormula, type FormulaNode } from "../../core/formula/index.js";
import {
  Prisma,
  type CharacterJutsu,
  type CharacterPericia,
  type JutsuDefinition,
  type JutsuType,
  type PrismaClient
} from "../../generated/prisma/client.js";
import {
  flattenScopeSelection,
  isChannelInScope,
  parseScopeSelection,
  type ScopeSelection
} from "../../services/channelScope.js";
import type { CharacterService, CharacterWithWorld } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import type { PericiaService } from "../pericias/PericiaService.js";

export class JutsuRuleError extends DomainError {}

const CHAKRA_COST_BY_RANK_KEY = "jutsuChakraCostByRank";
const XP_PER_USE_KEY = "jutsuXpPerUse";
const AUTO_SYNC_KEY = "jutsuAutoSyncEnabled";
const MEDITATION_CONFIG_KEY = "meditationConfig";
const NARRATION_SCOPE_KEY = "jutsuNarrationChannelIds";
const MEDITATION_SCOPE_KEY = "meditationChannelIds";
const DEFAULT_XP_PER_USE = 4;

export type MeditationIntervalUnit = "minute" | "hour";

export interface MeditationConfig {
  ratePercent: number;
  /** Ex: ratePercent=2, intervalAmount=5, intervalUnit="minute" -> "2% a cada 5 minutos". */
  intervalAmount: number;
  intervalUnit: MeditationIntervalUnit;
}

/** Só usada até o servidor configurar a própria taxa — totalmente substituível. */
const DEFAULT_MEDITATION_CONFIG: MeditationConfig = { ratePercent: 10, intervalAmount: 1, intervalUnit: "hour" };
const INTERVAL_UNIT_MS: Record<MeditationIntervalUnit, number> = { minute: 60_000, hour: 3_600_000 };

export interface MeditateResult {
  recovered: number;
  chakraBefore: number;
  chakraAfter: number;
  maxChakra: number;
  alreadyFull: boolean;
}

/** Só usada quando o servidor ainda não configurou nenhuma tabela — totalmente substituível. */
const DEFAULT_CHAKRA_COST_FORMULA: FormulaNode = f.lookup(
  "rank",
  { D: 30, C: 50, B: 70, A: 100, S: 200 },
  f.constant(0)
);

interface ExternalCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface ExternalJutsu {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  element: string | null;
  rank: string | null;
  requirements: string | null;
  image_url: string | null;
  category_id: string | null;
}

export interface SyncResult {
  typesCreated: number;
  typesUpdated: number;
  jutsusCreated: number;
  jutsusUpdated: number;
}

export interface UseJutsuResult {
  jutsu: JutsuDefinition;
  cost: number;
  chakraBefore: number;
  chakraAfter: number;
  periciaGrant: CharacterPericia | null;
}

export class JutsuService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly characters: CharacterService,
    private readonly pericias: PericiaService
  ) {}

  // ─── Sincronização com o site Mundo Ninja ─────────────────────────────────

  public async syncFromSource(guild: Guild, actorId: string): Promise<SyncResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const { categories, jutsus } = await fetchExternalJutsuData();

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const usedCategoryIds = [...new Set(jutsus.map((j) => j.category_id).filter((id): id is string => !!id))];

    let typesCreated = 0;
    let typesUpdated = 0;
    const typeIdByExternalCategory = new Map<string, string>();

    for (const categoryId of usedCategoryIds) {
      const category = categoryMap.get(categoryId);
      if (!category) continue;

      const existing = await this.prisma.jutsuType.findUnique({
        where: { guildId_key: { guildId: rpgGuild.id, key: category.slug } }
      });

      const saved = await this.prisma.jutsuType.upsert({
        where: { guildId_key: { guildId: rpgGuild.id, key: category.slug } },
        update: { name: category.name, description: category.description },
        create: {
          guildId: rpgGuild.id,
          key: category.slug,
          name: category.name,
          description: category.description
        }
      });

      typeIdByExternalCategory.set(categoryId, saved.id);
      if (existing) typesUpdated += 1;
      else typesCreated += 1;
    }

    let jutsusCreated = 0;
    let jutsusUpdated = 0;

    for (const jutsu of jutsus) {
      const typeId = jutsu.category_id ? (typeIdByExternalCategory.get(jutsu.category_id) ?? null) : null;

      const existing = await this.prisma.jutsuDefinition.findUnique({
        where: { guildId_externalId: { guildId: rpgGuild.id, externalId: jutsu.id } }
      });

      const data = {
        name: jutsu.name,
        description: jutsu.description,
        typeId,
        jutsuRank: jutsu.rank,
        element: jutsu.element,
        requirements: jutsu.requirements,
        imageUrl: jutsu.image_url
      };

      await this.prisma.jutsuDefinition.upsert({
        where: { guildId_externalId: { guildId: rpgGuild.id, externalId: jutsu.id } },
        update: data,
        create: { guildId: rpgGuild.id, key: jutsu.slug, externalId: jutsu.id, ...data }
      });

      if (existing) jutsusUpdated += 1;
      else jutsusCreated += 1;
    }

    const result: SyncResult = { typesCreated, typesUpdated, jutsusCreated, jutsusUpdated };

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "jutsu.sync",
      targetType: "JutsuDefinition",
      after: result as unknown as Prisma.InputJsonObject
    });

    return result;
  }

  public async isAutoSyncEnabled(guild: Guild): Promise<boolean> {
    const value = await this.guildConfig.getSetting(guild, AUTO_SYNC_KEY);
    return value === true;
  }

  public async setAutoSyncEnabled(guild: Guild, actorId: string, enabled: boolean): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: AUTO_SYNC_KEY,
      label: "Sincronização automática de jutsus",
      description: "Se ativado, o bot re-sincroniza periodicamente o catálogo do site Mundo Ninja.",
      value: enabled,
      valueType: "BOOLEAN",
      isPublic: false
    });
  }

  // ─── Catálogo ──────────────────────────────────────────────────────────────

  public async listTypes(guild: Guild, options: { includeInactive?: boolean } = {}): Promise<JutsuType[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.jutsuType.findMany({
      where: { guildId: rpgGuild.id, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" }
    });
  }

  public async findType(guild: Guild, key: string): Promise<JutsuType | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.jutsuType.findUnique({ where: { guildId_key: { guildId: rpgGuild.id, key } } });
  }

  public async setTypePericia(
    guild: Guild,
    actorId: string,
    typeKey: string,
    periciaKey: string | null
  ): Promise<JutsuType> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const type = await this.findType(guild, typeKey);
    if (!type) {
      throw new JutsuRuleError(`Não encontrei o tipo de jutsu \`${typeKey}\`.`);
    }

    let periciaId: string | null = null;
    if (periciaKey) {
      const pericia = await this.pericias.findPericia(guild, periciaKey);
      if (!pericia) {
        throw new JutsuRuleError(`Não encontrei a perícia \`${periciaKey}\`.`);
      }
      periciaId = pericia.id;
    }

    const updated = await this.prisma.jutsuType.update({ where: { id: type.id }, data: { periciaId } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "jutsu.type.pericia.update",
      targetType: "JutsuType",
      targetId: type.id,
      after: { periciaId }
    });

    return updated;
  }

  public async listJutsus(
    guild: Guild,
    options: { includeInactive?: boolean; typeKey?: string } = {}
  ): Promise<JutsuDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const type = options.typeKey ? await this.findType(guild, options.typeKey) : null;

    return this.prisma.jutsuDefinition.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true }),
        ...(type ? { typeId: type.id } : {})
      },
      orderBy: { name: "asc" }
    });
  }

  public async findJutsu(guild: Guild, key: string): Promise<JutsuDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.jutsuDefinition.findUnique({ where: { guildId_key: { guildId: rpgGuild.id, key } } });
  }

  /**
   * Casamento tolerante por nome/chave, usado pela detecção narrada de `[jutsu]` no chat —
   * texto livre nunca vai bater 100% certo com um nome longo, então aceita match parcial em
   * vez de exigir a chave exata. Sem match nenhum, retorna null (o chamador deve ficar em
   * silêncio, não travar a narrativa do jogador com erro).
   */
  public async findJutsuFuzzy(guild: Guild, rawText: string): Promise<JutsuDefinition | null> {
    const needle = normalizeForMatch(rawText);
    if (!needle) return null;

    const jutsus = await this.listJutsus(guild);

    const exact = jutsus.find(
      (jutsu) => normalizeForMatch(jutsu.name) === needle || normalizeForMatch(jutsu.key) === needle
    );
    if (exact) return exact;

    return (
      jutsus.find((jutsu) => {
        const name = normalizeForMatch(jutsu.name);
        return name.includes(needle) || needle.includes(name);
      }) ?? null
    );
  }

  // ─── Custo de Chakra por rank ──────────────────────────────────────────────

  public async getChakraCostFormula(guild: Guild): Promise<FormulaNode> {
    const raw = await this.guildConfig.getSetting(guild, CHAKRA_COST_BY_RANK_KEY);
    return safeParseFormula(raw) ?? DEFAULT_CHAKRA_COST_FORMULA;
  }

  public async setChakraCostByRank(
    guild: Guild,
    actorId: string,
    table: Record<string, number>
  ): Promise<FormulaNode> {
    const formula = f.lookup("rank", table, f.constant(0));

    await this.guildConfig.setSetting(guild, actorId, {
      key: CHAKRA_COST_BY_RANK_KEY,
      label: "Custo de Chakra por rank de jutsu",
      description: "Fórmula (motor de regras) que converte o rank do jutsu em custo de Chakra.",
      value: formula as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: true
    });

    return formula;
  }

  public getChakraCostForRank(formula: FormulaNode, rank: string | null): number {
    return Math.max(0, Math.round(evaluateFormula(formula, { rank: rank ?? "" })));
  }

  public async getXpPerUse(guild: Guild): Promise<number> {
    const raw = await this.guildConfig.getSetting(guild, XP_PER_USE_KEY);
    return typeof raw === "number" && raw >= 0 ? raw : DEFAULT_XP_PER_USE;
  }

  public async setXpPerUse(guild: Guild, actorId: string, amount: number): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: XP_PER_USE_KEY,
      label: "XP de perícia por uso de jutsu",
      description: "Quanto XP a perícia vinculada ao tipo do jutsu ganha a cada uso.",
      value: amount,
      valueType: "NUMBER",
      isPublic: false
    });
  }

  // ─── Meditação (recuperação de chakra) ─────────────────────────────────────

  public async getMeditationConfig(guild: Guild): Promise<MeditationConfig> {
    const raw = await this.guildConfig.getSetting(guild, MEDITATION_CONFIG_KEY);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const { ratePercent, intervalAmount, intervalUnit } = raw as Record<string, unknown>;
      if (
        typeof ratePercent === "number" &&
        ratePercent > 0 &&
        typeof intervalAmount === "number" &&
        intervalAmount > 0 &&
        (intervalUnit === "minute" || intervalUnit === "hour")
      ) {
        return { ratePercent, intervalAmount, intervalUnit };
      }
    }
    return DEFAULT_MEDITATION_CONFIG;
  }

  public async setMeditationConfig(guild: Guild, actorId: string, config: MeditationConfig): Promise<void> {
    if (!(config.ratePercent > 0)) {
      throw new JutsuRuleError("O percentual precisa ser maior que 0.");
    }
    if (!(config.intervalAmount > 0)) {
      throw new JutsuRuleError("A quantidade do intervalo precisa ser maior que 0.");
    }

    await this.guildConfig.setSetting(guild, actorId, {
      key: MEDITATION_CONFIG_KEY,
      label: "Regeneração de Chakra por meditação",
      description: "Percentual do chakra total recuperado a cada X minutos/horas ao usar .meditar.",
      value: config as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: true
    });
  }

  /**
   * Recupera chakra proporcional ao tempo real desde a última mudança confiável
   * (chakraSyncedAt, atualizado tanto aqui quanto em useJutsu). Sem sessão pra "começar"
   * ou "parar" — é só matemática de tempo decorrido, então chamar o comando de novo cedo
   * demais não rouba nem ganha nada (só continua contando a partir do mesmo ponto).
   */
  public async meditate(guild: Guild, character: CharacterWithWorld): Promise<MeditateResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const view = await this.characters.getCharacterView(guild, character);
    const maxChakra = view.chakra;

    const progress = await this.prisma.characterProgress.upsert({
      where: { characterId: character.id },
      update: {},
      create: { guildId: rpgGuild.id, characterId: character.id }
    });

    if (progress.currentChakra === null || progress.currentChakra >= maxChakra) {
      return { recovered: 0, chakraBefore: maxChakra, chakraAfter: maxChakra, maxChakra, alreadyFull: true };
    }

    const config = await this.getMeditationConfig(guild);
    const now = new Date();
    const since = progress.chakraSyncedAt ?? progress.updatedAt;
    const elapsedMs = Math.max(0, now.getTime() - since.getTime());
    const intervalMs = config.intervalAmount * INTERVAL_UNIT_MS[config.intervalUnit];
    const elapsedUnits = elapsedMs / intervalMs;

    const chakraBefore = progress.currentChakra;
    const recoveredRaw = Math.floor(maxChakra * (config.ratePercent / 100) * elapsedUnits);
    const chakraAfter = Math.min(maxChakra, chakraBefore + Math.max(0, recoveredRaw));
    const recovered = chakraAfter - chakraBefore;

    // Só marca o "relógio" como reiniciado se de fato recuperou algo — senão, chamar o
    // comando repetidas vezes cedo demais reseta a contagem e nunca acumula tempo suficiente.
    if (recovered > 0) {
      await this.prisma.characterProgress.update({
        where: { id: progress.id },
        data: { currentChakra: chakraAfter, chakraSyncedAt: now }
      });
    }

    return { recovered, chakraBefore, chakraAfter, maxChakra, alreadyFull: chakraAfter >= maxChakra };
  }

  // ─── Escopo por local (categoria/canal/fórum/thread) ───────────────────────

  private async getScopeSelection(guild: Guild, key: string): Promise<ScopeSelection> {
    const raw = await this.guildConfig.getSetting(guild, key);
    return parseScopeSelection(raw);
  }

  /** Substitui só um grupo (canais, categorias, threads ou fóruns) — cada select do
   * `.setar` mexe no próprio grupo sem apagar os outros três. */
  private async setScopeGroup(
    guild: Guild,
    actorId: string,
    key: string,
    label: string,
    description: string,
    group: keyof ScopeSelection,
    ids: string[]
  ): Promise<ScopeSelection> {
    const current = await this.getScopeSelection(guild, key);
    const next: ScopeSelection = { ...current, [group]: ids };

    await this.guildConfig.setSetting(guild, actorId, {
      key,
      label,
      description,
      value: next as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: false
    });

    return next;
  }

  public getNarrationScope(guild: Guild): Promise<ScopeSelection> {
    return this.getScopeSelection(guild, NARRATION_SCOPE_KEY);
  }

  public setNarrationScopeGroup(guild: Guild, actorId: string, group: keyof ScopeSelection, ids: string[]): Promise<ScopeSelection> {
    return this.setScopeGroup(
      guild,
      actorId,
      NARRATION_SCOPE_KEY,
      "Onde o [jutsu] narrado funciona",
      "Categorias, canais, fóruns e threads onde a detecção de [jutsu] no chat funciona.",
      group,
      ids
    );
  }

  /** Vazio = liberado em qualquer lugar (não muda o comportamento de quem nunca configurou). */
  public async isNarrationChannelAllowed(guild: Guild, channelId: string): Promise<boolean> {
    const allowed = flattenScopeSelection(await this.getNarrationScope(guild));
    if (allowed.length === 0) return true;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    return isChannelInScope(channel, allowed);
  }

  public getMeditationScope(guild: Guild): Promise<ScopeSelection> {
    return this.getScopeSelection(guild, MEDITATION_SCOPE_KEY);
  }

  public setMeditationScopeGroup(guild: Guild, actorId: string, group: keyof ScopeSelection, ids: string[]): Promise<ScopeSelection> {
    return this.setScopeGroup(
      guild,
      actorId,
      MEDITATION_SCOPE_KEY,
      "Onde a meditação funciona",
      "Categorias, canais, fóruns e threads onde .meditar pode ser usado.",
      group,
      ids
    );
  }

  /** Vazio = liberado em qualquer lugar (não muda o comportamento de quem nunca configurou). */
  public async isMeditationChannelAllowed(guild: Guild, channelId: string): Promise<boolean> {
    const allowed = flattenScopeSelection(await this.getMeditationScope(guild));
    if (allowed.length === 0) return true;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    return isChannelInScope(channel, allowed);
  }

  // ─── Ficha: aprender e usar ─────────────────────────────────────────────────

  public async listLearnedJutsus(character: CharacterWithWorld): Promise<(CharacterJutsu & { jutsu: JutsuDefinition })[]> {
    return this.prisma.characterJutsu.findMany({
      where: { characterId: character.id },
      include: { jutsu: true },
      orderBy: { learnedAt: "asc" }
    });
  }

  public async learnJutsu(guild: Guild, character: CharacterWithWorld, jutsuKey: string): Promise<CharacterJutsu> {
    const jutsu = await this.findJutsu(guild, jutsuKey);
    if (!jutsu || !jutsu.isActive) {
      throw new JutsuRuleError(`Não encontrei o jutsu \`${jutsuKey}\` (ou ele está desativado).`);
    }

    const already = await this.prisma.characterJutsu.findUnique({
      where: { characterId_jutsuId: { characterId: character.id, jutsuId: jutsu.id } }
    });
    if (already) {
      throw new JutsuRuleError(`Você já aprendeu **${jutsu.name}**.`);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const created = await this.prisma.characterJutsu.create({
      data: { guildId: rpgGuild.id, characterId: character.id, jutsuId: jutsu.id }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: character.userId,
      action: "jutsu.learn",
      targetType: "CharacterJutsu",
      targetId: created.id,
      after: { jutsu: jutsu.key }
    });

    return created;
  }

  public async useJutsu(
    guild: Guild,
    actorId: string,
    character: CharacterWithWorld,
    jutsuKey: string
  ): Promise<UseJutsuResult> {
    const jutsu = await this.findJutsu(guild, jutsuKey);
    if (!jutsu || !jutsu.isActive) {
      throw new JutsuRuleError(`Não encontrei o jutsu \`${jutsuKey}\` (ou ele está desativado).`);
    }

    const learned = await this.prisma.characterJutsu.findUnique({
      where: { characterId_jutsuId: { characterId: character.id, jutsuId: jutsu.id } }
    });
    if (!learned) {
      throw new JutsuRuleError(`Você ainda não aprendeu **${jutsu.name}**. Use \`.jutsu aprender ${jutsu.key}\`.`);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const costFormula = await this.getChakraCostFormula(guild);
    const cost = this.getChakraCostForRank(costFormula, jutsu.jutsuRank);

    const progress = await this.prisma.characterProgress.upsert({
      where: { characterId: character.id },
      update: {},
      create: { guildId: rpgGuild.id, characterId: character.id }
    });

    let chakraBefore = progress.currentChakra;
    if (chakraBefore === null) {
      const view = await this.characters.getCharacterView(guild, character);
      chakraBefore = view.chakra;
    }

    if (chakraBefore < cost) {
      throw new JutsuRuleError(
        `Chakra insuficiente: **${jutsu.name}** custa ${cost}, você tem ${chakraBefore}.`
      );
    }

    const chakraAfter = chakraBefore - cost;

    await this.prisma.characterProgress.update({
      where: { id: progress.id },
      // chakraSyncedAt marca "última vez que currentChakra foi um número confiável" — a
      // meditação usa isso pra saber quanto tempo real se passou desde então (ver meditate()).
      data: { currentChakra: chakraAfter, chakraSyncedAt: new Date() }
    });

    await this.prisma.jutsuUseLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        jutsuId: jutsu.id,
        actorId,
        chakraCost: cost,
        chakraBefore,
        chakraAfter
      }
    });

    const periciaGrant = await this.grantPericiaXpForUse(guild, actorId, character, jutsu);

    return { jutsu, cost, chakraBefore, chakraAfter, periciaGrant };
  }

  private async grantPericiaXpForUse(
    guild: Guild,
    actorId: string,
    character: CharacterWithWorld,
    jutsu: JutsuDefinition
  ): Promise<CharacterPericia | null> {
    if (!jutsu.typeId) return null;

    const type = await this.prisma.jutsuType.findUnique({ where: { id: jutsu.typeId } });
    if (!type?.periciaId) return null;

    const pericia = await this.prisma.periciaDefinition.findUnique({ where: { id: type.periciaId } });
    if (!pericia || !pericia.isActive) return null;

    const amount = await this.getXpPerUse(guild);
    if (amount <= 0) return null;

    return this.pericias.grantXp(guild, actorId, character, pericia.key, amount, `Uso de ${jutsu.name}`);
  }
}

async function fetchExternalJutsuData(): Promise<{ categories: ExternalCategory[]; jutsus: ExternalJutsu[] }> {
  const headers = {
    apikey: env.JUTSU_SOURCE_ANON_KEY,
    Authorization: `Bearer ${env.JUTSU_SOURCE_ANON_KEY}`
  };

  const [categoriesRes, jutsusRes] = await Promise.all([
    fetch(`${env.JUTSU_SOURCE_URL}/rest/v1/categories?select=id,name,slug,description`, { headers }),
    fetch(
      `${env.JUTSU_SOURCE_URL}/rest/v1/jutsus?select=id,name,slug,description,element,rank,requirements,image_url,category_id`,
      { headers }
    )
  ]);

  if (!categoriesRes.ok || !jutsusRes.ok) {
    throw new JutsuRuleError("Não consegui buscar os jutsus do site agora. Tente novamente mais tarde.");
  }

  const [categories, jutsus] = await Promise.all([categoriesRes.json(), jutsusRes.json()]);
  return { categories, jutsus };
}

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeForMatch(text: string): string {
  return text.normalize("NFD").replace(COMBINING_DIACRITICS, "").toLowerCase().trim();
}
