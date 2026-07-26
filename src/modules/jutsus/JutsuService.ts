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
import type { CharacterService, CharacterWithWorld } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import type { PericiaService } from "../pericias/PericiaService.js";

export class JutsuRuleError extends DomainError {}

const CHAKRA_COST_BY_RANK_KEY = "jutsuChakraCostByRank";
const XP_PER_USE_KEY = "jutsuXpPerUse";
const AUTO_SYNC_KEY = "jutsuAutoSyncEnabled";
const DEFAULT_XP_PER_USE = 4;

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
      data: { currentChakra: chakraAfter }
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
