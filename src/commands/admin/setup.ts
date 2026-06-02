import { EmbedBuilder } from "discord.js";

import { sendStaffLog } from "../../services/staffLog.js";
import type { PrefixCommand } from "../../types/command.js";

export const setupCommand: PrefixCommand = {
  name: "setup",
  aliases: ["iniciar"],
  staffOnly: true,
  description: "Prepara os dados padrao do RPG neste servidor.",
  usage: ".setup",
  async execute({ message, services }) {
    await services.guildConfig.seedGuildDefaults(message.guild, message.author.id);
    await sendStaffLog(message, services, {
      title: "Setup executado",
      description: "As configuracoes iniciais do servidor foram criadas ou atualizadas."
    });

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x805ad5)
          .setTitle("Servidor preparado")
          .setDescription("Criei as configuracoes iniciais, atributos, ranks e tipos de jutsu deste servidor.")
      ]
    });
  }
};
