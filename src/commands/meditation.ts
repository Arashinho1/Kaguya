import { defineCommandGroup, defineSubcommand, type ArgDef, type CommandContext } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { JutsuRuleError } from "../modules/jutsus/JutsuService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { buildMeditationConfigView } from "./meditationMenu.js";

registerModule({
  key: "meditation",
  name: "Meditação",
  description: "Recuperação de chakra gasto ao longo do tempo, disponível pra qualquer um a qualquer momento."
});

async function requireAdmin<TArgs extends readonly ArgDef[]>(
  ctx: CommandContext<TArgs, CommandServices>
): Promise<void> {
  const allowed = await canUseCommandAccess("admin", ctx.member, ctx.source.client, ctx.services.guildConfig);
  if (!allowed) {
    throw new JutsuRuleError("Você precisa ter Administrador ou Gerenciar Servidor para configurar a meditação.");
  }
}

const noArgs = [] as const satisfies readonly ArgDef[];

export const meditateCommand = defineCommandGroup<CommandServices>({
  name: "meditar",
  description: "Recupera chakra gasto meditando (ou configura a taxa de recuperação).",
  access: "member",
  module: "meditation",
  defaultSubcommand: "fazer",
  subcommands: [
    defineSubcommand<typeof noArgs, CommandServices>({
      name: "fazer",
      description: "Medita para recuperar chakra gasto, proporcional ao tempo desde a última vez.",
      args: noArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
        if (!character) {
          await ctx.reply("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
          return;
        }

        const result = await ctx.services.jutsus.meditate(ctx.guild, character);

        if (result.alreadyFull) {
          await ctx.reply(`🧘 Seu chakra já está no máximo (${result.maxChakra}).`);
          return;
        }

        if (result.recovered <= 0) {
          await ctx.reply(
            "🧘 Você medita, mas ainda não passou tempo suficiente pra recuperar chakra. Tente de novo mais tarde."
          );
          return;
        }

        await ctx.reply(
          `🧘 Você medita e recupera **${result.recovered}** de chakra ` +
            `(${result.chakraBefore} → ${result.chakraAfter} de ${result.maxChakra}).`
        );
      }
    }),

    defineSubcommand<typeof noArgs, CommandServices>({
      name: "config",
      description: "Configura o percentual de chakra recuperado por minuto/hora.",
      args: noArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const view = await buildMeditationConfigView(ctx.guild, ctx.services);
        await ctx.reply(view);
      }
    })
  ]
});
