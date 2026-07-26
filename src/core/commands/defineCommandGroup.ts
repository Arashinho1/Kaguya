import { SlashCommandBuilder, type ChatInputCommandInteraction, type Message } from "discord.js";

import { applySlashOptions, extractSlashArgs, parsePrefixArgs, validateArgDefs } from "./args.js";
import { buildContextFromInteraction, buildContextFromMessage } from "./context.js";
import type { HybridCommand } from "./defineCommand.js";
import { CommandArgError } from "./errors.js";
import type { ArgDef, ArgsResult, CommandAccess, CommandContext } from "./types.js";

export interface SubcommandDefinition<TArgs extends readonly ArgDef[], TServices> {
  name: string;
  description: string;
  args?: TArgs;
  handler(context: CommandContext<TArgs, TServices>): Promise<void>;
}

export function defineSubcommand<const TArgs extends readonly ArgDef[] = readonly [], TServices = unknown>(
  def: SubcommandDefinition<TArgs, TServices>
): SubcommandDefinition<TArgs, TServices> {
  validateArgDefs(def.args ?? (([] as unknown) as TArgs));
  return def;
}

export interface CommandGroupDefinition<TServices, TModule extends string = string> {
  name: string;
  description: string;
  aliases?: readonly string[];
  access: CommandAccess;
  module?: TModule;
  subcommands: readonly SubcommandDefinition<readonly ArgDef[], TServices>[];
  /** No modo prefixo, `.comando` sem subcomando explícito roda este. Slash sempre exige o subcomando. */
  defaultSubcommand?: string;
}

/**
 * Comando com subcomandos (`.config prefixo .`, `/config prefixo valor:.`). Cada subcomando
 * é uma SubcommandDefinition independente; o grupo deriva o SlashCommandBuilder (com um
 * addSubcommand por entrada) e o roteamento de prefixo (primeiro token seleciona o subcomando).
 */
export function defineCommandGroup<TServices, TModule extends string = string>(
  def: CommandGroupDefinition<TServices, TModule>
): HybridCommand<readonly [], TServices, TModule> {
  const subcommandNames = def.subcommands.map((sub) => sub.name).join(", ");

  function findSubcommand(name: string): SubcommandDefinition<readonly ArgDef[], TServices> | undefined {
    return def.subcommands.find((sub) => sub.name === name.toLowerCase());
  }

  return {
    name: def.name,
    description: def.description,
    aliases: def.aliases ?? [],
    access: def.access,
    module: def.module,
    args: [] as const,

    toSlashBuilder(): SlashCommandBuilder {
      const builder = new SlashCommandBuilder().setName(def.name).setDescription(def.description);

      for (const sub of def.subcommands) {
        builder.addSubcommand((subBuilder) => {
          subBuilder.setName(sub.name).setDescription(sub.description);
          applySlashOptions(subBuilder, sub.args ?? []);
          return subBuilder;
        });
      }

      return builder;
    },

    async executeFromMessage(message: Message<true>, rawArgs: string[], services: TServices): Promise<void> {
      const [firstToken, ...restIfExplicit] = rawArgs;
      const explicit = firstToken !== undefined ? findSubcommand(firstToken) : undefined;

      let sub: SubcommandDefinition<readonly ArgDef[], TServices> | undefined;
      let rest: string[];

      if (explicit) {
        sub = explicit;
        rest = restIfExplicit;
      } else if (def.defaultSubcommand) {
        sub = findSubcommand(def.defaultSubcommand);
        rest = rawArgs;
      } else if (!firstToken) {
        await message.reply(`Use um subcomando: ${subcommandNames}.`);
        return;
      } else {
        await message.reply(`Subcomando desconhecido. Opções: ${subcommandNames}.`);
        return;
      }

      if (!sub) {
        await message.reply(`Subcomando desconhecido. Opções: ${subcommandNames}.`);
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = await parsePrefixArgs(sub.args ?? [], rest, message.guild);
      } catch (error) {
        if (error instanceof CommandArgError) {
          await message.reply(error.message);
          return;
        }
        throw error;
      }

      const context = buildContextFromMessage(message, parsed as ArgsResult<readonly ArgDef[]>, services);
      await sub.handler(context);
    },

    async executeFromInteraction(
      interaction: ChatInputCommandInteraction<"cached">,
      services: TServices
    ): Promise<void> {
      const subName = interaction.options.getSubcommand(true);
      const sub = findSubcommand(subName);

      if (!sub) {
        await interaction.reply({ content: `Subcomando desconhecido. Opções: ${subcommandNames}.`, ephemeral: true });
        return;
      }

      const parsed = extractSlashArgs(sub.args ?? [], interaction);
      const context = buildContextFromInteraction(interaction, parsed as ArgsResult<readonly ArgDef[]>, services);
      await sub.handler(context);
    }
  };
}
