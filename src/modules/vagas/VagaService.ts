import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type {
  Character,
  JutsuDefinition,
  Prisma,
  PrismaClient,
  RankDefinition,
  VagaCategory,
  VagaDefinition,
  VagaHistory,
  VagaHistoryAction,
  VagaOccupant,
  Village
} from "../../generated/prisma/client.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import { normalizeBonuses } from "../world/WorldConfigService.js";

export class VagaRuleError extends DomainError {}

const VAGA_INCLUDE = {
  category: true,
  initialRank: true,
  villageRestriction: true,
  initialJutsus: true
} as const;

export type VagaWithRelations = VagaDefinition & {
  category: VagaCategory;
  initialRank: RankDefinition | null;
  villageRestriction: Village | null;
  initialJutsus: JutsuDefinition[];
};

export type VagaOccupantWithCharacter = VagaOccupant & { character: Character };
export type VagaHistoryWithRelations = VagaHistory & { vaga: VagaDefinition; character: Character };

export interface VagaCategoryInput {
  name: string;
  maxPerPerson?: number | null;
  sortOrder?: number;
}

export interface VagaDefinitionInput {
  key: string;
  name: string;
  categoryName: string;
  description?: string;
}

export interface VagaDefinitionUpdate {
  name?: string;
  description?: string;
  bonuses?: Record<string, number>;
  memberLimit?: number;
  isActive?: boolean;
}

export interface GrantResult {
  occupant: VagaOccupantWithCharacter;
  rankBumped: boolean;
}

const HISTORY_LIMIT = 20;

export class VagaService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService
  ) {}

  // ─── Categorias ──────────────────────────────────────────────────────────

  public async listCategories(guild: Guild): Promise<VagaCategory[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.vagaCategory.findMany({
      where: { guildId: rpgGuild.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findCategory(guild: Guild, name: string): Promise<VagaCategory | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.vagaCategory.findUnique({ where: { guildId_name: { guildId: rpgGuild.id, name } } });
  }

  public async getCategoryById(id: string): Promise<VagaCategory | null> {
    return this.prisma.vagaCategory.findUnique({ where: { id } });
  }

  public async createCategory(guild: Guild, actorId: string, input: VagaCategoryInput): Promise<VagaCategory> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findCategory(guild, input.name)) {
      throw new VagaRuleError(`Já existe uma categoria de vaga chamada **${input.name}**.`);
    }

    const created = await this.prisma.vagaCategory.create({
      data: {
        guildId: rpgGuild.id,
        name: input.name,
        maxPerPerson: input.maxPerPerson ?? null,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.category.create",
      targetType: "VagaCategory",
      targetId: created.id,
      after: { name: created.name }
    });

    return created;
  }

  public async setCategoryMaxPerPerson(
    guild: Guild,
    actorId: string,
    categoryId: string,
    maxPerPerson: number | null
  ): Promise<VagaCategory> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    const updated = await this.prisma.vagaCategory.update({
      where: { id: categoryId },
      data: { maxPerPerson }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.category.limit.update",
      targetType: "VagaCategory",
      targetId: categoryId,
      after: { maxPerPerson }
    });

    return updated;
  }

  // ─── Vagas (definição) ───────────────────────────────────────────────────

  public async listVagas(
    guild: Guild,
    options: { includeInactive?: boolean; categoryId?: string; query?: string } = {}
  ): Promise<VagaWithRelations[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.vagaDefinition.findMany({
      where: {
        guildId: rpgGuild.id,
        ...(options.includeInactive ? {} : { isActive: true }),
        ...(options.categoryId ? { categoryId: options.categoryId } : {}),
        ...(options.query
          ? {
              OR: [
                { name: { contains: options.query, mode: "insensitive" } },
                { key: { contains: options.query, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: VAGA_INCLUDE,
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }]
    });
  }

  public async findVaga(guild: Guild, key: string): Promise<VagaWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.vagaDefinition.findUnique({
      where: { guildId_key: { guildId: rpgGuild.id, key } },
      include: VAGA_INCLUDE
    });
  }

  public async getVagaById(id: string): Promise<VagaWithRelations | null> {
    return this.prisma.vagaDefinition.findUnique({ where: { id }, include: VAGA_INCLUDE });
  }

  public async createVaga(guild: Guild, actorId: string, input: VagaDefinitionInput): Promise<VagaWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findVaga(guild, input.key)) {
      throw new VagaRuleError(`Já existe uma vaga com o ID \`${input.key}\`.`);
    }

    const category = await this.findCategory(guild, input.categoryName);
    if (!category) {
      throw new VagaRuleError(`Não encontrei a categoria **${input.categoryName}**. Crie com \`.vagas addcat\`.`);
    }

    const created = await this.prisma.vagaDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key: input.key,
        name: input.name,
        categoryId: category.id,
        description: input.description
      },
      include: VAGA_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.create",
      targetType: "VagaDefinition",
      targetId: created.id,
      after: { key: created.key, name: created.name }
    });

    return created;
  }

  public async updateVaga(
    guild: Guild,
    actorId: string,
    key: string,
    input: VagaDefinitionUpdate
  ): Promise<VagaWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVaga(guild, key);
    if (!current) return null;

    const updated = await this.prisma.vagaDefinition.update({
      where: { id: current.id },
      data: {
        name: input.name,
        description: input.description,
        bonuses: input.bonuses ? (normalizeBonuses(input.bonuses) as unknown as Prisma.InputJsonValue) : undefined,
        memberLimit: input.memberLimit,
        isActive: input.isActive
      },
      include: VAGA_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.update",
      targetType: "VagaDefinition",
      targetId: updated.id
    });

    return updated;
  }

  public async setInitialRank(guild: Guild, actorId: string, key: string, rankId: string | null): Promise<VagaWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVaga(guild, key);
    if (!current) return null;

    if (rankId) {
      const rank = await this.prisma.rankDefinition.findUnique({ where: { id: rankId } });
      if (!rank || rank.guildId !== rpgGuild.id) {
        throw new VagaRuleError("Rank inválido.");
      }
    }

    const updated = await this.prisma.vagaDefinition.update({
      where: { id: current.id },
      data: { initialRankId: rankId },
      include: VAGA_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.initialRank.update",
      targetType: "VagaDefinition",
      targetId: updated.id,
      after: { rankId }
    });

    return updated;
  }

  public async setVillageRestriction(
    guild: Guild,
    actorId: string,
    key: string,
    villageId: string | null
  ): Promise<VagaWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVaga(guild, key);
    if (!current) return null;

    if (villageId) {
      const village = await this.prisma.village.findUnique({ where: { id: villageId } });
      if (!village || village.guildId !== rpgGuild.id) {
        throw new VagaRuleError("Vila inválida.");
      }
    }

    const updated = await this.prisma.vagaDefinition.update({
      where: { id: current.id },
      data: { villageRestrictionId: villageId },
      include: VAGA_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.villageRestriction.update",
      targetType: "VagaDefinition",
      targetId: updated.id,
      after: { villageId }
    });

    return updated;
  }

  /** Substitui a lista inteira de jutsus iniciais da vaga (mesmo espírito dos grupos de escopo do .setar). */
  public async setInitialJutsus(guild: Guild, actorId: string, key: string, jutsuIds: string[]): Promise<VagaWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVaga(guild, key);
    if (!current) return null;

    const updated = await this.prisma.vagaDefinition.update({
      where: { id: current.id },
      data: { initialJutsus: { set: jutsuIds.map((id) => ({ id })) } },
      include: VAGA_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.initialJutsus.update",
      targetType: "VagaDefinition",
      targetId: updated.id,
      after: { count: jutsuIds.length }
    });

    return updated;
  }

  /** Vínculo é só referência/organização entre vagas — guarda a key das vagas ligadas. */
  public async setLinkedVagas(guild: Guild, actorId: string, key: string, linkedKeys: string[]): Promise<VagaWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVaga(guild, key);
    if (!current) return null;

    const filtered = linkedKeys.filter((linkedKey) => linkedKey !== key);

    const updated = await this.prisma.vagaDefinition.update({
      where: { id: current.id },
      data: { linkedVagaKeys: filtered as unknown as Prisma.InputJsonValue },
      include: VAGA_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.linkedVagas.update",
      targetType: "VagaDefinition",
      targetId: updated.id,
      after: { linkedKeys: filtered }
    });

    return updated;
  }

  public getLinkedVagaKeys(vaga: VagaDefinition): string[] {
    return parseStringArray(vaga.linkedVagaKeys);
  }

  public async deleteVaga(guild: Guild, actorId: string, key: string): Promise<VagaDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findVaga(guild, key);
    if (!current) return null;

    await this.prisma.vagaDefinition.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "vaga.delete",
      targetType: "VagaDefinition",
      targetId: current.id,
      before: { key: current.key, name: current.name }
    });

    return current;
  }

  // ─── Ocupação ────────────────────────────────────────────────────────────

  public async listOccupants(vagaId: string): Promise<VagaOccupantWithCharacter[]> {
    return this.prisma.vagaOccupant.findMany({
      where: { vagaId },
      include: { character: true },
      orderBy: { createdAt: "asc" }
    });
  }

  public async listCharacterVagas(characterId: string): Promise<(VagaOccupant & { vaga: VagaWithRelations })[]> {
    return this.prisma.vagaOccupant.findMany({
      where: { characterId },
      include: { vaga: { include: VAGA_INCLUDE } },
      orderBy: { createdAt: "asc" }
    });
  }

  public async countOfficialOccupants(vagaId: string): Promise<number> {
    return this.prisma.vagaOccupant.count({ where: { vagaId, isExtra: false } });
  }

  private async countOfficialForCategory(characterId: string, categoryId: string): Promise<number> {
    return this.prisma.vagaOccupant.count({
      where: { characterId, isExtra: false, vaga: { categoryId } }
    });
  }

  public async grantVaga(
    guild: Guild,
    actorId: string,
    vagaKey: string,
    characterId: string,
    options: { extra?: boolean } = {}
  ): Promise<GrantResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const isExtra = options.extra ?? false;

    const vaga = await this.findVaga(guild, vagaKey);
    if (!vaga || !vaga.isActive) {
      throw new VagaRuleError(`Não encontrei a vaga \`${vagaKey}\` (ou ela está desativada).`);
    }

    const character = await this.prisma.character.findUnique({ where: { id: characterId }, include: { rank: true } });
    if (!character) {
      throw new VagaRuleError("Personagem não encontrado.");
    }

    const existing = await this.prisma.vagaOccupant.findUnique({
      where: { vagaId_characterId_isExtra: { vagaId: vaga.id, characterId, isExtra } }
    });
    if (existing) {
      throw new VagaRuleError(`**${character.name}** já ocupa a vaga **${vaga.name}**${isExtra ? " (extra)" : ""}.`);
    }

    if (!isExtra) {
      if (vaga.memberLimit > 0) {
        const officialCount = await this.countOfficialOccupants(vaga.id);
        if (officialCount >= vaga.memberLimit) {
          throw new VagaRuleError(`A vaga **${vaga.name}** já atingiu o limite de ${vaga.memberLimit} ocupante(s).`);
        }
      }
      if (vaga.category.maxPerPerson !== null) {
        const personCount = await this.countOfficialForCategory(characterId, vaga.categoryId);
        if (personCount >= vaga.category.maxPerPerson) {
          throw new VagaRuleError(
            `**${character.name}** já tem o máximo de ${vaga.category.maxPerPerson} vaga(s) na categoria **${vaga.category.name}**.`
          );
        }
      }
    }

    if (vaga.villageRestrictionId && character.villageId !== vaga.villageRestrictionId) {
      throw new VagaRuleError(
        `A vaga **${vaga.name}** é restrita à vila **${vaga.villageRestriction?.name ?? "?"}** — ${character.name} não pertence a ela.`
      );
    }

    const occupant = await this.prisma.vagaOccupant.create({
      data: { guildId: rpgGuild.id, vagaId: vaga.id, characterId, isExtra, grantedBy: actorId },
      include: { character: true }
    });

    let rankBumped = false;
    if (vaga.initialRankId && vaga.initialRank) {
      const currentSortOrder = character.rank?.sortOrder ?? -Infinity;
      if (vaga.initialRank.sortOrder > currentSortOrder) {
        await this.prisma.character.update({ where: { id: characterId }, data: { rankId: vaga.initialRankId } });
        rankBumped = true;
      }
    }

    await this.writeHistory(rpgGuild.id, vaga.id, characterId, actorId, "GRANT", isExtra);

    return { occupant, rankBumped };
  }

  /** Remove todas as ocupações (normal e extra) dessa vaga pra essa pessoa. */
  public async revokeVaga(guild: Guild, actorId: string, vagaKey: string, characterId: string): Promise<number> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const vaga = await this.findVaga(guild, vagaKey);
    if (!vaga) {
      throw new VagaRuleError(`Não encontrei a vaga \`${vagaKey}\`.`);
    }

    const occupancies = await this.prisma.vagaOccupant.findMany({ where: { vagaId: vaga.id, characterId } });
    if (occupancies.length === 0) {
      return 0;
    }

    await this.prisma.vagaOccupant.deleteMany({ where: { vagaId: vaga.id, characterId } });

    for (const occupancy of occupancies) {
      await this.writeHistory(rpgGuild.id, vaga.id, characterId, actorId, "REVOKE", occupancy.isExtra);
    }

    return occupancies.length;
  }

  /** Remove todas as vagas de uma pessoa, em todas as categorias. */
  public async resetPerson(guild: Guild, actorId: string, characterId: string): Promise<number> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const occupancies = await this.prisma.vagaOccupant.findMany({ where: { guildId: rpgGuild.id, characterId } });
    if (occupancies.length === 0) {
      return 0;
    }

    await this.prisma.vagaOccupant.deleteMany({ where: { guildId: rpgGuild.id, characterId } });

    for (const occupancy of occupancies) {
      await this.writeHistory(rpgGuild.id, occupancy.vagaId, characterId, actorId, "RESET", occupancy.isExtra);
    }

    return occupancies.length;
  }

  /** Remove todos os ocupantes de uma vaga específica. */
  public async clearVaga(guild: Guild, actorId: string, vagaKey: string): Promise<number> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const vaga = await this.findVaga(guild, vagaKey);
    if (!vaga) {
      throw new VagaRuleError(`Não encontrei a vaga \`${vagaKey}\`.`);
    }

    const occupancies = await this.prisma.vagaOccupant.findMany({ where: { vagaId: vaga.id } });
    if (occupancies.length === 0) {
      return 0;
    }

    await this.prisma.vagaOccupant.deleteMany({ where: { vagaId: vaga.id } });

    for (const occupancy of occupancies) {
      await this.writeHistory(rpgGuild.id, vaga.id, occupancy.characterId, actorId, "CLEAR", occupancy.isExtra);
    }

    return occupancies.length;
  }

  private async writeHistory(
    guildId: string,
    vagaId: string,
    characterId: string,
    actorId: string,
    action: VagaHistoryAction,
    isExtra: boolean
  ): Promise<void> {
    await this.prisma.vagaHistory.create({
      data: { guildId, vagaId, characterId, actorId, action, isExtra }
    });
  }

  public async listHistory(
    guild: Guild,
    options: { vagaKey?: string; limit?: number } = {}
  ): Promise<VagaHistoryWithRelations[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    let vagaId: string | undefined;
    if (options.vagaKey) {
      const vaga = await this.findVaga(guild, options.vagaKey);
      if (!vaga) {
        throw new VagaRuleError(`Não encontrei a vaga \`${options.vagaKey}\`.`);
      }
      vagaId = vaga.id;
    }

    return this.prisma.vagaHistory.findMany({
      where: { guildId: rpgGuild.id, ...(vagaId ? { vagaId } : {}) },
      include: { vaga: true, character: true },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? HISTORY_LIMIT
    });
  }
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
