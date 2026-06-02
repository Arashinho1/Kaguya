import { EmbedBuilder, type Message } from "discord.js";

import type { CommandServices } from "../types/command.js";

export async function sendStaffLog(
  message: Message<true>,
  services: CommandServices,
  input: {
    title: string;
    description: string;
  }
): Promise<void> {
  const channelId = await services.guildConfig.getLogChannelId(message.guild).catch(() => null);

  if (!channelId) {
    return;
  }

  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x4a5568)
        .setTitle(input.title)
        .setDescription(input.description)
        .addFields({ name: "Responsavel", value: `${message.author} (${message.author.id})` })
        .setTimestamp()
    ]
  });
}
