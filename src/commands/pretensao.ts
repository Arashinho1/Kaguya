import { EmbedBuilder } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef, type CommandContext } from "../core/commands/index.js";
import { PretensaoRuleError } from "../modules/vagas/PretensaoService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { buildPretensaoConfigView } from "./pretensaoMenu.js";
import { BRAND_COLOR } from "./uiConstants.js";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** `.pretensao` é parte do sistema de vagas — mesmo módulo ("vagas"), sem módulo próprio. */
async function requireAdmin<TArgs extends readonly ArgDef[]>(
  ctx: CommandContext<TArgs, CommandServices>
): Promise<void> {
  const allowed = await canUseCommandAccess("admin", ctx.member, ctx.source.client, ctx.services.guildConfig);
  if (!allowed) {
    throw new PretensaoRuleError("Você precisa ter Administrador ou Gerenciar Servidor para usar esse comando.");
  }
}

const setArgs = [
  { name: "canal", type: "channel", description: "Canal onde a pretensão vai funcionar." }
] as const satisfies readonly ArgDef[];

export const pretensaoCommand = defineCommandGroup<CommandServices>({
  name: "pretensao",
  description: "Pretensão automática de vagas: manda o ID da vaga no canal configurado e recebe na hora.",
  access: "member",
  module: "vagas",
  defaultSubcommand: "status",
  subcommands: [
    defineSubcommand<typeof setArgs, CommandServices>({
      name: "set",
      description: "Staff: define o canal onde a pretensão funciona.",
      args: setArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        await ctx.services.pretensao.setChannel(ctx.guild, ctx.user.id, ctx.args.canal.id);
        await ctx.reply(`Canal de pretensão definido: <#${ctx.args.canal.id}>.`);
      }
    }),

    defineSubcommand<[], CommandServices>({
      name: "config",
      description: "Staff: configura dias, horário e status manual da pretensão.",
      args: [] as const,
      async handler(ctx) {
        await requireAdmin(ctx);
        await ctx.reply(await buildPretensaoConfigView(ctx.guild, ctx.services));
      }
    }),

    defineSubcommand<[], CommandServices>({
      name: "status",
      description: "Mostra se a pretensão está aberta agora e o horário configurado.",
      args: [] as const,
      async handler(ctx) {
        const config = await ctx.services.pretensao.getConfig(ctx.guild);
        const isOpenNow = ctx.services.pretensao.isOpen(config);

        const days = config.daysOfWeek.length === 0 ? "Todos os dias" : config.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
        const startH = Math.floor(config.startMinute / 60).toString().padStart(2, "0");
        const startM = (config.startMinute % 60).toString().padStart(2, "0");

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle("🎫 Pretensão")
          .addFields(
            { name: "Está aberta agora?", value: isOpenNow ? "🟢 Sim" : "🔴 Não" },
            { name: "Canal", value: config.channelId ? `<#${config.channelId}>` : "Não configurado" },
            { name: "Dias", value: days, inline: true },
            { name: "Horário", value: `${startH}:${startM} (${config.durationMinutes}min)`, inline: true }
          );

        await ctx.reply({ embeds: [embed] });
      }
    })
  ]
});
