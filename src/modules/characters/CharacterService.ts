import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { Character, PrismaClient } from "../../generated/prisma/client.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export class CharacterRuleError extends DomainError {}

export interface CharacterAttributeView {
  key: string;
  name: string;
  value: number;
}

export interface CharacterView {
  character: Character;
  attributes: CharacterAttributeView[];
  chakra: number;
}

export class CharacterService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly attributes: AttributeService
  ) {}

  public async getActiveCharacter(guild: Guild, userId: string): Promise<Character | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.character.findFirst({
      where: { guildId: rpgGuild.id, userId, isActive: true }
    });
  }

  public async createCharacter(guild: Guild, userId: string, name: string): Promise<Character> {
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

    const created = await this.prisma.character.create({
      data: {
        guildId: rpgGuild.id,
        userId,
        name,
        attributes: snapshot
      }
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

  public async getCharacterView(guild: Guild, character: Character): Promise<CharacterView> {
    const activeAttributes = await this.attributes.listAttributes(guild);
    const snapshot = isRecordOfNumbers(character.attributes) ? character.attributes : {};

    const attributeValues: Record<string, number> = {};
    const attributeViews: CharacterAttributeView[] = activeAttributes.map((attr) => {
      const value = snapshot[attr.key] ?? attr.baseValue;
      attributeValues[attr.key] = value;
      return { key: attr.key, name: attr.name, value };
    });

    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const chakra = this.attributes.calculateChakra(attributeValues, chakraFormula);

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
