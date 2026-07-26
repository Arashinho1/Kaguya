import { SlashCommandBuilder, type ChatInputCommandInteraction, type Message } from "discord.js";

import { applySlashOptions, extractSlashArgs, parsePrefixArgs, validateArgDefs } from "./args.js";
import { buildContextFromInteraction, buildContextFromMessage } from "./context.js";
import { CommandArgError } from "./errors.js";
import type { ArgDef, ArgsResult, CommandAccess, CommandDefinition } from "./types.js";

export interface HybridCommand<TArgs extends readonly ArgDef[], TServices, TModule extends string = string> {
  name: string;
  description: string;
  aliases: readonly string[];
  access: CommandAccess;
  module?: TModule;
  args: TArgs;
  toSlashBuilder(): SlashCommandBuilder;
  executeFromMessage(message: Message<true>, rawArgs: string[], services: TServices): Promise<void>;
  executeFromInteraction(
    interaction: ChatInputCommandInteraction<"cached">,
    services: TServices
  ): Promise<void>;
}

/**
 * Define um comando uma única vez (nome, args, access, handler) e deriva o parser de
 * prefixo e o SlashCommandBuilder/handler de interação a partir da mesma definição.
 * Prefixo é o caminho primário do bot; slash é sempre um espelho gerado daqui.
 */
export function defineCommand<
  const TArgs extends readonly ArgDef[] = readonly [],
  TServices = unknown,
  TModule extends string = string
>(def: CommandDefinition<TArgs, TServices, TModule>): HybridCommand<TArgs, TServices, TModule> {
  const args = def.args ?? (([] as unknown) as TArgs);
  validateArgDefs(args);

  return {
    name: def.name,
    description: def.description,
    aliases: def.aliases ?? [],
    access: def.access,
    module: def.module,
    args,

    toSlashBuilder(): SlashCommandBuilder {
      const builder = new SlashCommandBuilder().setName(def.name).setDescription(def.description);
      applySlashOptions(builder, args);
      return builder;
    },

    async executeFromMessage(message, rawArgs, services): Promise<void> {
      let parsed: Record<string, unknown>;

      try {
        parsed = await parsePrefixArgs(args, rawArgs, message.guild);
      } catch (error) {
        if (error instanceof CommandArgError) {
          await message.reply(error.message);
          return;
        }
        throw error;
      }

      const context = buildContextFromMessage(message, parsed as ArgsResult<TArgs>, services);
      await def.handler(context);
    },

    async executeFromInteraction(interaction, services): Promise<void> {
      let parsed: Record<string, unknown>;

      try {
        parsed = extractSlashArgs(args, interaction);
      } catch (error) {
        if (error instanceof CommandArgError) {
          await interaction.reply({ content: error.message, ephemeral: true });
          return;
        }
        throw error;
      }

      const context = buildContextFromInteraction(interaction, parsed as ArgsResult<TArgs>, services);
      await def.handler(context);
    }
  };
}
