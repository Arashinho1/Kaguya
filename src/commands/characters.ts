import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { buildCreatePromptView, buildFichaView } from "./fichaMenu.js";
import type { LinkKind } from "../modules/characters/CharacterService.js";
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

const LINK_KINDS = ["cla", "vila"] as const;

const vincularArgs = [
  { name: "tipo", type: "string", description: "cla ou vila.", choices: LINK_KINDS },
  { name: "nome", type: "text", description: "Nome do clã ou da vila." }
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
      description: "Abre o menu da sua ficha (ou mostra a de outro jogador).",
      args: verArgs,
      async handler(ctx) {
        const target = ctx.args.usuario ?? ctx.user;
        const isOwner = target.id === ctx.user.id;
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, target.id);

        if (!character) {
          if (!isOwner) {
            await ctx.reply(`${target.username} ainda não tem uma ficha ativa.`);
            return;
          }
          await ctx.reply(buildCreatePromptView());
          return;
        }

        const view = await buildFichaView(ctx.guild, character, ctx.services, isOwner);
        await ctx.reply(view);
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
    }),

    defineSubcommand<typeof vincularArgs, CommandServices>({
      name: "vincular",
      description: "Vincula sua ficha a um clã ou vila cadastrado.",
      args: vincularArgs,
      async handler(ctx) {
        const updated = await ctx.services.characters.linkCharacter(
          ctx.guild,
          ctx.user.id,
          ctx.args.tipo as LinkKind,
          ctx.args.nome
        );
        await ctx.reply(`Ficha **${updated.name}** atualizada.`);
      }
    })
  ]
});
