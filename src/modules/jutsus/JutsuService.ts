import type { Guild, User } from "discord.js";

import {
  Prisma,
  type Character,
  type CharacterProgress,
  type CharacterJutsu,
  type JutsuDefinition,
  type JutsuUseLog,
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
  /** Rank do personagem exigido para aprender (chave de RankDefinition) */
  requiredRank?: string | null;
  /** Classificação canônica do jutsu: E, D, C, B, A ou S */
  jutsuRank?: string | null;
  chakraCost?: number;
  duration?: string | null;
  usageLimit?: number | null;
  requirements?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
}

export interface UpdateJutsuInput {
  name?: string;
  description?: string | null;
  type?: string | null;
  /** Rank do personagem exigido para aprender (chave de RankDefinition) */
  requiredRank?: string | null;
  /** Classificação canônica do jutsu: E, D, C, B, A ou S */
  jutsuRank?: string | null;
  chakraCost?: number;
  duration?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}

export interface JutsuOverview {
  totalCount: number;
  activeCount: number;
  learnedCount: number;
  characterName?: string;
  currentChakra?: number;
  maxChakra?: number;
}

export interface JutsuUseResult {
  character: Character;
  jutsu: JutsuWithRelations;
  log: JutsuUseLog;
  chakraBefore: number;
  chakraAfter: number;
  chakraMax: number;
}

export type ChakraAdjustMode = "set" | "add" | "full";

export interface ChakraAdjustmentResult {
  character: Character;
  progress: CharacterProgress;
  chakraBefore: number;
  chakraAfter: number;
  chakraMax: number;
}

interface ChakraState {
  progress: CharacterProgress;
  current: number;
  max: number;
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

    const chakraState = character ? await this.getChakraState(rpgGuild.id, character) : null;

    return {
      totalCount,
      activeCount,
      learnedCount,
      characterName: character?.name,
      currentChakra: chakraState?.current,
      maxChakra: chakraState?.max
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

  public async listJutsusPaged(
    guild: Guild,
    options: {
      skip?: number;
      take?: number;
      includeInactive?: boolean;
      typeKey?: string;     // "_" = sem filtro
      jutsuRank?: string;   // "_" = sem filtro
      nameSearch?: string;  // texto livre
    } = {}
  ): Promise<{ items: JutsuWithRelations[]; total: number }> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    // Resolver type filter (key → id)
    let typeId: string | undefined;
    if (options.typeKey && options.typeKey !== "_") {
      const type = await this.prisma.jutsuType.findFirst({
        where: { guildId: rpgGuild.id, key: options.typeKey }
      });
      if (!type) return { items: [], total: 0 };
      typeId = type.id;
    }

    const rank = options.jutsuRank && options.jutsuRank !== "_"
      ? options.jutsuRank.toUpperCase()
      : undefined;

    const where: Prisma.JutsuDefinitionWhereInput = {
      guildId: rpgGuild.id,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(typeId     ? { typeId }          : {}),
      ...(rank       ? { jutsuRank: rank } : {}),
      ...(options.nameSearch ? {
        OR: [
          { name: { contains: options.nameSearch, mode: "insensitive" } },
          { key:  { contains: options.nameSearch, mode: "insensitive" } }
        ]
      } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.jutsuDefinition.findMany({
        where,
        include: JUTSU_INCLUDE,
        orderBy: [{ jutsuRank: "asc" }, { name: "asc" }],
        skip: options.skip ?? 0,
        take: options.take
      }),
      this.prisma.jutsuDefinition.count({ where })
    ]);

    return { items, total };
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

  public async listKnownJutsusPaged(
    guild: Guild,
    user: User,
    options: { skip?: number; take?: number } = {}
  ): Promise<{ items: LearnedJutsuWithRelations[]; total: number }> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, user.id);

    if (!character) {
      return { items: [], total: 0 };
    }

    const where = { guildId: rpgGuild.id, characterId: character.id };

    const [items, total] = await Promise.all([
      this.prisma.characterJutsu.findMany({
        where,
        include: LEARNED_JUTSU_INCLUDE,
        orderBy: { learnedAt: "asc" },
        skip: options.skip ?? 0,
        take: options.take
      }),
      this.prisma.characterJutsu.count({ where })
    ]);

    return { items, total };
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
        jutsuRank: normalizeJutsuRank(input.jutsuRank),
        chakraCost: input.chakraCost ?? 0,
        duration: input.duration,
        usageLimit: input.usageLimit,
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
        jutsuRank: input.jutsuRank === undefined ? undefined : normalizeJutsuRank(input.jutsuRank),
        chakraCost: input.chakraCost,
        duration: input.duration,
        usageLimit: input.usageLimit,
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

  public async useJutsu(
    guild: Guild,
    user: User,
    identifier: string
  ): Promise<JutsuUseResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, user.id);

    if (!character) {
      throw new JutsuRuleError(["Você precisa ter uma ficha ativa para usar jutsus."]);
    }

    const jutsu = await this.findJutsuByIdentifier(guild, identifier);

    if (!jutsu) {
      throw new JutsuRuleError(["Não encontrei um jutsu ativo com esse nome ou chave."]);
    }

    const learned = await this.prisma.characterJutsu.findUnique({
      where: {
        characterId_jutsuId: {
          characterId: character.id,
          jutsuId: jutsu.id
        }
      }
    });

    if (!learned) {
      throw new JutsuRuleError([`**${character.name}** ainda não aprendeu **${jutsu.name}**.`]);
    }

    const chakraState = await this.getChakraState(rpgGuild.id, character);
    const chakraCost = Math.max(0, jutsu.chakraCost);

    if (chakraState.current < chakraCost) {
      throw new JutsuRuleError([
        `**${jutsu.name}** custa **${chakraCost}** de Chakra, mas **${character.name}** tem **${chakraState.current}/${chakraState.max}**.`
      ]);
    }

    const chakraAfter = chakraState.current - chakraCost;
    const progress = await this.prisma.characterProgress.update({
      where: { id: chakraState.progress.id },
      data: { currentChakra: chakraAfter }
    });
    const log = await this.prisma.jutsuUseLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId: character.id,
        jutsuId: jutsu.id,
        actorId: user.id,
        chakraCost,
        chakraBefore: chakraState.current,
        chakraAfter,
        metadata: {
          progressId: progress.id
        }
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: user.id,
      action: "jutsu.use",
      targetType: "JutsuUseLog",
      targetId: log.id,
      after: {
        characterId: character.id,
        jutsuId: jutsu.id,
        chakraCost,
        chakraBefore: chakraState.current,
        chakraAfter,
        chakraMax: chakraState.max
      }
    });

    return {
      character,
      jutsu,
      log,
      chakraBefore: chakraState.current,
      chakraAfter,
      chakraMax: chakraState.max
    };
  }

  public async adjustCharacterChakra(
    guild: Guild,
    actorId: string,
    targetUserId: string,
    input: { mode: ChakraAdjustMode; amount?: number; reason?: string }
  ): Promise<ChakraAdjustmentResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const character = await this.characters.findActiveByUser(guild, targetUserId);

    if (!character) {
      throw new JutsuRuleError(["Esse usuário precisa ter uma ficha ativa para ajustar Chakra."]);
    }

    const chakraState = await this.getChakraState(rpgGuild.id, character);
    const rawNext =
      input.mode === "full"
        ? chakraState.max
        : input.mode === "add"
          ? chakraState.current + (input.amount ?? 0)
          : input.amount ?? chakraState.current;
    const chakraAfter = clampChakra(rawNext, chakraState.max);
    const progress = await this.prisma.characterProgress.update({
      where: { id: chakraState.progress.id },
      data: { currentChakra: chakraAfter }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "jutsu.chakra.adjust",
      targetType: "CharacterProgress",
      targetId: progress.id,
      before: {
        characterId: character.id,
        targetUserId,
        currentChakra: chakraState.current,
        maxChakra: chakraState.max
      },
      after: {
        characterId: character.id,
        targetUserId,
        mode: input.mode,
        amount: input.amount,
        currentChakra: chakraAfter,
        maxChakra: chakraState.max
      },
      reason: input.reason
    });

    return {
      character,
      progress,
      chakraBefore: chakraState.current,
      chakraAfter,
      chakraMax: chakraState.max
    };
  }

  /** Formato compacto para listagem no catálogo — sem descrição para não estourar o embed */
  public formatJutsu(jutsu: JutsuWithRelations): string {
    const statParts = [
      jutsu.jutsuRank    ? `**[${jutsu.jutsuRank}]**`            : null,
      jutsu.type?.name   ? jutsu.type.name                        : "—",
      `⚡ ${jutsu.chakraCost}`,
      jutsu.requiredRank ? `Ninja: ${jutsu.requiredRank.name}+`  : null,
      jutsu.duration     ? jutsu.duration                         : null,
      jutsu.usageLimit   ? `${jutsu.usageLimit}x`                : null,
    ].filter(Boolean);

    return [
      `**${jutsu.name}** \`${jutsu.key}\``,
      statParts.join(" · ")
    ].join("\n");
  }

  /** Formato completo com descrição — usado em detalhes/busca */
  public formatJutsuFull(jutsu: JutsuWithRelations): string {
    const stats = [
      jutsu.jutsuRank    ? `Rank: **${jutsu.jutsuRank}**`         : null,
      jutsu.type?.name   ? `Tipo: **${jutsu.type.name}**`         : null,
      `Chakra: **${jutsu.chakraCost}**`,
      jutsu.requiredRank ? `Ninja: **${jutsu.requiredRank.name}+**` : null,
      jutsu.duration     ? `Duração: **${jutsu.duration}**`        : null,
      jutsu.usageLimit   ? `Usos: **${jutsu.usageLimit}x**`        : null,
    ].filter(Boolean).join(" | ");

    return [
      `**${jutsu.name}** \`${jutsu.key}\``,
      stats,
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

  private async getChakraState(guildId: string, character: Character): Promise<ChakraState> {
    const max = Math.max(0, Math.floor(this.characters.getAttributeValues(character).chakra ?? 0));
    const progress = await this.prisma.characterProgress.upsert({
      where: { characterId: character.id },
      update: {},
      create: {
        guildId,
        characterId: character.id,
        currentChakra: max
      }
    });
    const current = clampChakra(progress.currentChakra ?? max, max);

    if (progress.currentChakra !== current) {
      const updated = await this.prisma.characterProgress.update({
        where: { id: progress.id },
        data: { currentChakra: current }
      });

      return {
        progress: updated,
        current,
        max
      };
    }

    return {
      progress,
      current,
      max
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
    jutsuRank: jutsu.jutsuRank,
    chakraCost: jutsu.chakraCost,
    duration: jutsu.duration,
    usageLimit: jutsu.usageLimit,
    requirements: jutsu.requirements as Prisma.InputJsonValue,
    metadata: jutsu.metadata as Prisma.InputJsonValue,
    isActive: jutsu.isActive
  };
}

const VALID_JUTSU_RANKS = new Set(["E", "D", "C", "B", "A", "S"]);

function normalizeJutsuRank(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return VALID_JUTSU_RANKS.has(upper) ? upper : null;
}

function normalizeJutsuKey(value: string): string {
  return normalizeKey(value) ?? value.trim().toLowerCase().replace(/\s+/g, "_");
}

function clampChakra(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(value)));
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
