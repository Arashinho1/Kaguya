import { ChannelType, EmbedBuilder } from "discord.js";

import { buildConfigPanel } from "../../modules/config-panel/ConfigPanel.js";
import { ADMIN_COMMAND_PERMISSION } from "../../modules/guild-config/GuildConfigService.js";
import { sendStaffLog } from "../../services/staffLog.js";
import type { PrefixCommand } from "../../types/command.js";

function normalizePrefix(prefix: string): string | null {
  const trimmed = prefix.trim();

  if (trimmed.length === 0 || trimmed.length > 5 || trimmed.includes(" ")) {
    return null;
  }

  return trimmed;
}

function parseRoleId(value: string | undefined): string | null {
  const roleId = value?.replace(/\D/g, "") ?? "";
  return /^\d{15,25}$/.test(roleId) ? roleId : null;
}

export const configCommand: PrefixCommand = {
  name: "config",
  aliases: ["cfg"],
  access: "admin",
  description: "Mostra e altera configurações do RPG neste servidor.",
  usage: ".config | .config log #canal | .config log-comandos #canal | .config permissao adicionar @cargo",
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

    if (["log", "log-admin", "admin-log", "log-administrativo"].includes(subcommand)) {
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
        title: "Log administrativo configurado",
        description: `O log administrativo agora é <#${channel.id}>.`
      });
      await message.reply(`Log administrativo configurado: <#${channel.id}>.`);
      return;
    }

    if (["log-comandos", "comandos-log", "command-log", "log-uso"].includes(subcommand)) {
      const mentionedChannel = message.mentions.channels.first();
      const channelId = mentionedChannel?.id ?? args[0]?.replace(/\D/g, "");

      if (!channelId) {
        await message.reply(`Use \`${prefix}config log-comandos #canal\`.`);
        return;
      }

      const channel = await message.guild.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.type === ChannelType.GuildCategory || !channel.isTextBased()) {
        await message.reply("Esse canal não parece ser um canal de texto válido.");
        return;
      }

      await services.guildConfig.setCommandLogChannel(message.guild, message.author.id, channel.id);
      await sendStaffLog(message, services, {
        title: "Log de comandos configurado",
        description: `O log de comandos agora é <#${channel.id}>.`
      });
      await message.reply(`Log de comandos configurado: <#${channel.id}>.`);
      return;
    }

    if (["permissao", "permissão", "permissoes", "permissões"].includes(subcommand)) {
      const action = args.shift()?.toLowerCase();

      if (!action || ["listar", "lista", "ver"].includes(action)) {
        const roleIds = await services.guildConfig.listRolePermissions(message.guild, ADMIN_COMMAND_PERMISSION);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x805ad5)
              .setTitle("Permissões administrativas")
              .setDescription(
                roleIds.length > 0
                  ? roleIds.map((roleId) => `<@&${roleId}>`).join("\n")
                  : "Nenhum cargo configurado. Administrador e Gerenciar Servidor continuam liberados por padrão."
              )
          ]
        });
        return;
      }

      const roleId = parseRoleId(args[0]);

      if (!roleId) {
        await message.reply(`Use \`${prefix}config permissao adicionar @cargo\` ou \`${prefix}config permissao remover @cargo\`.`);
        return;
      }

      const role = await message.guild.roles.fetch(roleId).catch(() => null);

      if (!role) {
        await message.reply("Não encontrei esse cargo no servidor.");
        return;
      }

      if (["adicionar", "add", "liberar"].includes(action)) {
        await services.guildConfig.grantRolePermission(message.guild, message.author.id, role.id, ADMIN_COMMAND_PERMISSION);
        await sendStaffLog(message, services, {
          title: "Permissão administrativa concedida",
          description: `O cargo ${role} agora pode usar comandos administrativos.`
        });
        await message.reply(`Cargo ${role} liberado para comandos administrativos.`);
        return;
      }

      if (["remover", "remove", "revogar"].includes(action)) {
        const removed = await services.guildConfig.revokeRolePermission(
          message.guild,
          message.author.id,
          role.id,
          ADMIN_COMMAND_PERMISSION
        );

        if (!removed) {
          await message.reply(`O cargo ${role} não estava configurado como administrador do bot.`);
          return;
        }

        await sendStaffLog(message, services, {
          title: "Permissão administrativa removida",
          description: `O cargo ${role} não pode mais usar comandos administrativos pelo bot.`
        });
        await message.reply(`Cargo ${role} removido das permissões administrativas.`);
        return;
      }

      await message.reply(`Use \`${prefix}config permissao listar\`, \`${prefix}config permissao adicionar @cargo\` ou \`${prefix}config permissao remover @cargo\`.`);
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
