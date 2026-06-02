import { EmbedBuilder, type Guild, type Message, type User } from "discord.js";

import type { CommandServices } from "../types/command.js";

export async function sendStaffLog(
  message: Message<true>,
  services: CommandServices,
  input: {
    title: string;
    description: string;
  }
): Promise<void> {
  await sendStaffLogForGuild(message.guild, message.author, services, input);
}

export async function sendStaffLogForGuild(
  guild: Guild,
  actor: User,
  services: CommandServices,
  input: {
    title: string;
    description: string;
  }
): Promise<void> {
  const channelId = await services.guildConfig.getLogChannelId(guild).catch(() => null);

  if (!channelId) {
    return;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x4a5568)
        .setTitle(input.title)
        .setDescription(input.description)
        .addFields({ name: "Responsavel", value: `${actor} (${actor.id})` })
        .setTimestamp()
    ]
  });
}
