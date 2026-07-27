import { EmbedBuilder } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { WorldRuleError } from "../modules/world/WorldConfigService.js";
import type { CommandServices } from "../types/command.js";
import { buildWorldConfigView } from "./worldMenu.js";

registerModule({
  key: "world",
  name: "Mundo RPG",
  description: "Clãs, vilas e ranks vinculáveis à ficha, com bônus de atributo opcionais."
});

const listarArgs = [] as const satisfies readonly ArgDef[];

const nomeArgs = [{ name: "nome", type: "text", description: "Nome." }] as const satisfies readonly ArgDef[];

const rankChaveArgs = [
  { name: "nome", type: "text", description: "Chave do rank." }
] as const satisfies readonly ArgDef[];

const chaveNomeArgs = [
  { name: "chave", type: "string", description: "Chave técnica única (ex: genin)." },
  { name: "nome", type: "text", description: "Nome de exibição." }
] as const satisfies readonly ArgDef[];

const EDIT_TYPES = ["cla", "vila", "rank"] as const;
const EDIT_FIELDS = ["nome", "descricao", "bonus", "limite", "ordem"] as const;

const editarArgs = [
  { name: "tipo", type: "string", description: "cla, vila ou rank.", choices: EDIT_TYPES },
  { name: "identificador", type: "string", description: "Nome (clã/vila) ou chave (rank)." },
  { name: "campo", type: "string", description: "Campo a alterar.", choices: EDIT_FIELDS },
  { name: "valor", type: "text", description: "Novo valor. Bônus: forca:2,chakra:10" }
] as const satisfies readonly ArgDef[];

export const worldCommand = defineCommandGroup<CommandServices>({
  name: "mundo",
  description: "Configura clãs, vilas e ranks do RPG.",
  access: "admin",
  module: "world",
  defaultSubcommand: "config",
  subcommands: [
    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "config",
      description: "Abre o menu de configuração do mundo (criar/editar/remover por botão).",
      args: listarArgs,
      async handler(ctx) {
        const view = await buildWorldConfigView(ctx.guild, ctx.services);
        await ctx.reply(view);
      }
    }),

    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "listar",
      description: "Lista clãs, vilas e ranks configurados.",
      args: listarArgs,
      async handler(ctx) {
        const [clans, villages, ranks] = await Promise.all([
          ctx.services.world.listClans(ctx.guild, { includeInactive: true }),
          ctx.services.world.listVillages(ctx.guild, { includeInactive: true }),
          ctx.services.world.listRanks(ctx.guild, { includeInactive: true })
        ]);

        const embed = new EmbedBuilder()
          .setTitle("Mundo RPG")
          .addFields(
            { name: "Clãs", value: formatList(clans.map((c) => `${c.isActive ? "🟢" : "🔴"} ${c.name}`)) },
            { name: "Vilas", value: formatList(villages.map((v) => `${v.isActive ? "🟢" : "🔴"} ${v.name}`)) },
            {
              name: "Ranks",
              value: formatList(ranks.map((r) => `${r.isActive ? "🟢" : "🔴"} ${r.name} \`[${r.key}]\``))
            }
          );

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<typeof nomeArgs, CommandServices>({
      name: "cla_criar",
      description: "Cria um clã.",
      args: nomeArgs,
      async handler(ctx) {
        const created = await ctx.services.world.createClan(ctx.guild, ctx.user.id, { name: ctx.args.nome });
        await ctx.reply(`Clã **${created.name}** criado.`);
      }
    }),

    defineSubcommand<typeof nomeArgs, CommandServices>({
      name: "cla_remover",
      description: "Remove um clã.",
      args: nomeArgs,
      async handler(ctx) {
        const deleted = await ctx.services.world.deleteClan(ctx.guild, ctx.user.id, ctx.args.nome);
        if (!deleted) throw new WorldRuleError(`Não encontrei o clã **${ctx.args.nome}**.`);
        await ctx.reply(`Clã **${deleted.name}** removido.`);
      }
    }),

    defineSubcommand<typeof nomeArgs, CommandServices>({
      name: "vila_criar",
      description: "Cria uma vila.",
      args: nomeArgs,
      async handler(ctx) {
        const created = await ctx.services.world.createVillage(ctx.guild, ctx.user.id, { name: ctx.args.nome });
        await ctx.reply(`Vila **${created.name}** criada.`);
      }
    }),

    defineSubcommand<typeof nomeArgs, CommandServices>({
      name: "vila_remover",
      description: "Remove uma vila.",
      args: nomeArgs,
      async handler(ctx) {
        const deleted = await ctx.services.world.deleteVillage(ctx.guild, ctx.user.id, ctx.args.nome);
        if (!deleted) throw new WorldRuleError(`Não encontrei a vila **${ctx.args.nome}**.`);
        await ctx.reply(`Vila **${deleted.name}** removida.`);
      }
    }),

    defineSubcommand<typeof chaveNomeArgs, CommandServices>({
      name: "rank_criar",
      description: "Cria um rank.",
      args: chaveNomeArgs,
      async handler(ctx) {
        const created = await ctx.services.world.createRank(ctx.guild, ctx.user.id, {
          key: ctx.args.chave,
          name: ctx.args.nome
        });
        await ctx.reply(`Rank **${created.name}** \`[${created.key}]\` criado.`);
      }
    }),

    defineSubcommand<typeof rankChaveArgs, CommandServices>({
      name: "rank_remover",
      description: "Remove um rank (informe a chave).",
      args: rankChaveArgs,
      async handler(ctx) {
        const deleted = await ctx.services.world.deleteRank(ctx.guild, ctx.user.id, ctx.args.nome);
        if (!deleted) throw new WorldRuleError(`Não encontrei o rank \`${ctx.args.nome}\`.`);
        await ctx.reply(`Rank **${deleted.name}** removido.`);
      }
    }),

    defineSubcommand<typeof editarArgs, CommandServices>({
      name: "editar",
      description: "Edita nome, descrição, bônus, limite (clã) ou ordem (rank).",
      args: editarArgs,
      async handler(ctx) {
        const { tipo, identificador, campo, valor } = ctx.args;
        const update = buildWorldUpdate(campo, valor);

        if (tipo === "cla") {
          const updated = await ctx.services.world.updateClan(ctx.guild, ctx.user.id, identificador, update);
          if (!updated) throw new WorldRuleError(`Não encontrei o clã **${identificador}**.`);
          await ctx.reply(`Clã **${updated.name}** editado.`);
          return;
        }

        if (tipo === "vila") {
          const updated = await ctx.services.world.updateVillage(ctx.guild, ctx.user.id, identificador, update);
          if (!updated) throw new WorldRuleError(`Não encontrei a vila **${identificador}**.`);
          await ctx.reply(`Vila **${updated.name}** editada.`);
          return;
        }

        const updated = await ctx.services.world.updateRank(ctx.guild, ctx.user.id, identificador, update);
        if (!updated) throw new WorldRuleError(`Não encontrei o rank \`${identificador}\`.`);
        await ctx.reply(`Rank **${updated.name}** editado.`);
      }
    })
  ]
});

function formatList(lines: string[]): string {
  return lines.length > 0 ? lines.join("\n") : "Nenhum cadastrado.";
}

function buildWorldUpdate(
  field: string,
  value: string
): { description?: string; bonuses?: Record<string, number>; memberLimit?: number | null; sortOrder?: number } {
  switch (field) {
    case "descricao":
      return { description: value };
    case "bonus":
      return { bonuses: parseBonuses(value) };
    case "limite":
      return { memberLimit: ["-", "nenhum", "null"].includes(value.toLowerCase()) ? null : parseInt(value, "limite") };
    case "ordem":
      return { sortOrder: parseInt(value, "ordem") };
    default:
      throw new WorldRuleError(`Campo desconhecido: \`${field}\`. Opções: ${EDIT_FIELDS.join(", ")}.`);
  }
}

export function parseBonuses(value: string): Record<string, number> {
  const bonuses: Record<string, number> = {};

  for (const pair of value.split(",")) {
    const [key, rawAmount] = pair.split(":").map((part) => part.trim());
    if (!key || rawAmount === undefined) {
      continue;
    }
    const amount = Number.parseFloat(rawAmount);
    if (!Number.isNaN(amount)) {
      bonuses[key] = amount;
    }
  }

  return bonuses;
}

function parseInt(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new WorldRuleError(`Valor inválido para **${field}**: precisa ser um número inteiro.`);
  }
  return parsed;
}
