import { EmbedBuilder, type Guild, type User } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import type { CharacterWithWorld } from "../modules/characters/CharacterService.js";
import { CombatRuleError } from "../modules/combat/CombatService.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "combat",
  name: "Combate",
  description: "Duelos entre jogadores: desafio amistoso ou forçado, aceite e finalização pela staff."
});

const jogadorArgs = [
  { name: "jogador", type: "user", description: "Jogador desafiado." }
] as const satisfies readonly ArgDef[];

const semArgs = [] as const satisfies readonly ArgDef[];

export const duelCommand = defineCommandGroup<CommandServices>({
  name: "duelo",
  description: "Desafia outro jogador para um duelo.",
  access: "member",
  module: "combat",
  defaultSubcommand: "status",
  subcommands: [
    defineSubcommand<typeof jogadorArgs, CommandServices>({
      name: "desafiar",
      description: "Desafia outro jogador — ele precisa aceitar (.duelo aceitar) antes de começar.",
      args: jogadorArgs,
      async handler(ctx) {
        const [challenger, opponent] = await requireBothCharacters(ctx);
        if (!challenger || !opponent) return;

        await ctx.services.combat.challengeDuel(ctx.guild, ctx.channelId, challenger, opponent, false);
        await ctx.reply(
          `**${challenger.name}** desafiou **${opponent.name}** para um duelo! Use \`.duelo aceitar\` para começar.`
        );
      }
    }),

    defineSubcommand<typeof jogadorArgs, CommandServices>({
      name: "forcar",
      description: "Força outro jogador a um duelo, sem precisar de aceite — começa na hora.",
      args: jogadorArgs,
      async handler(ctx) {
        const [challenger, opponent] = await requireBothCharacters(ctx);
        if (!challenger || !opponent) return;

        await ctx.services.combat.challengeDuel(ctx.guild, ctx.channelId, challenger, opponent, true);
        await ctx.reply(`**${challenger.name}** forçou um duelo contra **${opponent.name}**! O duelo começou.`);
      }
    }),

    defineSubcommand<typeof semArgs, CommandServices>({
      name: "aceitar",
      description: "Aceita um desafio de duelo pendente.",
      args: semArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
        if (!character) {
          await ctx.reply("Você ainda não tem uma ficha.");
          return;
        }

        await ctx.services.combat.acceptDuel(ctx.guild, character);
        await ctx.reply(`**${character.name}** aceitou o duelo! Que comece a luta.`);
      }
    }),

    defineSubcommand<typeof semArgs, CommandServices>({
      name: "recusar",
      description: "Recusa um desafio de duelo pendente.",
      args: semArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
        if (!character) {
          await ctx.reply("Você ainda não tem uma ficha.");
          return;
        }

        await ctx.services.combat.declineDuel(ctx.guild, character);
        await ctx.reply(`**${character.name}** recusou o duelo.`);
      }
    }),

    defineSubcommand<typeof semArgs, CommandServices>({
      name: "status",
      description: "Mostra o duelo ativo neste canal.",
      args: semArgs,
      async handler(ctx) {
        const duel = await ctx.services.combat.getActiveDuelInChannel(ctx.guild, ctx.channelId);
        if (!duel) {
          await ctx.reply("Nenhum duelo ativo neste canal.");
          return;
        }

        await ctx.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("Duelo em andamento")
              .addFields(
                { name: "Tipo", value: duel.isForced ? "Forçado" : "Amistoso", inline: true },
                { name: "Iniciado em", value: `<t:${Math.floor(duel.createdAt.getTime() / 1000)}:R>`, inline: true }
              )
              .setFooter({ text: "A staff finaliza com .combateadmin finalizar @vencedor" })
          ]
        });
      }
    })
  ]
});

async function requireBothCharacters(ctx: {
  guild: Guild;
  user: User;
  args: { jogador: User };
  services: CommandServices;
  reply(payload: string): Promise<void>;
}): Promise<readonly [CharacterWithWorld, CharacterWithWorld] | readonly [null, null]> {
  const challenger = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
  if (!challenger) {
    await ctx.reply("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
    return [null, null] as const;
  }

  const opponent = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.args.jogador.id);
  if (!opponent) {
    await ctx.reply(`${ctx.args.jogador.username} ainda não tem uma ficha ativa.`);
    return [null, null] as const;
  }

  return [challenger, opponent] as const;
}

const finalizarArgs = [
  { name: "vencedor", type: "user", description: "Jogador vencedor do duelo ativo neste canal." }
] as const satisfies readonly ArgDef[];

export const combatAdminCommand = defineCommandGroup<CommandServices>({
  name: "combateadmin",
  description: "Finaliza duelos ativos (o escopo de onde o duelo funciona agora é em .setar).",
  access: "admin",
  module: "combat",
  subcommands: [
    defineSubcommand<typeof finalizarArgs, CommandServices>({
      name: "finalizar",
      description: "Finaliza o duelo ativo neste canal, declarando o vencedor.",
      args: finalizarArgs,
      async handler(ctx) {
        const winner = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.args.vencedor.id);
        if (!winner) {
          throw new CombatRuleError(`${ctx.args.vencedor.username} não tem uma ficha ativa.`);
        }

        await ctx.services.combat.finalizeDuel(ctx.guild, ctx.user.id, ctx.channelId, winner.id);
        await ctx.reply(`Duelo finalizado! Vencedor: **${winner.name}**.`);
      }
    })
  ]
});
