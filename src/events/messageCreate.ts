import type { Message } from "discord.js";

import { DEFAULT_MODULES, DEFAULT_PREFIX } from "../config/defaults.js";
import { commands } from "../commands/index.js";
import { CombatRuleError } from "../modules/combat/CombatService.js";
import { JutsuRuleError } from "../modules/jutsus/JutsuService.js";
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
    await handleNarratedCombatAction(message, services);
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

async function handleNarratedCombatAction(
  message: Message<true>,
  services: CommandServices
): Promise<void> {
  if (!(await services.guildConfig.isModuleEnabled(message.guild, "combat").catch(() => true))) {
    return;
  }

  const identifiers = extractBracketedJutsus(message.content);

  if (identifiers.length === 0) {
    return;
  }

  const errors: string[] = [];

  for (const identifier of identifiers) {
    try {
      await services.combat.recordNarratedJutsuUse(message.guild, message.author, message.channelId, identifier);
    } catch (error) {
      if (error instanceof CombatRuleError || error instanceof JutsuRuleError) {
        errors.push(`\`${identifier}\`: ${error.message}`);
        continue;
      }

      throw error;
    }
  }

  if (errors.length > 0) {
    await message.reply(`Não registrei o uso de jutsu:\n${errors.slice(0, 3).join("\n")}`);
  }
}

function extractBracketedJutsus(content: string): string[] {
  const identifiers = new Set<string>();
  const pattern = /\[([^\]\n]{1,120})\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const identifier = match[1]?.trim();

    if (identifier) {
      identifiers.add(identifier);
    }
  }

  return [...identifiers];
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
