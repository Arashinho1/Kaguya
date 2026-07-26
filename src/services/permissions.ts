import { PermissionsBitField, type Client, type Guild, type GuildMember } from "discord.js";

import type { CommandAccess } from "../core/commands/index.js";
import { env } from "../config/env.js";
import { ADMIN_COMMAND_PERMISSION, type GuildConfigService } from "../modules/guild-config/GuildConfigService.js";

export function hasManageGuildPermission(
  permissions: Readonly<PermissionsBitField> | null | undefined
): boolean {
  return (
    permissions?.has(PermissionsBitField.Flags.Administrator) ||
    permissions?.has(PermissionsBitField.Flags.ManageGuild) ||
    false
  );
}

export async function canUseCommandAccess(
  access: CommandAccess,
  member: GuildMember | null,
  client: Client,
  guildConfig: GuildConfigService
): Promise<boolean> {
  if (access === "member") {
    return true;
  }

  if (access === "admin") {
    if (hasManageGuildPermission(member?.permissions)) {
      return true;
    }
    return member ? hasConfiguredAdminRole(member.guild, member.roles.cache.keys(), guildConfig) : false;
  }

  return canUseOwnerCommand(member?.user.id ?? null, client);
}

export async function hasConfiguredAdminRole(
  guild: Guild,
  roleIds: Iterable<string>,
  guildConfig: GuildConfigService
): Promise<boolean> {
  return guildConfig.hasAnyRolePermission(guild, roleIds, ADMIN_COMMAND_PERMISSION);
}

export async function canUseOwnerCommand(userId: string | null, client: Client): Promise<boolean> {
  if (!userId) {
    return false;
  }

  if (env.BOT_OWNER_IDS.length > 0) {
    return env.BOT_OWNER_IDS.includes(userId);
  }

  const application = await client.application?.fetch().catch(() => null);
  const owner = application?.owner;

  if (!owner) {
    return false;
  }

  if ("members" in owner) {
    return owner.members.has(userId);
  }

  return owner.id === userId;
}
