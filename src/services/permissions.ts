import { Message, PermissionsBitField, type Guild } from "discord.js";

import { env } from "../config/env.js";
import { ADMIN_COMMAND_PERMISSION, type GuildConfigService } from "../modules/guild-config/GuildConfigService.js";
import type { CommandAccess } from "../types/command.js";

export function hasManageGuildPermission(
  permissions: Readonly<PermissionsBitField> | null | undefined
): boolean {
  return (
    permissions?.has(PermissionsBitField.Flags.Administrator) ||
    permissions?.has(PermissionsBitField.Flags.ManageGuild) ||
    false
  );
}

export function canManageGuild(message: Message<true>): boolean {
  return hasManageGuildPermission(message.member?.permissions);
}

export async function canUseCommandAccess(
  message: Message<true>,
  access: CommandAccess,
  guildConfig: GuildConfigService
): Promise<boolean> {
  if (access === "member") {
    return true;
  }

  if (access === "admin") {
    return canManageGuild(message) || canUseConfiguredAdminRole(message, guildConfig);
  }

  return canUseOwnerCommand(message);
}

export async function canUseConfiguredAdminRole(
  message: Message<true>,
  guildConfig: GuildConfigService
): Promise<boolean> {
  const roleIds = message.member?.roles.cache.keys();

  if (!roleIds) {
    return false;
  }

  return hasConfiguredAdminRole(message.guild, roleIds, guildConfig);
}

export async function hasConfiguredAdminRole(
  guild: Guild,
  roleIds: Iterable<string>,
  guildConfig: GuildConfigService
): Promise<boolean> {
  return guildConfig.hasAnyRolePermission(guild, roleIds, ADMIN_COMMAND_PERMISSION);
}

export async function canUseOwnerCommand(message: Message<true>): Promise<boolean> {
  const configuredOwnerIds = parseOwnerIds(env.BOT_OWNER_IDS);

  if (configuredOwnerIds.length > 0) {
    return configuredOwnerIds.includes(message.author.id);
  }

  const application = await message.client.application?.fetch().catch(() => null);
  const owner = application?.owner;

  if (!owner) {
    return false;
  }

  if ("members" in owner) {
    return owner.members.has(message.author.id);
  }

  return owner.id === message.author.id;
}

function parseOwnerIds(value: string): string[] {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{15,25}$/.test(id));
}
