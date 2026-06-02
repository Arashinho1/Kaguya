import { EmbedBuilder, escapeMarkdown, type Guild } from "discord.js";

import type { PrefixCommand } from "../../types/command.js";

const GUILDS_PER_PAGE = 10;
const EMBEDS_PER_MESSAGE = 10;

export const serversCommand: PrefixCommand = {
  name: "servidores",
  aliases: ["servers", "guilds"],
  access: "owner",
  description: "Lista os servidores em que o bot está atualmente.",
  usage: ".servidores",
  async execute({ message }) {
    const guilds = [...message.client.guilds.cache.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR")
    );

    if (guilds.length === 0) {
      await message.reply("Não encontrei servidores no cache do bot.");
      return;
    }

    const embeds = chunk(guilds, GUILDS_PER_PAGE).map((pageGuilds, pageIndex, pages) =>
      buildServersEmbed(pageGuilds, pageIndex + 1, pages.length, guilds.length)
    );

    for (const [index, embedGroup] of chunk(embeds, EMBEDS_PER_MESSAGE).entries()) {
      if (index === 0) {
        await message.reply({ embeds: embedGroup });
        continue;
      }

      await message.channel.send({ embeds: embedGroup });
    }
  }
};

function buildServersEmbed(
  guilds: Guild[],
  page: number,
  totalPages: number,
  totalGuilds: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle("Servidores do bot")
    .setDescription(`O bot está em **${totalGuilds}** servidor(es).`)
    .addFields(
      guilds.map((guild) => ({
        name: truncate(escapeMarkdown(guild.name), 240),
        value: [
          `ID: \`${guild.id}\``,
          `Membros: **${guild.memberCount ?? "desconhecido"}**`,
          `Entrada: ${formatTimestamp(guild.joinedTimestamp)}`
        ].join("\n")
      }))
    )
    .setFooter({ text: `Página ${page}/${totalPages}` })
    .setTimestamp();
}

function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return "desconhecida";
  }

  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
