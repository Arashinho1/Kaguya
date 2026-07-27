import type { ChatInputCommandInteraction, Message } from "discord.js";

import type { ArgDef, ArgsResult, CommandContext, ReplyPayload } from "./types.js";

export function buildContextFromMessage<TArgs extends readonly ArgDef[], TServices>(
  message: Message<true>,
  args: ArgsResult<TArgs>,
  services: TServices
): CommandContext<TArgs, TServices> {
  return {
    isSlash: false,
    guild: message.guild,
    user: message.author,
    member: message.member,
    channelId: message.channelId,
    args,
    services,
    source: message,
    async reply(payload: ReplyPayload): Promise<void> {
      if (typeof payload === "string") {
        await message.reply(payload);
        return;
      }
      await message.reply({
        content: payload.content,
        embeds: payload.embeds,
        components: payload.components,
        files: payload.files
      });
    }
  };
}

export function buildContextFromInteraction<TArgs extends readonly ArgDef[], TServices>(
  interaction: ChatInputCommandInteraction<"cached">,
  args: ArgsResult<TArgs>,
  services: TServices
): CommandContext<TArgs, TServices> {
  return {
    isSlash: true,
    guild: interaction.guild,
    user: interaction.user,
    member: interaction.member,
    channelId: interaction.channelId,
    args,
    services,
    source: interaction,
    async reply(payload: ReplyPayload): Promise<void> {
      const normalized =
        typeof payload === "string"
          ? { content: payload }
          : {
              content: payload.content,
              embeds: payload.embeds,
              components: payload.components,
              files: payload.files,
              ephemeral: payload.ephemeral
            };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(normalized);
        return;
      }
      await interaction.reply(normalized);
    }
  };
}
