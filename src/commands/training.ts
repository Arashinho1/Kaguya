import { EmbedBuilder } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { TrainingRuleError } from "../modules/training/TrainingService.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "training",
  name: "Treino",
  description: "Pontos de treino gastos para evoluir os atributos da ficha."
});

const verArgs = [] as const satisfies readonly ArgDef[];

const treinarArgs = [
  { name: "atributo", type: "string", description: "Chave do atributo a evoluir." },
  { name: "quantidade", type: "integer", description: "Quantos pontos evoluir.", min: 1 }
] as const satisfies readonly ArgDef[];

export const trainingCommand = defineCommandGroup<CommandServices>({
  name: "treino",
  aliases: ["treinar", "evoluir"],
  description: "Mostra e usa seus pontos de treino para evoluir atributos.",
  access: "member",
  module: "training",
  defaultSubcommand: "ver",
  subcommands: [
    defineSubcommand<typeof verArgs, CommandServices>({
      name: "ver",
      description: "Mostra seus pontos de treino e custo para evoluir cada atributo.",
      args: verArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
        if (!character) {
          await ctx.reply("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
          return;
        }

        const [progress, formula, attributes] = await Promise.all([
          ctx.services.training.getOrCreateProgress(ctx.guild, character),
          ctx.services.training.getTrainingCostFormula(ctx.guild),
          ctx.services.attributes.listAttributes(ctx.guild)
        ]);

        const snapshot = ctx.services.characters.getBaseAttributeSnapshot(character);
        const lines = attributes.map((attr) => {
          const current = snapshot[attr.key] ?? attr.baseValue;
          const nextCost = ctx.services.training.calculateTrainingCost(formula, current, 1);
          return `**${attr.name}**: ${current} (custo do próximo ponto: ${nextCost})`;
        });

        const embed = new EmbedBuilder()
          .setTitle(`Treino — ${character.name}`)
          .addFields({ name: "Pontos disponíveis", value: String(progress.trainingPoints) })
          .setDescription(lines.length > 0 ? lines.join("\n") : "Nenhum atributo configurado ainda.");

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<typeof treinarArgs, CommandServices>({
      name: "treinar",
      description: "Gasta pontos de treino para evoluir um atributo.",
      args: treinarArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
        if (!character) {
          await ctx.reply("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
          return;
        }

        const result = await ctx.services.training.trainAttribute(
          ctx.guild,
          character,
          ctx.args.atributo,
          ctx.args.quantidade
        );

        await ctx.reply(
          `**${ctx.args.atributo}** evoluiu para ${result.newValue} (custo: ${result.cost}). Pontos restantes: ${result.remainingPoints}.`
        );
      }
    })
  ]
});

const concederArgs = [
  { name: "usuario", type: "user", description: "Jogador a conceder/remover pontos." },
  { name: "quantidade", type: "integer", description: "Positivo concede, negativo remove." },
  { name: "motivo", type: "text", description: "Motivo (opcional).", required: false }
] as const satisfies readonly ArgDef[];

const custoArgs = [
  { name: "custo_base", type: "number", description: "Custo fixo por ponto." },
  { name: "custo_por_valor_atual", type: "number", description: "Custo adicional por valor atual do atributo." }
] as const satisfies readonly ArgDef[];

const limiteArgs = [
  { name: "quantidade", type: "integer", description: "Máximo de pontos evoluídos por ação.", min: 1 }
] as const satisfies readonly ArgDef[];

export const paCommand = defineCommandGroup<CommandServices>({
  name: "pa",
  description: "Gerencia pontos de treino (PA) e a configuração de custo de evolução.",
  access: "admin",
  module: "training",
  subcommands: [
    defineSubcommand<typeof concederArgs, CommandServices>({
      name: "conceder",
      description: "Concede ou remove pontos de treino de um jogador.",
      args: concederArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.args.usuario.id);
        if (!character) {
          throw new TrainingRuleError(`${ctx.args.usuario.username} não tem uma ficha ativa.`);
        }

        const updated = await ctx.services.training.grantPoints(
          ctx.guild,
          ctx.user.id,
          character,
          ctx.args.quantidade,
          ctx.args.motivo
        );

        await ctx.reply(`**${character.name}** agora tem ${updated.trainingPoints} ponto(s) de treino.`);
      }
    }),

    defineSubcommand<typeof custoArgs, CommandServices>({
      name: "custo",
      description: "Define o custo de treino: base + (valor atual * custo por valor atual).",
      args: custoArgs,
      async handler(ctx) {
        await ctx.services.training.setLinearTrainingCost(ctx.guild, ctx.user.id, {
          baseCost: ctx.args.custo_base,
          costPerCurrentValue: ctx.args.custo_por_valor_atual
        });

        await ctx.reply(
          `Novo custo: \`${ctx.args.custo_base} + atual * ${ctx.args.custo_por_valor_atual}\` por ponto.`
        );
      }
    }),

    defineSubcommand<typeof limiteArgs, CommandServices>({
      name: "limite",
      description: "Define quantos pontos um atributo pode subir por ação de treino.",
      args: limiteArgs,
      async handler(ctx) {
        await ctx.services.training.setMaxIncreasePerAction(ctx.guild, ctx.user.id, ctx.args.quantidade);
        await ctx.reply(`Limite de evolução por ação definido para ${ctx.args.quantidade}.`);
      }
    })
  ]
});
