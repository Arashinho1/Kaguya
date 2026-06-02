import { Message, PermissionsBitField } from "discord.js";

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
