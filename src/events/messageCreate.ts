import type { Message } from "discord.js";

import { commandRegistry } from "../commands/index.js";
import { DomainError } from "../core/errors.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";

export async function handleMessageCreate(message: Message, services: CommandServices): Promise<void> {
  if (message.author.bot || !message.guild || !message.inGuild()) {
    return;
  }

  const prefix = await services.guildConfig.getPrefix(message.guild).catch(() => ".");

  if (!message.content.startsWith(prefix)) {
    await handleNarratedJutsuUse(message, services);
    await handlePretensaoClaim(message, services);
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
    if (error instanceof DomainError) {
      await message.reply(error.message);
      return;
    }
    console.error(`[command:${command.name}]`, error);
    await message.reply("Não consegui executar esse comando. Verifique os logs do bot.");
  }
}

/**
 * Detecção narrada de jutsu: age em qualquer canal, não só dentro de um `.duelo` formal —
 * luta narrada acontece o tempo todo fora de duelo estruturado, então não faz sentido travar
 * a detecção a isso. Nenhum match não é erro (RP livre não deve ser punido); um jutsu
 * reconhecido mas que falhou (não aprendido, chakra insuficiente) vira uma resposta curta.
 */
async function handleNarratedJutsuUse(message: Message<true>, services: CommandServices): Promise<void> {
  if (!(await services.guildConfig.isModuleEnabled(message.guild, "jutsus").catch(() => true))) {
    return;
  }

  const identifiers = extractBracketedText(message.content);
  if (identifiers.length === 0) {
    return;
  }

  const character = await services.characters.getActiveCharacter(message.guild, message.author.id);
  if (!character) {
    return;
  }

  if (!(await services.jutsus.isNarrationChannelAllowed(message.guild, message.channelId))) {
    return;
  }

  for (const text of identifiers) {
    const jutsu = await services.jutsus.findJutsuFuzzy(message.guild, text);
    if (!jutsu) {
      continue;
    }

    try {
      await services.jutsus.useJutsu(message.guild, message.author.id, character, jutsu.key);
      await message.react("🔥").catch(() => {});
    } catch (error) {
      if (error instanceof DomainError) {
        await message.reply(`\`${text}\`: ${error.message}`);
        continue;
      }
      throw error;
    }
  }
}

/**
 * Pretensão de vaga: no canal configurado, uma mensagem cujo conteúdo bate com o ID de uma
 * vaga habilitada tenta o claim. Sem match nenhum (canal errado ou texto não é ID de vaga
 * nenhuma) é ignorado silenciosamente — não é todo mundo que vai mandar só o ID puro ali.
 */
async function handlePretensaoClaim(message: Message<true>, services: CommandServices): Promise<void> {
  if (!(await services.guildConfig.isModuleEnabled(message.guild, "vagas").catch(() => true))) {
    return;
  }

  const result = await services.pretensao.attemptClaim(message.guild, {
    channelId: message.channelId,
    content: message.content,
    authorId: message.author.id
  });

  if (result.kind === "ignored") {
    return;
  }

  if (result.kind === "failed") {
    await message.reply(result.reason).catch(() => {});
    return;
  }

  await message.react("✅").catch(() => {});
}

function extractBracketedText(content: string): string[] {
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
