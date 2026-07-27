import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { Clan, PrismaClient, RankDefinition, Village } from "../../generated/prisma/client.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { EconomyService } from "../economy/EconomyService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import { normalizeBonuses, type WorldConfigService } from "../world/WorldConfigService.js";

export class CharacterRuleError extends DomainError {}

export type LinkKind = "cla" | "vila" | "rank";

const WORLD_INCLUDE = { clan: true, village: true, rank: true } as const;

export interface CharacterWithWorld {
  id: string;
  guildId: string;
  userId: string;
  name: string;
  clanId: string | null;
  villageId: string | null;
  rankId: string | null;
  backgroundUrl: string | null;
  categoryBackgrounds: unknown;
  attributes: unknown;
  metadata: unknown;
  isActive: boolean;
  clan: Clan | null;
  village: Village | null;
  rank: RankDefinition | null;
}

export interface CharacterAttributeView {
  key: string;
  name: string;
  category: string;
  baseValue: number;
  bonus: number;
  value: number;
  maxValue: number | null;
}

export interface CharacterView {
  character: CharacterWithWorld;
  attributes: CharacterAttributeView[];
  chakra: number;
}

export class CharacterService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly attributes: AttributeService,
    private readonly world: WorldConfigService,
    private readonly economy: EconomyService
  ) {}

  public async getActiveCharacter(guild: Guild, userId: string): Promise<CharacterWithWorld | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.character.findFirst({
      where: { guildId: rpgGuild.id, userId, isActive: true },
      include: WORLD_INCLUDE
    });
  }

  /**
   * Estado atual do personagem por id, direto do banco. Serviços que fazem leitura-then-write
   * sobre o snapshot de atributos (treino, perícias, ...) devem chamar isto imediatamente antes
   * de calcular/gravar em vez de confiar num CharacterWithWorld que o chamador guardou antes —
   * evita lost-update se o objeto em mãos estiver desatualizado.
   */
  public async getById(characterId: string): Promise<CharacterWithWorld | null> {
    return this.prisma.character.findUnique({ where: { id: characterId }, include: WORLD_INCLUDE });
  }

  public async createCharacter(guild: Guild, userId: string, name: string): Promise<CharacterWithWorld> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    const existingForUser = await this.getActiveCharacter(guild, userId);
    if (existingForUser) {
      throw new CharacterRuleError(
        `Você já tem uma ficha ativa: **${existingForUser.name}**. Fale com a staff para trocar de personagem.`
      );
    }

    const nameTaken = await this.prisma.character.findUnique({
      where: { guildId_name: { guildId: rpgGuild.id, name } }
    });
    if (nameTaken) {
      throw new CharacterRuleError(`Já existe um personagem chamado **${name}** neste servidor.`);
    }

    const activeAttributes = await this.attributes.listAttributes(guild);
    const snapshot = Object.fromEntries(activeAttributes.map((attr) => [attr.key, attr.baseValue]));

    // Rank não é escolha do jogador — começa no de menor sortOrder cadastrado (ex: "Estudante").
    // Promoção é responsabilidade de um sistema futuro (vagas/graduação), não da criação da ficha.
    const [initialRank] = await this.world.listRanks(guild);

    const created = await this.prisma.character.create({
      data: { guildId: rpgGuild.id, userId, name, attributes: snapshot, rankId: initialRank?.id },
      include: WORLD_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: userId,
      action: "character.create",
      targetType: "Character",
      targetId: created.id,
      after: { name: created.name }
    });

    return created;
  }

  public async linkCharacter(guild: Guild, userId: string, kind: LinkKind, name: string): Promise<CharacterWithWorld> {
    const character = await this.getActiveCharacter(guild, userId);
    if (!character) {
      throw new CharacterRuleError("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
    }

    if (kind === "cla") {
      const clan = await this.world.findClan(guild, name);
      if (!clan || !clan.isActive) {
        throw new CharacterRuleError(`Não encontrei o clã **${name}** (ou ele está desativado).`);
      }
      if (clan.memberLimit !== null && character.clanId !== clan.id) {
        const count = await this.world.countActiveCharactersInClan(clan.id);
        if (count >= clan.memberLimit) {
          throw new CharacterRuleError(`O clã **${clan.name}** já atingiu o limite de ${clan.memberLimit} membros.`);
        }
      }
      return this.updateLink(character.id, { clanId: clan.id });
    }

    if (kind === "vila") {
      const village = await this.world.findVillage(guild, name);
      if (!village || !village.isActive) {
        throw new CharacterRuleError(`Não encontrei a vila **${name}** (ou ela está desativada).`);
      }
      return this.updateLink(character.id, { villageId: village.id });
    }

    const rank = await this.world.findRank(guild, name);
    if (!rank || !rank.isActive) {
      throw new CharacterRuleError(`Não encontrei o rank \`${name}\` (ou ele está desativado).`);
    }
    return this.updateLink(character.id, { rankId: rank.id });
  }

  private async updateLink(
    characterId: string,
    data: { clanId?: string; villageId?: string; rankId?: string }
  ): Promise<CharacterWithWorld> {
    return this.prisma.character.update({
      where: { id: characterId },
      data,
      include: WORLD_INCLUDE
    });
  }

  public async setBackground(
    guild: Guild,
    character: CharacterWithWorld,
    backgroundUrl: string | null
  ): Promise<CharacterWithWorld> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: { backgroundUrl },
      include: WORLD_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: character.userId,
      action: "character.background.update",
      targetType: "Character",
      targetId: character.id
    });

    return updated;
  }

  public async setCategoryBackground(
    guild: Guild,
    character: CharacterWithWorld,
    category: string,
    backgroundUrl: string
  ): Promise<CharacterWithWorld> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = isRecordOfStrings(character.categoryBackgrounds) ? character.categoryBackgrounds : {};

    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: { categoryBackgrounds: { ...current, [category]: backgroundUrl } },
      include: WORLD_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: character.userId,
      action: "character.background.updateCategory",
      targetType: "Character",
      targetId: character.id,
      after: { category }
    });

    return updated;
  }

  /** Fundo específico da categoria se configurado, senão o fundo padrão da ficha (pode ser null). */
  public getBackgroundForCategory(character: CharacterWithWorld, category: string | null): string | null {
    if (category) {
      const map = isRecordOfStrings(character.categoryBackgrounds) ? character.categoryBackgrounds : {};
      const specific = map[category];
      if (specific) return specific;
    }
    return character.backgroundUrl;
  }

  public getBaseAttributeSnapshot(character: CharacterWithWorld): Record<string, number> {
    return isRecordOfNumbers(character.attributes) ? character.attributes : {};
  }

  public async updateAttributeSnapshot(
    character: CharacterWithWorld,
    key: string,
    newValue: number
  ): Promise<CharacterWithWorld> {
    const snapshot = { ...this.getBaseAttributeSnapshot(character), [key]: newValue };

    return this.prisma.character.update({
      where: { id: character.id },
      data: { attributes: snapshot },
      include: WORLD_INCLUDE
    });
  }

  public async getCharacterView(guild: Guild, character: CharacterWithWorld): Promise<CharacterView> {
    const activeAttributes = await this.attributes.listAttributes(guild);
    const snapshot = this.getBaseAttributeSnapshot(character);

    const equippedBonuses = await this.economy.getEquippedBonuses(character.id);

    const combinedBonuses: Record<string, number> = {};
    for (const source of [character.clan?.bonuses, character.village?.bonuses, character.rank?.bonuses, equippedBonuses]) {
      for (const [key, value] of Object.entries(normalizeBonuses(source))) {
        combinedBonuses[key] = (combinedBonuses[key] ?? 0) + value;
      }
    }

    const attributeValues: Record<string, number> = {};
    const attributeViews: CharacterAttributeView[] = activeAttributes.map((attr) => {
      const baseValue = snapshot[attr.key] ?? attr.baseValue;
      const bonus = combinedBonuses[attr.key] ?? 0;
      const value = baseValue + bonus;
      attributeValues[attr.key] = value;
      return { key: attr.key, name: attr.name, category: attr.category, baseValue, bonus, value, maxValue: attr.maxValue };
    });

    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const chakraContext: Record<string, number | string> = { ...attributeValues };
    if (character.rank?.key) {
      chakraContext.rank = character.rank.key;
    }
    const chakra = this.attributes.calculateChakra(chakraContext, chakraFormula) + (combinedBonuses.chakra ?? 0);

    return { character, attributes: attributeViews, chakra };
  }
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === "number")
  );
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === "string")
  );
}
