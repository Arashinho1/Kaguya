import type { Message } from "discord.js";

import { DEFAULT_MODULES, DEFAULT_PREFIX } from "../config/defaults.js";
import { commands } from "../commands/index.js";
import { sendCommandUsageLog } from "../services/commandUsageLog.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";

export async function handleMessageCreate(
  message: Message,
  services: CommandServices
): Promise<void> {
  if (message.author.bot || !message.guild || !message.inGuild()) {
    return;
  }

  const prefix = await services.guildConfig.getPrefix(message.guild).catch(() => DEFAULT_PREFIX);

  if (!message.content.startsWith(prefix)) {
    return;
  }

  const [rawCommandName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);

  if (!rawCommandName) {
    return;
  }

  const commandName = rawCommandName.toLowerCase();
  const command = commands.get(commandName);

  if (!command) {
    return;
  }

  const hasAccess = await canUseCommandAccess(message, command.access, services.guildConfig);

  if (!hasAccess) {
    await message.reply(getAccessDeniedMessage(command.access));
    return;
  }

  if (command.module && !(await services.guildConfig.isModuleEnabled(message.guild, command.module))) {
    await message.reply(
      `O módulo **${getModuleName(command.module)}** está desativado neste servidor. A staff pode reativar em \`${prefix}config\`.`
    );
    return;
  }

  try {
    await command.execute({
      message,
      args,
      commandName,
      prefix,
      services
    });
    await sendCommandUsageLog(message, services, { commandName }).catch((error) => {
      console.error(`[command-log:${command.name}]`, error);
    });
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

function getModuleName(moduleKey: string): string {
  return DEFAULT_MODULES.find((module) => module.key === moduleKey)?.name ?? moduleKey;
}
