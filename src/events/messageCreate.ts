import type { Message } from "discord.js";

import { commandRegistry } from "../commands/index.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";

export async function handleMessageCreate(message: Message, services: CommandServices): Promise<void> {
  if (message.author.bot || !message.guild || !message.inGuild()) {
    return;
  }

  const prefix = await services.guildConfig.getPrefix(message.guild).catch(() => ".");

  if (!message.content.startsWith(prefix)) {
    return;
  }

  const [rawCommandName, ...rawArgs] = message.content.slice(prefix.length).trim().split(/\s+/);

  if (!rawCommandName) {
    return;
  }

  const command = commandRegistry.get(rawCommandName);

  if (!command) {
    return;
  }

  const hasAccess = await canUseCommandAccess(
    command.access,
    message.member,
    message.client,
    services.guildConfig
  );

  if (!hasAccess) {
    await message.reply(getAccessDeniedMessage(command.access));
    return;
  }

  if (command.module && !(await services.guildConfig.isModuleEnabled(message.guild, command.module))) {
    await message.reply(
      `O módulo **${command.module}** está desativado neste servidor. A staff pode reativar em \`${prefix}config\`.`
    );
    return;
  }

  try {
    await command.executeFromMessage(message, rawArgs, services);
  } catch (error) {
    console.error(`[command:${command.name}]`, error);
    await message.reply("Não consegui executar esse comando. Verifique os logs do bot.");
  }
}

function getAccessDeniedMessage(access: "owner" | "admin" | "member"): string {
  if (access === "owner") {
    return "Esse comando é restrito ao dono do bot. Configure `BOT_OWNER_IDS` se quiser liberar IDs específicos.";
  }

  if (access === "admin") {
    return "Você precisa ter Administrador ou Gerenciar Servidor para usar esse comando.";
  }

  return "Você não tem permissão para usar esse comando.";
}
