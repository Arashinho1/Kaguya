import type { Guild } from "discord.js";

import { listModules } from "../../core/modules/registry.js";
import { Prisma, type PrismaClient, type RpgGuild } from "../../generated/prisma/client.js";

export const ADMIN_COMMAND_PERMISSION = "command.admin";
const DEFAULT_PREFIX = ".";
const ENABLED_MODULES_KEY = "enabledModules";

export interface SettingInput {
  key: string;
  label: string;
  description?: string;
  value: Prisma.InputJsonValue;
  valueType: "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "CHANNEL" | "ROLE" | "USER";
  isPublic?: boolean;
}

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

  public async getSetting(guild: Guild, key: string): Promise<unknown> {
    const rpgGuild = await this.ensureGuild(guild);
    const setting = await this.prisma.guildSetting.findUnique({
      where: { guildId_key: { guildId: rpgGuild.id, key } }
    });

    return setting?.value;
  }

  public async setSetting(guild: Guild, actorId: string, setting: SettingInput): Promise<void> {
    const rpgGuild = await this.ensureGuild(guild);

    const current = await this.prisma.guildSetting.findUnique({
      where: { guildId_key: { guildId: rpgGuild.id, key: setting.key } }
    });

    await this.prisma.guildSetting.upsert({
      where: { guildId_key: { guildId: rpgGuild.id, key: setting.key } },
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

  /** Módulo desconhecido (nunca desativado explicitamente) é considerado ativo por padrão. */
  public async isModuleEnabled(guild: Guild, moduleKey: string): Promise<boolean> {
    const overrides = await this.getModuleOverrides(guild);
    return overrides[moduleKey] ?? true;
  }

  public async setModuleEnabled(
    guild: Guild,
    actorId: string,
    moduleKey: string,
    enabled: boolean
  ): Promise<void> {
    const overrides = await this.getModuleOverrides(guild);
    const next = { ...overrides, [moduleKey]: enabled };

    await this.setSetting(guild, actorId, {
      key: ENABLED_MODULES_KEY,
      label: "Módulos ativos",
      description: "Exceções (por servidor) à ativação padrão dos módulos do bot.",
      value: next as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: false
    });
  }

  public async getModuleStatus(guild: Guild): Promise<Record<string, boolean>> {
    const overrides = await this.getModuleOverrides(guild);
    const status: Record<string, boolean> = {};

    for (const module of listModules()) {
      status[module.key] = overrides[module.key] ?? true;
    }

    return status;
  }

  private async getModuleOverrides(guild: Guild): Promise<Record<string, boolean>> {
    const value = await this.getSetting(guild, ENABLED_MODULES_KEY);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
      )
    );
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
    const value = await this.getSetting(guild, "logChannelId");
    return typeof value === "string" && value.length > 0 ? value : null;
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
    const value = await this.getSetting(guild, "commandLogChannelId");
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  public async listRolePermissions(guild: Guild, permission: string): Promise<string[]> {
    const rpgGuild = await this.ensureGuild(guild);
    const permissions = await this.prisma.guildRolePermission.findMany({
      where: { guildId: rpgGuild.id, permission },
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
      where: { guildId: rpgGuild.id, permission, roleId: { in: roles } }
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
      where: { guildId_roleId_permission: { guildId: rpgGuild.id, roleId, permission } },
      update: {},
      create: { guildId: rpgGuild.id, roleId, permission }
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
      where: { guildId_roleId_permission: { guildId: rpgGuild.id, roleId, permission } }
    });

    if (!existing) {
      return false;
    }

    await this.prisma.guildRolePermission.delete({ where: { id: existing.id } });

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

  public async getGuildOverview(guild: Guild): Promise<{
    prefix: string;
    settingsCount: number;
    modules: Record<string, boolean>;
  }> {
    const rpgGuild = await this.ensureGuild(guild);
    const [settingsCount, modules] = await Promise.all([
      this.prisma.guildSetting.count({ where: { guildId: rpgGuild.id } }),
      this.getModuleStatus(guild)
    ]);

    return { prefix: rpgGuild.prefix, settingsCount, modules };
  }

  public async writeAuditLog(input: {
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
