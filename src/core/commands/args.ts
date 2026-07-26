import type { ChatInputCommandInteraction, Guild, SlashCommandBuilder } from "discord.js";

import { CommandArgError } from "./errors.js";
import type { ArgDef } from "./types.js";

const USER_MENTION = /^<@!?(\d+)>$/;
const CHANNEL_MENTION = /^<#(\d+)>$/;
const ROLE_MENTION = /^<@&(\d+)>$/;
const RAW_SNOWFLAKE = /^\d{17,20}$/;

const TRUTHY = new Set(["true", "sim", "1", "on", "ativar", "ativo"]);
const FALSY = new Set(["false", "nao", "não", "0", "off", "desativar", "inativo"]);

/** Valida a forma da lista de args em tempo de definição do comando (bug de dev, não de usuário). */
export function validateArgDefs(args: readonly ArgDef[]): void {
  let seenOptional = false;

  args.forEach((arg, index) => {
    const isLast = index === args.length - 1;
    const required = arg.required ?? true;

    if (arg.type === "text" && !isLast) {
      throw new Error(`Argumento "${arg.name}" do tipo "text" precisa ser o último argumento.`);
    }

    if (!required) {
      seenOptional = true;
    } else if (seenOptional) {
      throw new Error(`Argumento "${arg.name}" é obrigatório mas vem depois de um argumento opcional.`);
    }
  });
}

export function applySlashOptions(builder: SlashCommandBuilder, args: readonly ArgDef[]): void {
  for (const arg of args) {
    const required = arg.required ?? true;

    switch (arg.type) {
      case "string":
      case "text":
        builder.addStringOption((option) => {
          option.setName(arg.name).setDescription(arg.description).setRequired(required);
          if (arg.choices) {
            option.addChoices(...arg.choices.map((value) => ({ name: value, value })));
          }
          return option;
        });
        break;
      case "integer":
        builder.addIntegerOption((option) => {
          option.setName(arg.name).setDescription(arg.description).setRequired(required);
          if (arg.min !== undefined) option.setMinValue(arg.min);
          if (arg.max !== undefined) option.setMaxValue(arg.max);
          return option;
        });
        break;
      case "number":
        builder.addNumberOption((option) => {
          option.setName(arg.name).setDescription(arg.description).setRequired(required);
          if (arg.min !== undefined) option.setMinValue(arg.min);
          if (arg.max !== undefined) option.setMaxValue(arg.max);
          return option;
        });
        break;
      case "boolean":
        builder.addBooleanOption((option) =>
          option.setName(arg.name).setDescription(arg.description).setRequired(required)
        );
        break;
      case "user":
        builder.addUserOption((option) =>
          option.setName(arg.name).setDescription(arg.description).setRequired(required)
        );
        break;
      case "channel":
        builder.addChannelOption((option) =>
          option.setName(arg.name).setDescription(arg.description).setRequired(required)
        );
        break;
      case "role":
        builder.addRoleOption((option) =>
          option.setName(arg.name).setDescription(arg.description).setRequired(required)
        );
        break;
    }
  }
}

export function extractSlashArgs(
  args: readonly ArgDef[],
  interaction: ChatInputCommandInteraction
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const arg of args) {
    switch (arg.type) {
      case "string":
      case "text":
        result[arg.name] = interaction.options.getString(arg.name) ?? undefined;
        break;
      case "integer":
        result[arg.name] = interaction.options.getInteger(arg.name) ?? undefined;
        break;
      case "number":
        result[arg.name] = interaction.options.getNumber(arg.name) ?? undefined;
        break;
      case "boolean":
        result[arg.name] = interaction.options.getBoolean(arg.name) ?? undefined;
        break;
      case "user":
        result[arg.name] = interaction.options.getUser(arg.name) ?? undefined;
        break;
      case "channel":
        result[arg.name] = interaction.options.getChannel(arg.name) ?? undefined;
        break;
      case "role":
        result[arg.name] = interaction.options.getRole(arg.name) ?? undefined;
        break;
    }
  }

  return result;
}

export async function parsePrefixArgs(
  args: readonly ArgDef[],
  rawArgs: string[],
  guild: Guild
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  let cursor = 0;

  for (const arg of args) {
    const required = arg.required ?? true;

    if (arg.type === "text") {
      const rest = rawArgs.slice(cursor).join(" ").trim();
      cursor = rawArgs.length;

      if (!rest) {
        if (required) {
          throw new CommandArgError(`Argumento **${arg.name}** é obrigatório.`);
        }
        result[arg.name] = undefined;
        continue;
      }

      result[arg.name] = rest;
      continue;
    }

    const token = rawArgs[cursor];

    if (token === undefined) {
      if (required) {
        throw new CommandArgError(`Argumento **${arg.name}** é obrigatório.`);
      }
      result[arg.name] = undefined;
      continue;
    }

    cursor += 1;
    result[arg.name] = await parseToken(arg, token, guild);
  }

  return result;
}

async function parseToken(arg: ArgDef, token: string, guild: Guild): Promise<unknown> {
  switch (arg.type) {
    case "string": {
      if (arg.choices && !arg.choices.includes(token)) {
        throw new CommandArgError(
          `Valor inválido para **${arg.name}**. Opções: ${arg.choices.join(", ")}.`
        );
      }
      return token;
    }

    case "integer": {
      const value = Number.parseInt(token, 10);
      return validateNumber(arg, value);
    }

    case "number": {
      const value = Number.parseFloat(token);
      return validateNumber(arg, value);
    }

    case "boolean": {
      const normalized = token.toLowerCase();
      if (TRUTHY.has(normalized)) return true;
      if (FALSY.has(normalized)) return false;
      throw new CommandArgError(`Valor inválido para **${arg.name}**: use sim/não.`);
    }

    case "user": {
      const id = extractId(token, USER_MENTION);
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) {
        throw new CommandArgError(`Não encontrei o usuário informado em **${arg.name}**.`);
      }
      return member.user;
    }

    case "channel": {
      const id = extractId(token, CHANNEL_MENTION);
      const channel = await guild.channels.fetch(id).catch(() => null);
      if (!channel) {
        throw new CommandArgError(`Não encontrei o canal informado em **${arg.name}**.`);
      }
      return channel;
    }

    case "role": {
      const id = extractId(token, ROLE_MENTION);
      const role = await guild.roles.fetch(id).catch(() => null);
      if (!role) {
        throw new CommandArgError(`Não encontrei o cargo informado em **${arg.name}**.`);
      }
      return role;
    }

    default:
      return token;
  }
}

function validateNumber(arg: ArgDef, value: number): number {
  if (Number.isNaN(value)) {
    throw new CommandArgError(`Valor inválido para **${arg.name}**: precisa ser um número.`);
  }
  if (arg.min !== undefined && value < arg.min) {
    throw new CommandArgError(`Valor de **${arg.name}** precisa ser >= ${arg.min}.`);
  }
  if (arg.max !== undefined && value > arg.max) {
    throw new CommandArgError(`Valor de **${arg.name}** precisa ser <= ${arg.max}.`);
  }
  return value;
}

function extractId(token: string, mentionPattern: RegExp): string {
  const mentionMatch = mentionPattern.exec(token);
  if (mentionMatch?.[1]) {
    return mentionMatch[1];
  }
  if (RAW_SNOWFLAKE.test(token)) {
    return token;
  }
  throw new CommandArgError(`"${token}" não é uma menção ou ID válido.`);
}
