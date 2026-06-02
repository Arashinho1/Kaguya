import { EmbedBuilder, type Message } from "discord.js";

import type { CommandServices } from "../types/command.js";

export async function sendCommandUsageLog(
  message: Message<true>,
  services: CommandServices,
  input: {
    commandName: string;
  }
): Promise<void> {
  const channelId = await services.guildConfig.getCommandLogChannelId(message.guild).catch(() => null);

  if (!channelId) {
    return;
  }

  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const displayName = message.member?.displayName ?? message.author.username;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3a0d12)
        .setTitle("📋 Log: Comando Executado")
        .addFields(
          { name: "Usuário", value: `**${displayName}** (${message.author.id})` },
          { name: "Servidor", value: message.guild.name },
          { name: "Comando", value: input.commandName },
          { name: "Canal", value: `<#${message.channel.id}>` }
        )
        .setTimestamp()
    ],
    allowedMentions: { parse: [] }
  });
}
