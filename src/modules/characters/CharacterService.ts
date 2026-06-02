import type { Guild, User } from "discord.js";

import { Prisma, type Character, type PrismaClient } from "../../generated/prisma/client.js";
import type { AttributeService } from "../attributes/AttributeService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export interface CreateCharacterInput {
  name: string;
  concept?: string;
  imageUrl?: string;
}

export interface CharacterMetadata {
  concept?: string;
  imageUrl?: string;
}

export interface UpdateCharacterInput {
  name?: string;
  concept?: string | null;
  imageUrl?: string | null;
}

export class CharacterService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly attributes: AttributeService
  ) {}

  public async findActiveByUser(guild: Guild, userId: string): Promise<Character | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.character.findFirst({
      where: {
        guildId: rpgGuild.id,
        userId,
        isActive: true
      },
      orderBy: { createdAt: "asc" }
    });
  }

  public async findDisplayCharacter(guild: Guild, user: User): Promise<Character | null> {
    return this.findActiveByUser(guild, user.id);
  }

  public async createCharacter(
    guild: Guild,
    user: User,
    input: CreateCharacterInput
  ): Promise<Character> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const activeAttributes = await this.attributes.listAttributes(guild);
    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const attributeValues = Object.fromEntries(
      activeAttributes.map((attribute) => [attribute.key, attribute.baseValue])
    ) as Record<string, number>;

    attributeValues.chakra = this.attributes.calculateChakra(attributeValues, chakraFormula);

    const created = await this.prisma.character.create({
      data: {
        guildId: rpgGuild.id,
        userId: user.id,
        name: input.name,
        attributes: attributeValues,
        metadata: {
          concept: input.concept,
          imageUrl: input.imageUrl
        }
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: user.id,
      action: "character.create",
      targetType: "Character",
      targetId: created.id,
      after: this.serializeCharacter(created)
    });

    return created;
  }

  public async updateCharacterDetails(
    guild: Guild,
    actor: User,
    input: UpdateCharacterInput
  ): Promise<Character | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findActiveByUser(guild, actor.id);

    if (!current) {
      return null;
    }

    const metadata = this.getMetadata(current);
    const nextMetadata: CharacterMetadata = {
      concept: input.concept === undefined ? metadata.concept : input.concept ?? undefined,
      imageUrl: input.imageUrl === undefined ? metadata.imageUrl : input.imageUrl ?? undefined
    };

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        name: input.name ?? current.name,
        metadata: nextMetadata as Prisma.InputJsonValue
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: actor.id,
      action: "character.update",
      targetType: "Character",
      targetId: updated.id,
      before: this.serializeCharacter(current),
      after: this.serializeCharacter(updated)
    });

    return updated;
  }

  public async refreshCharacterAttributes(guild: Guild, actor: User): Promise<Character | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findActiveByUser(guild, actor.id);

    if (!current) {
      return null;
    }

    const activeAttributes = await this.attributes.listAttributes(guild);
    const chakraFormula = await this.attributes.getChakraFormula(guild);
    const currentValues = this.getAttributeValues(current);
    const nextValues = { ...currentValues };

    for (const attribute of activeAttributes) {
      if (nextValues[attribute.key] === undefined) {
        nextValues[attribute.key] = attribute.baseValue;
      }
    }

    nextValues.chakra = this.attributes.calculateChakra(nextValues, chakraFormula);

    const updated = await this.prisma.character.update({
      where: { id: current.id },
      data: {
        attributes: nextValues
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: actor.id,
      action: "character.attributes.refresh",
      targetType: "Character",
      targetId: updated.id,
      before: { attributes: current.attributes as Prisma.InputJsonValue },
      after: { attributes: updated.attributes as Prisma.InputJsonValue }
    });

    return updated;
  }

  public getAttributeValues(character: Character): Record<string, number> {
    if (!character.attributes || typeof character.attributes !== "object" || Array.isArray(character.attributes)) {
      return {};
    }

    const values: Record<string, number> = {};

    for (const [key, value] of Object.entries(character.attributes)) {
      if (typeof value === "number") {
        values[key] = value;
      }
    }

    return values;
  }

  public getMetadata(character: Character): CharacterMetadata {
    if (!character.metadata || typeof character.metadata !== "object" || Array.isArray(character.metadata)) {
      return {};
    }

    const record = character.metadata as Record<string, unknown>;

    return {
      concept: typeof record.concept === "string" ? record.concept : undefined,
      imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined
    };
  }

  private serializeCharacter(character: Character): Prisma.InputJsonObject {
    return {
      id: character.id,
      userId: character.userId,
      name: character.name,
      attributes: character.attributes as Prisma.InputJsonValue,
      metadata: character.metadata as Prisma.InputJsonValue
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
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        guildId: input.guildId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before === null ? Prisma.JsonNull : input.before,
        after: input.after === null ? Prisma.JsonNull : input.after
      }
    });
  }
}
