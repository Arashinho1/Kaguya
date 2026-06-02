import type { Message } from "discord.js";

import { DEFAULT_PREFIX } from "../config/defaults.js";
import { commands } from "../commands/index.js";
import { canManageGuild } from "../services/permissions.js";
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

  if (command.staffOnly && !canManageGuild(message)) {
    await message.reply("Você precisa ter Administrador ou Gerenciar Servidor para usar esse comando.");
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
  } catch (error) {
    console.error(`[command:${command.name}]`, error);
    await message.reply("Não consegui executar esse comando. Verifique os logs do bot.");
  }
}
