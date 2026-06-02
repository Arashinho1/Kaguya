import { ChannelType, EmbedBuilder } from "discord.js";

import { DEFAULT_MODULES, isGuildModuleKey } from "../../config/defaults.js";
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

function normalizeModuleAlias(value: string): "characters" | "attributes" | null {
  const key = value.trim().toLowerCase();

  if (["ficha", "fichas", "personagem", "personagens"].includes(key)) {
    return "characters";
  }

  if (["atributo", "atributos", "chakra"].includes(key)) {
    return "attributes";
  }

  return isGuildModuleKey(key) ? key : null;
}

export const configCommand: PrefixCommand = {
  name: "config",
  aliases: ["cfg"],
  access: "admin",
  description: "Mostra e altera configurações do RPG neste servidor.",
  usage: ".config | .config log #canal | .config permissao adicionar @cargo | .config modulo ativar ficha",
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

    if (["modulo", "módulo", "modulos", "módulos"].includes(subcommand)) {
      const action = args.shift()?.toLowerCase();

      if (!action || ["listar", "lista", "ver"].includes(action)) {
        const moduleStatus = await services.guildConfig.getModuleStatus(message.guild);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2b6cb0)
              .setTitle("Módulos do servidor")
              .setDescription(
                DEFAULT_MODULES.map((module) =>
                  [
                    `**${module.name}** \`[${module.key}]\``,
                    `Status: **${moduleStatus[module.key] ? "Ativo" : "Inativo"}**`,
                    module.description
                  ].join("\n")
                ).join("\n\n")
              )
          ]
        });
        return;
      }

      const moduleKey = normalizeModuleAlias(args[0] ?? "");

      if (!moduleKey) {
        await message.reply(
          `Use \`${prefix}config modulo ativar chave\` ou \`${prefix}config modulo desativar chave\`. Módulos: ${DEFAULT_MODULES.map((module) => `\`${module.key}\``).join(", ")}.`
        );
        return;
      }

      if (["ativar", "on", "enable"].includes(action)) {
        const module = DEFAULT_MODULES.find((entry) => entry.key === moduleKey);
        await services.guildConfig.setModuleEnabled(message.guild, message.author.id, moduleKey, true);
        await sendStaffLog(message, services, {
          title: "Módulo ativado",
          description: `O módulo **${module?.name ?? moduleKey}** foi ativado.`
        });
        await message.reply(`Módulo **${module?.name ?? moduleKey}** ativado.`);
        return;
      }

      if (["desativar", "off", "disable"].includes(action)) {
        const module = DEFAULT_MODULES.find((entry) => entry.key === moduleKey);
        await services.guildConfig.setModuleEnabled(message.guild, message.author.id, moduleKey, false);
        await sendStaffLog(message, services, {
          title: "Módulo desativado",
          description: `O módulo **${module?.name ?? moduleKey}** foi desativado.`
        });
        await message.reply(`Módulo **${module?.name ?? moduleKey}** desativado.`);
        return;
      }

      await message.reply(`Use \`${prefix}config modulo listar\`, \`${prefix}config modulo ativar chave\` ou \`${prefix}config modulo desativar chave\`.`);
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
