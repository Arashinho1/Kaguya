import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { Clan, Prisma, PrismaClient, RankDefinition, Village } from "../../generated/prisma/client.js";
import { HEX_COLOR_PATTERN, validateImageUrl } from "../../services/cardGenerator.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { EconomyService } from "../economy/EconomyService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import { normalizeBonuses, type WorldConfigService } from "../world/WorldConfigService.js";

export class CharacterRuleError extends DomainError {}

export type LinkKind = "cla" | "vila" | "rank";

/** Alvo do estilo do card: uma categoria de atributo (fisico/mental) ou "_default"
 * (ficha sem nenhum atributo cadastrado ainda). */
export const DEFAULT_STYLE_TARGET = "_default";

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
  cardStyles: unknown;
  attributes: unknown;
  metadata: unknown;
  isActive: boolean;
  clan: Clan | null;
  village: Village | null;
  rank: RankDefinition | null;
}

export interface CardStyle {
  backgroundUrl: string | null;
  backgroundColor: string | null;
  accent: string | null;
}

interface StyleEntry {
  backgroundUrl?: string;
  backgroundColor?: string;
  accent?: string;
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
    if (backgroundUrl && !(await validateImageUrl(backgroundUrl))) {
      throw new CharacterRuleError(
        "Não consegui carregar essa imagem. Confira se o link aponta direto pro arquivo " +
          "(termina em .jpg/.png/.webp) — links de página como Pinterest/Google Imagens não funcionam, " +
          "só o link \"copiar endereço da imagem\"."
      );
    }

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

  private getStyleMap(character: CharacterWithWorld): Record<string, StyleEntry> {
    return isRecordOfStyleEntries(character.cardStyles) ? character.cardStyles : {};
  }

  private async updateStyleEntry(
    guild: Guild,
    character: CharacterWithWorld,
    target: string,
    entry: StyleEntry,
    action: string
  ): Promise<CharacterWithWorld> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const styles = { ...this.getStyleMap(character), [target]: entry };

    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: { cardStyles: styles as unknown as Prisma.InputJsonValue },
      include: WORLD_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: character.userId,
      action,
      targetType: "Character",
      targetId: character.id,
      after: { target }
    });

    return updated;
  }

  /** Define a imagem de fundo do card pra essa categoria — limpa a cor sólida (mutuamente exclusivas). */
  public async setCategoryImage(
    guild: Guild,
    character: CharacterWithWorld,
    target: string,
    imageUrl: string
  ): Promise<CharacterWithWorld> {
    if (!(await validateImageUrl(imageUrl))) {
      throw new CharacterRuleError(
        "Não consegui carregar essa imagem. Confira se o link aponta direto pro arquivo " +
          "(termina em .jpg/.png/.webp) — links de página como Pinterest/Google Imagens não funcionam, " +
          "só o link \"copiar endereço da imagem\"."
      );
    }

    const current = this.getStyleMap(character)[target] ?? {};
    return this.updateStyleEntry(
      guild,
      character,
      target,
      { ...current, backgroundUrl: imageUrl, backgroundColor: undefined },
      "character.style.setImage"
    );
  }

  /** Define um fundo de cor sólida pra essa categoria — limpa a imagem (mutuamente exclusivas). */
  public async setCategoryColor(
    guild: Guild,
    character: CharacterWithWorld,
    target: string,
    hexColor: string
  ): Promise<CharacterWithWorld> {
    if (!HEX_COLOR_PATTERN.test(hexColor)) {
      throw new CharacterRuleError(`Cor inválida: \`${hexColor}\`. Use o formato hexadecimal, ex: \`#1b1230\`.`);
    }

    const current = this.getStyleMap(character)[target] ?? {};
    return this.updateStyleEntry(
      guild,
      character,
      target,
      { ...current, backgroundColor: hexColor, backgroundUrl: undefined },
      "character.style.setColor"
    );
  }

  /** Cor de destaque (borda, chakra, badges, barras) — independente do fundo escolhido. */
  public async setCategoryAccent(
    guild: Guild,
    character: CharacterWithWorld,
    target: string,
    hexColor: string
  ): Promise<CharacterWithWorld> {
    if (!HEX_COLOR_PATTERN.test(hexColor)) {
      throw new CharacterRuleError(`Cor inválida: \`${hexColor}\`. Use o formato hexadecimal, ex: \`#ff6b1a\`.`);
    }

    const current = this.getStyleMap(character)[target] ?? {};
    return this.updateStyleEntry(
      guild,
      character,
      target,
      { ...current, accent: hexColor },
      "character.style.setAccent"
    );
  }

  /** Remove todo o estilo customizado dessa categoria — volta pro tema padrão. */
  public async resetCategoryStyle(guild: Guild, character: CharacterWithWorld, target: string): Promise<CharacterWithWorld> {
    const styles = { ...this.getStyleMap(character) };
    delete styles[target];

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: { cardStyles: styles as unknown as Prisma.InputJsonValue },
      include: WORLD_INCLUDE
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: character.userId,
      action: "character.style.reset",
      targetType: "Character",
      targetId: character.id,
      after: { target }
    });

    return updated;
  }

  /**
   * Resolve o estilo efetivo do card pra uma categoria (ou DEFAULT_STYLE_TARGET): imagem e
   * cor sólida são mutuamente exclusivas — se a categoria não tem nenhuma das duas, cai no
   * fundo genérico da ficha (`backgroundUrl`). O accent é sempre independente.
   */
  public getCardStyle(character: CharacterWithWorld, target: string): CardStyle {
    const entry = this.getStyleMap(character)[target];

    if (entry?.backgroundUrl) {
      return { backgroundUrl: entry.backgroundUrl, backgroundColor: null, accent: entry.accent ?? null };
    }
    if (entry?.backgroundColor) {
      return { backgroundUrl: null, backgroundColor: entry.backgroundColor, accent: entry.accent ?? null };
    }
    return { backgroundUrl: character.backgroundUrl, backgroundColor: null, accent: entry?.accent ?? null };
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

function isRecordOfStyleEntries(value: unknown): value is Record<string, StyleEntry> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
