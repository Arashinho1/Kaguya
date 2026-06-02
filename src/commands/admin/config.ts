import { ChannelType, EmbedBuilder } from "discord.js";

import { sendStaffLog } from "../../services/staffLog.js";
import type { PrefixCommand } from "../../types/command.js";

function normalizePrefix(prefix: string): string | null {
  const trimmed = prefix.trim();

  if (trimmed.length === 0 || trimmed.length > 5 || trimmed.includes(" ")) {
    return null;
  }

  return trimmed;
}

export const configCommand: PrefixCommand = {
  name: "config",
  aliases: ["cfg"],
  staffOnly: true,
  description: "Mostra e altera configuracoes do RPG neste servidor.",
  usage: ".config | .config prefix . | .config log #canal",
  async execute({ message, args, prefix, services }) {
    const subcommand = args.shift()?.toLowerCase();

    if (!subcommand || ["ver", "listar", "painel"].includes(subcommand)) {
      const overview = await services.guildConfig.getGuildOverview(message.guild);

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2b6cb0)
            .setTitle("Painel de configuracao")
            .setDescription("Este servidor ja esta isolado no banco. Cada regra futura sera salva por servidor.")
            .addFields(
              { name: "Prefixo", value: `\`${overview.prefix}\``, inline: true },
              { name: "Configuracoes", value: String(overview.settingsCount), inline: true },
              { name: "Atributos", value: String(overview.attributesCount), inline: true },
              { name: "Ranks", value: String(overview.ranksCount), inline: true },
              { name: "Tipos de jutsu", value: String(overview.jutsuTypesCount), inline: true },
              {
                name: "Comandos uteis",
                value: `\`${prefix}setup\`\n\`${prefix}config prefix .\`\n\`${prefix}config log #canal\``
              }
            )
        ]
      });
      return;
    }

    if (subcommand === "prefix") {
      const nextPrefix = normalizePrefix(args[0] ?? "");

      if (!nextPrefix) {
        await message.reply("Informe um prefixo com 1 a 5 caracteres, sem espacos.");
        return;
      }

      await services.guildConfig.setPrefix(message.guild, message.author.id, nextPrefix);
      await sendStaffLog(message, services, {
        title: "Prefixo atualizado",
        description: `O prefixo do servidor foi alterado de \`${prefix}\` para \`${nextPrefix}\`.`
      });
      await message.reply(`Prefixo atualizado para \`${nextPrefix}\`.`);
      return;
    }

    if (subcommand === "log") {
      const mentionedChannel = message.mentions.channels.first();
      const channelId = mentionedChannel?.id ?? args[0]?.replace(/\D/g, "");

      if (!channelId) {
        await message.reply(`Use \`${prefix}config log #canal\`.`);
        return;
      }

      const channel = await message.guild.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.type === ChannelType.GuildCategory || !channel.isTextBased()) {
        await message.reply("Esse canal nao parece ser um canal de texto valido.");
        return;
      }

      await services.guildConfig.setLogChannel(message.guild, message.author.id, channel.id);
      await sendStaffLog(message, services, {
        title: "Canal de logs configurado",
        description: `O canal de logs agora e <#${channel.id}>.`
      });
      await message.reply(`Canal de logs configurado: <#${channel.id}>.`);
      return;
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xc53030)
          .setTitle("Configuracao desconhecida")
          .setDescription(`Use \`${prefix}config\` para ver as opcoes disponiveis.`)
      ]
    });
  }
};
