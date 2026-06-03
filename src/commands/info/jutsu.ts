import { buildJutsuPanel } from "../../modules/jutsus/JutsuPanel.js";
import { canManageGuild, canUseConfiguredAdminRole } from "../../services/permissions.js";
import type { PrefixCommand } from "../../types/command.js";

export const jutsuCommand: PrefixCommand = {
  name: "jutsu",
  aliases: ["jutsus", "tecnica", "tecnicas", "técnica", "técnicas"],
  access: "member",
  module: "jutsus",
  description: "Abre o painel de catálogo e aprendizado de jutsus.",
  usage: ".jutsu",
  async execute({ message, services }) {
    const canManage =
      canManageGuild(message) ||
      await canUseConfiguredAdminRole(message, services.guildConfig);

    await message.reply(await buildJutsuPanel(services, message.guild, message.author, canManage));
  }
};
