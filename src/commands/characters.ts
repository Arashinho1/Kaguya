import { EmbedBuilder } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "characters",
  name: "Fichas",
  description: "Personagens, ficha pública e criação de personagem."
});

const verArgs = [
  { name: "usuario", type: "user", description: "Ver a ficha de outro jogador.", required: false }
] as const satisfies readonly ArgDef[];

const criarArgs = [
  { name: "nome", type: "text", description: "Nome do personagem." }
] as const satisfies readonly ArgDef[];

export const characterCommand = defineCommandGroup<CommandServices>({
  name: "ficha",
  aliases: ["personagem", "perfil"],
  description: "Mostra ou cria sua ficha de personagem.",
  access: "member",
  module: "characters",
  defaultSubcommand: "ver",
  subcommands: [
    defineSubcommand<typeof verArgs, CommandServices>({
      name: "ver",
      description: "Mostra sua ficha ou a de outro jogador.",
      args: verArgs,
      async handler(ctx) {
        const target = ctx.args.usuario ?? ctx.user;
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, target.id);

        if (!character) {
          await ctx.reply(
            target.id === ctx.user.id
              ? "Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`."
              : `${target.username} ainda não tem uma ficha ativa.`
          );
          return;
        }

        const view = await ctx.services.characters.getCharacterView(ctx.guild, character);

        const embed = new EmbedBuilder()
          .setTitle(view.character.name)
          .setDescription(
            view.attributes.length > 0
              ? view.attributes.map((attr) => `**${attr.name}**: ${attr.value}`).join("\n")
              : "Nenhum atributo configurado neste servidor ainda."
          )
          .addFields({ name: "Chakra", value: String(view.chakra), inline: true });

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<typeof criarArgs, CommandServices>({
      name: "criar",
      description: "Cria seu personagem neste servidor.",
      args: criarArgs,
      async handler(ctx) {
        const created = await ctx.services.characters.createCharacter(ctx.guild, ctx.user.id, ctx.args.nome);
        await ctx.reply(`Ficha criada: **${created.name}**. Use \`.ficha\` para ver seus atributos.`);
      }
    })
  ]
});
