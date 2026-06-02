import { ChannelType, EmbedBuilder } from "discord.js";

import { buildConfigPanel } from "../../modules/config-panel/ConfigPanel.js";
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
  description: "Mostra e altera configurações do RPG neste servidor.",
  usage: ".config",
  async execute({ message, args, prefix, services }) {
    const subcommand = args.shift()?.toLowerCase();

    if (!subcommand || ["ver", "listar", "painel"].includes(subcommand)) {
      await message.reply(await buildConfigPanel(services, message.guild, prefix));
      return;
    }

    if (subcommand === "prefix") {
      const nextPrefix = normalizePrefix(args[0] ?? "");

      if (!nextPrefix) {
        await message.reply("Informe um prefixo com 1 a 5 caracteres, sem espaços.");
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
        await message.reply("Esse canal não parece ser um canal de texto válido.");
        return;
      }

      await services.guildConfig.setLogChannel(message.guild, message.author.id, channel.id);
      await sendStaffLog(message, services, {
        title: "Canal de logs configurado",
        description: `O canal de logs agora é <#${channel.id}>.`
      });
      await message.reply(`Canal de logs configurado: <#${channel.id}>.`);
      return;
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xc53030)
          .setTitle("Configuração desconhecida")
          .setDescription(`Use \`${prefix}config\` para ver as opções disponíveis.`)
      ]
    });
  }
};
