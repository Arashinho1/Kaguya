import { EmbedBuilder } from "discord.js";

import { defineCommand, defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { PericiaRuleError } from "../modules/pericias/PericiaService.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "pericias",
  name: "Perícias",
  description: "XP e níveis de perícias, ganhos ao usar jutsus das categorias correspondentes."
});

const verArgs = [
  { name: "usuario", type: "user", description: "Ver o progresso de outro jogador.", required: false }
] as const satisfies readonly ArgDef[];

export const periciasCommand = defineCommand<typeof verArgs, CommandServices>({
  name: "pericias",
  aliases: ["perícia", "perícias"],
  description: "Mostra o progresso de perícias da sua ficha.",
  access: "member",
  module: "pericias",
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

    const views = await ctx.services.pericias.getProgressView(ctx.guild, character);

    const embed = new EmbedBuilder().setTitle(`Perícias — ${character.name}`);

    embed.setDescription(
      views.length > 0
        ? views
            .map(
              (view) =>
                `**${view.pericia.name}**: nível ${view.level} (${view.xp} XP${
                  view.xpForNextLevel !== null ? `, próximo nível em ${view.xpForNextLevel} XP` : ""
                })`
            )
            .join("\n")
        : "Nenhuma perícia configurada neste servidor ainda."
    );

    await ctx.reply({ embeds: [embed] });
  }
});

const listarArgs = [] as const satisfies readonly ArgDef[];

const criarArgs = [
  { name: "chave", type: "string", description: "Chave técnica única (ex: taijutsu)." },
  { name: "nome", type: "text", description: "Nome de exibição da perícia." }
] as const satisfies readonly ArgDef[];

const EDIT_FIELDS = ["nome", "descricao", "ordem"] as const;

const editarArgs = [
  { name: "chave", type: "string", description: "Chave da perícia a editar." },
  { name: "campo", type: "string", description: "Campo a alterar.", choices: EDIT_FIELDS },
  { name: "valor", type: "text", description: "Novo valor para o campo." }
] as const satisfies readonly ArgDef[];

const chaveArgs = [
  { name: "chave", type: "string", description: "Chave da perícia." }
] as const satisfies readonly ArgDef[];

const concederArgs = [
  { name: "usuario", type: "user", description: "Jogador a conceder/remover XP." },
  { name: "chave", type: "string", description: "Chave da perícia." },
  { name: "quantidade", type: "integer", description: "Positivo concede, negativo remove." },
  { name: "motivo", type: "text", description: "Motivo (opcional).", required: false }
] as const satisfies readonly ArgDef[];

const limiaresArgs = [
  { name: "niveis", type: "text", description: "Formato: 1:0,2:100,3:250,4:450,5:700" }
] as const satisfies readonly ArgDef[];

export const periciaAdminCommand = defineCommandGroup<CommandServices>({
  name: "pericia",
  description: "Configura perícias, sua curva de nível e concede XP manualmente.",
  access: "admin",
  module: "pericias",
  subcommands: [
    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "listar",
      description: "Lista todas as perícias (ativas e inativas).",
      args: listarArgs,
      async handler(ctx) {
        const pericias = await ctx.services.pericias.listPericias(ctx.guild, { includeInactive: true });

        if (pericias.length === 0) {
          await ctx.reply("Nenhuma perícia cadastrada ainda.");
          return;
        }

        const lines = pericias.map((p) => `${p.isActive ? "🟢" : "🔴"} **${p.name}** \`[${p.key}]\``);
        await ctx.reply({ embeds: [new EmbedBuilder().setTitle("Perícias (staff)").setDescription(lines.join("\n"))] });
      }
    }),

    defineSubcommand<typeof criarArgs, CommandServices>({
      name: "criar",
      description: "Cria uma nova perícia.",
      args: criarArgs,
      async handler(ctx) {
        const created = await ctx.services.pericias.createPericia(ctx.guild, ctx.user.id, {
          key: ctx.args.chave,
          name: ctx.args.nome
        });
        await ctx.reply(`Criada **${created.name}** \`[${created.key}]\`.`);
      }
    }),

    defineSubcommand<typeof editarArgs, CommandServices>({
      name: "editar",
      description: "Edita nome, descrição ou ordem de uma perícia.",
      args: editarArgs,
      async handler(ctx) {
        const update = buildUpdateFromField(ctx.args.campo, ctx.args.valor);
        const updated = await ctx.services.pericias.updatePericia(ctx.guild, ctx.user.id, ctx.args.chave, update);
        if (!updated) throw new PericiaRuleError(`Não encontrei a perícia \`${ctx.args.chave}\`.`);
        await ctx.reply(`Editada **${updated.name}** \`[${updated.key}]\`.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "ativar",
      description: "Reativa uma perícia desativada.",
      args: chaveArgs,
      async handler(ctx) {
        const updated = await ctx.services.pericias.updatePericia(ctx.guild, ctx.user.id, ctx.args.chave, {
          isActive: true
        });
        if (!updated) throw new PericiaRuleError(`Não encontrei a perícia \`${ctx.args.chave}\`.`);
        await ctx.reply(`**${updated.name}** está ativa novamente.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "desativar",
      description: "Desativa uma perícia.",
      args: chaveArgs,
      async handler(ctx) {
        const updated = await ctx.services.pericias.updatePericia(ctx.guild, ctx.user.id, ctx.args.chave, {
          isActive: false
        });
        if (!updated) throw new PericiaRuleError(`Não encontrei a perícia \`${ctx.args.chave}\`.`);
        await ctx.reply(`**${updated.name}** foi desativada.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "remover",
      description: "Remove definitivamente uma perícia.",
      args: chaveArgs,
      async handler(ctx) {
        const deleted = await ctx.services.pericias.deletePericia(ctx.guild, ctx.user.id, ctx.args.chave);
        if (!deleted) throw new PericiaRuleError(`Não encontrei a perícia \`${ctx.args.chave}\`.`);
        await ctx.reply(`Removida **${deleted.name}** \`[${deleted.key}]\`.`);
      }
    }),

    defineSubcommand<typeof concederArgs, CommandServices>({
      name: "conceder",
      description: "Concede ou remove XP de perícia de um jogador.",
      args: concederArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.args.usuario.id);
        if (!character) {
          throw new PericiaRuleError(`${ctx.args.usuario.username} não tem uma ficha ativa.`);
        }

        const updated = await ctx.services.pericias.grantXp(
          ctx.guild,
          ctx.user.id,
          character,
          ctx.args.chave,
          ctx.args.quantidade,
          ctx.args.motivo
        );

        await ctx.reply(`**${character.name}** agora tem ${updated.xp} XP (nível ${updated.level}) em \`${ctx.args.chave}\`.`);
      }
    }),

    defineSubcommand<typeof limiaresArgs, CommandServices>({
      name: "limiares",
      description: "Define a curva de nível (XP mínimo por nível).",
      args: limiaresArgs,
      async handler(ctx) {
        const thresholds = parseThresholds(ctx.args.niveis);
        const saved = await ctx.services.pericias.setLevelThresholds(ctx.guild, ctx.user.id, thresholds);
        const formatted = Object.entries(saved)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([level, xp]) => `${level}:${xp}`)
          .join(", ");
        await ctx.reply(`Nova curva de nível: ${formatted}.`);
      }
    })
  ]
});

function buildUpdateFromField(field: string, value: string) {
  switch (field) {
    case "nome":
      return { name: value };
    case "descricao":
      return { description: ["-", "limpar", "null"].includes(value.toLowerCase()) ? null : value };
    case "ordem": {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) {
        throw new PericiaRuleError("Valor inválido para **ordem**: precisa ser um número inteiro.");
      }
      return { sortOrder: parsed };
    }
    default:
      throw new PericiaRuleError(`Campo desconhecido: \`${field}\`. Opções: ${EDIT_FIELDS.join(", ")}.`);
  }
}

function parseThresholds(value: string): Record<number, number> {
  const thresholds: Record<number, number> = {};

  for (const pair of value.split(",")) {
    const [levelRaw, xpRaw] = pair.split(":").map((part) => part.trim());
    const level = Number.parseInt(levelRaw ?? "", 10);
    const xp = Number.parseInt(xpRaw ?? "", 10);
    if (Number.isInteger(level) && Number.isInteger(xp)) {
      thresholds[level] = xp;
    }
  }

  return thresholds;
}
