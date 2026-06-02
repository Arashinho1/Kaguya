import type { Guild } from "discord.js";

import {
  DEFAULT_ATTRIBUTES,
  DEFAULT_GUILD_SETTINGS,
  DEFAULT_JUTSU_TYPES,
  DEFAULT_PREFIX,
  DEFAULT_RANKS
} from "../../config/defaults.js";
import { Prisma, type PrismaClient, type RpgGuild } from "../../generated/prisma/client.js";

export class GuildConfigService {
  private readonly prefixCache = new Map<string, string>();

  public constructor(private readonly prisma: PrismaClient) {}

  public async ensureGuild(guild: Guild): Promise<RpgGuild> {
    const rpgGuild = await this.prisma.rpgGuild.upsert({
      where: { discordId: guild.id },
      update: { name: guild.name },
      create: {
        discordId: guild.id,
        name: guild.name,
        prefix: DEFAULT_PREFIX
      }
    });

    this.prefixCache.set(guild.id, rpgGuild.prefix);
    return rpgGuild;
  }

  public async getPrefix(guild: Guild): Promise<string> {
    const cached = this.prefixCache.get(guild.id);

    if (cached) {
      return cached;
    }

    const rpgGuild = await this.ensureGuild(guild);
    return rpgGuild.prefix;
  }

  public async setPrefix(guild: Guild, actorId: string, prefix: string): Promise<RpgGuild> {
    const rpgGuild = await this.ensureGuild(guild);

    const updated = await this.prisma.rpgGuild.update({
      where: { id: rpgGuild.id },
      data: { prefix }
    });

    this.prefixCache.set(guild.id, prefix);

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "guild.prefix.update",
      targetType: "RpgGuild",
      targetId: rpgGuild.id,
      before: { prefix: rpgGuild.prefix },
      after: { prefix }
    });

    return updated;
  }

  public async seedGuildDefaults(guild: Guild, actorId: string): Promise<void> {
    const rpgGuild = await this.ensureGuild(guild);

    for (const setting of DEFAULT_GUILD_SETTINGS) {
      await this.prisma.guildSetting.upsert({
        where: {
          guildId_key: {
            guildId: rpgGuild.id,
            key: setting.key
          }
        },
        update: {
          label: setting.label,
          description: setting.description,
          valueType: setting.valueType,
          isPublic: setting.isPublic
        },
        create: {
          guildId: rpgGuild.id,
          key: setting.key,
          label: setting.label,
          description: setting.description,
          value: setting.value as Prisma.InputJsonValue,
          valueType: setting.valueType,
          isPublic: setting.isPublic
        }
      });
    }

    for (const attribute of DEFAULT_ATTRIBUTES) {
      await this.prisma.attributeDefinition.upsert({
        where: {
          guildId_key: {
            guildId: rpgGuild.id,
            key: attribute.key
          }
        },
        update: {
          name: attribute.name,
          description: "description" in attribute ? attribute.description : undefined,
          sortOrder: attribute.sortOrder
        },
        create: {
          guildId: rpgGuild.id,
          key: attribute.key,
          name: attribute.name,
          description: "description" in attribute ? attribute.description : undefined,
          sortOrder: attribute.sortOrder
        }
      });
    }

    for (const rank of DEFAULT_RANKS) {
      await this.prisma.rankDefinition.upsert({
        where: {
          guildId_key: {
            guildId: rpgGuild.id,
            key: rank.key
          }
        },
        update: {
          name: rank.name,
          sortOrder: rank.sortOrder
        },
        create: {
          guildId: rpgGuild.id,
          key: rank.key,
          name: rank.name,
          sortOrder: rank.sortOrder
        }
      });
    }

    for (const type of DEFAULT_JUTSU_TYPES) {
      await this.prisma.jutsuType.upsert({
        where: {
          guildId_key: {
            guildId: rpgGuild.id,
            key: type.key
          }
        },
        update: {
          name: type.name
        },
        create: {
          guildId: rpgGuild.id,
          key: type.key,
          name: type.name
        }
      });
    }

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "guild.defaults.seed",
      targetType: "RpgGuild",
      targetId: rpgGuild.id,
      after: {
        settings: DEFAULT_GUILD_SETTINGS.length,
        attributes: DEFAULT_ATTRIBUTES.length,
        ranks: DEFAULT_RANKS.length,
        jutsuTypes: DEFAULT_JUTSU_TYPES.length
      }
    });
  }

  public async getGuildOverview(guild: Guild): Promise<{
    prefix: string;
    settingsCount: number;
    attributesCount: number;
    ranksCount: number;
    jutsuTypesCount: number;
  }> {
    const rpgGuild = await this.ensureGuild(guild);

    const [settingsCount, attributesCount, ranksCount, jutsuTypesCount] = await Promise.all([
      this.prisma.guildSetting.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.attributeDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.rankDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.jutsuType.count({ where: { guildId: rpgGuild.id } })
    ]);

    return {
      prefix: rpgGuild.prefix,
      settingsCount,
      attributesCount,
      ranksCount,
      jutsuTypesCount
    };
  }

  public async setLogChannel(guild: Guild, actorId: string, channelId: string): Promise<void> {
    await this.setSetting(guild, actorId, {
      key: "logChannelId",
      label: "Canal de logs",
      description: "Canal usado para registrar alterações administrativas.",
      value: channelId,
      valueType: "CHANNEL",
      isPublic: false
    });
  }

  public async getLogChannelId(guild: Guild): Promise<string | null> {
    const rpgGuild = await this.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "logChannelId"
        }
      }
    });

    return typeof setting?.value === "string" && setting.value.length > 0 ? setting.value : null;
  }

  public async setSetting(
    guild: Guild,
    actorId: string,
    setting: {
      key: string;
      label: string;
      description?: string;
      value: Prisma.InputJsonValue;
      valueType: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "CHANNEL" | "ROLE" | "USER";
      isPublic?: boolean;
    }
  ): Promise<void> {
    const rpgGuild = await this.ensureGuild(guild);

    const current = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: setting.key
        }
      }
    });

    await this.prisma.guildSetting.upsert({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: setting.key
        }
      },
      update: {
        label: setting.label,
        description: setting.description,
        value: setting.value,
        valueType: setting.valueType,
        isPublic: setting.isPublic ?? false
      },
      create: {
        guildId: rpgGuild.id,
        key: setting.key,
        label: setting.label,
        description: setting.description,
        value: setting.value,
        valueType: setting.valueType,
        isPublic: setting.isPublic ?? false
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: `guild.setting.${setting.key}.update`,
      targetType: "GuildSetting",
      targetId: setting.key,
      before: current ? { value: current.value } : null,
      after: { value: setting.value }
    });
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
