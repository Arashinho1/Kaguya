import { EmbedBuilder } from "discord.js";

import type { PrefixCommand } from "../../types/command.js";

export const pingCommand: PrefixCommand = {
  name: "ping",
  description: "Mostra se o bot está respondendo.",
  usage: ".ping",
  async execute({ message }) {
    const sent = await message.reply("Calculando...");
    const latency = sent.createdTimestamp - message.createdTimestamp;

    await sent.edit({
      content: "",
      embeds: [
        new EmbedBuilder()
          .setColor(0x2f855a)
          .setTitle("Kaguya online")
          .setDescription(`Latência: ${latency}ms`)
      ]
    });
  }
};
