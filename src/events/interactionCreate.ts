import type { Interaction } from "discord.js";

import { commandRegistry } from "../commands/index.js";
import { menuRegistry } from "../commands/menus.js";
import { DomainError } from "../core/errors.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";

export async function handleInteractionCreate(
  interaction: Interaction,
  services: CommandServices
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    return;
  }

  if (
    interaction.isStringSelectMenu() ||
    interaction.isChannelSelectMenu() ||
    interaction.isButton() ||
    interaction.isModalSubmit()
  ) {
    try {
      await menuRegistry.dispatch(interaction, services);
    } catch (error) {
      console.error("[menu]", error);
      const payload = { content: "Não consegui processar essa ação. Tente novamente.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandRegistry.get(interaction.commandName);

  if (!command) {
    return;
  }

  const hasAccess = await canUseCommandAccess(
    command.access,
    interaction.member,
    interaction.client,
    services.guildConfig
  );

  if (!hasAccess) {
    await interaction.reply({ content: getAccessDeniedMessage(command.access), ephemeral: true });
    return;
  }

  if (command.module && !(await services.guildConfig.isModuleEnabled(interaction.guild, command.module))) {
    await interaction.reply({
      content: `O módulo **${command.module}** está desativado neste servidor.`,
      ephemeral: true
    });
    return;
  }

  try {
    await command.executeFromInteraction(interaction, services);
  } catch (error) {
    const payload = error instanceof DomainError
      ? { content: error.message, ephemeral: true }
      : { content: "Não consegui executar esse comando. Verifique os logs do bot.", ephemeral: true };

    if (!(error instanceof DomainError)) {
      console.error(`[command:${command.name}]`, error);
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}

function getAccessDeniedMessage(access: "owner" | "admin" | "member"): string {
  if (access === "owner") {
    return "Esse comando é restrito ao dono do bot.";
  }

  if (access === "admin") {
    return "Você precisa ter Administrador ou Gerenciar Servidor para usar esse comando.";
  }

  return "Você não tem permissão para usar esse comando.";
}
