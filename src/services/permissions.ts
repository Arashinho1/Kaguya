import { Message, PermissionsBitField } from "discord.js";

export function canManageGuild(message: Message<true>): boolean {
  return (
    message.member?.permissions.has(PermissionsBitField.Flags.Administrator) ||
    message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    false
  );
}
