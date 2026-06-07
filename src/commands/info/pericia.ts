import { buildPericiaPanel } from "../../modules/pericias/PericiaPanel.js";
import { canManageGuild, canUseConfiguredAdminRole } from "../../services/permissions.js";
import type { PrefixCommand } from "../../types/command.js";

export const periciaCommand: PrefixCommand = {
  name: "pericia",
  aliases: ["pericias", "perícia", "perícias"],
  access: "member",
  module: "pericias",
  description: "Mostra o progresso de perícias da sua ficha (XP e níveis ganhos ao usar jutsus).",
  usage: ".pericia | .pericia @jogador",
  async execute({ message, services }) {
    const target = message.mentions.users.first() ?? message.author;
    const canManage =
      canManageGuild(message) || (await canUseConfiguredAdminRole(message, services.guildConfig));

    await message.reply(await buildPericiaPanel(services, message.guild, message.author, target, canManage));
  }
};
