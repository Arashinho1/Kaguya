import type { Guild } from "discord.js";

import {
  DEFAULT_ATTRIBUTES,
  DEFAULT_GUILD_SETTINGS,
  DEFAULT_JUTSU_TYPES,
  DEFAULT_MODULE_STATUS,
  DEFAULT_PREFIX,
  DEFAULT_RANKS,
  type GuildModuleKey
} from "../../config/defaults.js";
import { DEFAULT_JUTSU_DATA } from "../../config/defaultJutsus.js";
import { Prisma, type PrismaClient, type RpgGuild } from "../../generated/prisma/client.js";

export const ADMIN_COMMAND_PERMISSION = "command.admin";

type ModuleStatus = Record<GuildModuleKey, boolean>;

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
      const desc = "description" in rank ? rank.description : undefined;
      await this.prisma.rankDefinition.upsert({
        where: {
          guildId_key: {
            guildId: rpgGuild.id,
            key: rank.key
          }
        },
        update: {
          name: rank.name,
          description: desc,
          sortOrder: rank.sortOrder
        },
        create: {
          guildId: rpgGuild.id,
          key: rank.key,
          name: rank.name,
          description: desc,
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

    // Resolve IDs de tipos de jutsu antes de criar os jutsus padrão
    const allTypes = await this.prisma.jutsuType.findMany({ where: { guildId: rpgGuild.id } });
    const typeMap = new Map(allTypes.map((t) => [t.key, t.id]));

    for (const jutsu of DEFAULT_JUTSU_DATA) {
      await this.prisma.jutsuDefinition.upsert({
        where: {
          guildId_key: {
            guildId: rpgGuild.id,
            key: jutsu.key
          }
        },
        update: {
          name: jutsu.name,
          description: jutsu.description ?? null,
          typeId: typeMap.get(jutsu.typeKey) ?? null,
          jutsuRank: jutsu.jutsuRank ?? null,
          chakraCost: jutsu.chakraCost,
          duration: jutsu.duration ?? null,
          usageLimit: jutsu.usageLimit ?? null
        },
        create: {
          guildId: rpgGuild.id,
          key: jutsu.key,
          name: jutsu.name,
          description: jutsu.description ?? null,
          typeId: typeMap.get(jutsu.typeKey) ?? null,
          requiredRankId: null,
          jutsuRank: jutsu.jutsuRank ?? null,
          chakraCost: jutsu.chakraCost,
          duration: jutsu.duration ?? null,
          usageLimit: jutsu.usageLimit ?? null
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
        jutsuTypes: DEFAULT_JUTSU_TYPES.length,
        jutsus: DEFAULT_JUTSU_DATA.length
      }
    });
  }

  public async getGuildOverview(guild: Guild): Promise<{
    prefix: string;
    settingsCount: number;
    attributesCount: number;
    ranksCount: number;
    jutsuTypesCount: number;
    jutsusCount: number;
    activeModulesCount: number;
    modulesCount: number;
  }> {
    const rpgGuild = await this.ensureGuild(guild);

    const [settingsCount, attributesCount, ranksCount, jutsuTypesCount, jutsusCount, moduleStatus] = await Promise.all([
      this.prisma.guildSetting.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.attributeDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.rankDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.jutsuType.count({ where: { guildId: rpgGuild.id } }),
      this.prisma.jutsuDefinition.count({ where: { guildId: rpgGuild.id } }),
      this.getModuleStatus(guild)
    ]);
    const modules = Object.values(moduleStatus);

    return {
      prefix: rpgGuild.prefix,
      settingsCount,
      attributesCount,
      ranksCount,
      jutsuTypesCount,
      jutsusCount,
      activeModulesCount: modules.filter(Boolean).length,
      modulesCount: modules.length
    };
  }

  public async getModuleStatus(guild: Guild): Promise<ModuleStatus> {
    const rpgGuild = await this.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "enabledModules"
        }
      }
    });

    return normalizeModuleStatus(setting?.value);
  }

  public async isModuleEnabled(guild: Guild, moduleKey: GuildModuleKey): Promise<boolean> {
    const status = await this.getModuleStatus(guild);
    return status[moduleKey];
  }

  public async setModuleEnabled(
    guild: Guild,
    actorId: string,
    moduleKey: GuildModuleKey,
    enabled: boolean
  ): Promise<ModuleStatus> {
    const current = await this.getModuleStatus(guild);
    const next: ModuleStatus = {
      ...current,
      [moduleKey]: enabled
    };

    await this.setSetting(guild, actorId, {
      key: "enabledModules",
      label: "Módulos ativos",
      description: "Define quais módulos do bot estão ativos neste servidor.",
      value: next as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: false
    });

    return next;
  }

  public async setLogChannel(guild: Guild, actorId: string, channelId: string): Promise<void> {
    await this.setSetting(guild, actorId, {
      key: "logChannelId",
      label: "Log administrativo",
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

  public async setCommandLogChannel(guild: Guild, actorId: string, channelId: string): Promise<void> {
    await this.setSetting(guild, actorId, {
      key: "commandLogChannelId",
      label: "Log de comandos",
      description: "Canal usado para registrar comandos executados neste servidor.",
      value: channelId,
      valueType: "CHANNEL",
      isPublic: false
    });
  }

  public async getCommandLogChannelId(guild: Guild): Promise<string | null> {
    const rpgGuild = await this.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: {
        guildId_key: {
          guildId: rpgGuild.id,
          key: "commandLogChannelId"
        }
      }
    });

    return typeof setting?.value === "string" && setting.value.length > 0 ? setting.value : null;
  }

  public async listRolePermissions(guild: Guild, permission: string): Promise<string[]> {
    const rpgGuild = await this.ensureGuild(guild);
    const permissions = await this.prisma.guildRolePermission.findMany({
      where: {
        guildId: rpgGuild.id,
        permission
      },
      orderBy: { createdAt: "asc" }
    });

    return permissions.map((entry) => entry.roleId);
  }

  public async hasAnyRolePermission(
    guild: Guild,
    roleIds: Iterable<string>,
    permission: string
  ): Promise<boolean> {
    const roles = [...roleIds];

    if (roles.length === 0) {
      return false;
    }

    const rpgGuild = await this.ensureGuild(guild);
    const count = await this.prisma.guildRolePermission.count({
      where: {
        guildId: rpgGuild.id,
        permission,
        roleId: { in: roles }
      }
    });

    return count > 0;
  }

  public async grantRolePermission(
    guild: Guild,
    actorId: string,
    roleId: string,
    permission: string
  ): Promise<void> {
    const rpgGuild = await this.ensureGuild(guild);

    await this.prisma.guildRolePermission.upsert({
      where: {
        guildId_roleId_permission: {
          guildId: rpgGuild.id,
          roleId,
          permission
        }
      },
      update: {},
      create: {
        guildId: rpgGuild.id,
        roleId,
        permission
      }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "guild.permission.role.grant",
      targetType: "GuildRolePermission",
      targetId: `${roleId}:${permission}`,
      after: { roleId, permission }
    });
  }

  public async revokeRolePermission(
    guild: Guild,
    actorId: string,
    roleId: string,
    permission: string
  ): Promise<boolean> {
    const rpgGuild = await this.ensureGuild(guild);
    const existing = await this.prisma.guildRolePermission.findUnique({
      where: {
        guildId_roleId_permission: {
          guildId: rpgGuild.id,
          roleId,
          permission
        }
      }
    });

    if (!existing) {
      return false;
    }

    await this.prisma.guildRolePermission.delete({
      where: { id: existing.id }
    });

    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "guild.permission.role.revoke",
      targetType: "GuildRolePermission",
      targetId: `${roleId}:${permission}`,
      before: { roleId, permission }
    });

    return true;
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

function normalizeModuleStatus(value: unknown): ModuleStatus {
  const fallback = { ...DEFAULT_MODULE_STATUS };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, defaultValue]) => [
      key,
      typeof record[key] === "boolean" ? record[key] : defaultValue
    ])
  ) as ModuleStatus;
}
