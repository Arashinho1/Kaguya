import { EmbedBuilder } from "discord.js";

import {
  defineCommandGroup,
  defineSubcommand,
  type ArgDef,
  type CommandContext
} from "../core/commands/index.js";
import { formatFormula } from "../core/formula/index.js";
import { registerModule } from "../core/modules/registry.js";
import { ATTRIBUTE_CATEGORIES, AttributeRuleError } from "../modules/attributes/AttributeService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { buildAttributeConfigView } from "./attributeMenu.js";
import { buildCreatePromptView, buildFichaView } from "./fichaMenu.js";

registerModule({
  key: "attributes",
  name: "Atributos e Chakra",
  description: "Atributos configuráveis por servidor e a fórmula de Chakra derivada deles."
});

/**
 * `.atributo`/`.attr` é hoje um atalho pra ficha (`ver`, padrão) mais a configuração
 * de admin (`config` e os subcomandos legados abaixo). O grupo inteiro precisa ser
 * `access: "member"` pra o atalho funcionar pra qualquer um — os subcomandos de
 * configuração se auto-protegem com este guard em vez de depender do access do grupo.
 */
async function requireAdmin<TArgs extends readonly ArgDef[]>(
  ctx: CommandContext<TArgs, CommandServices>
): Promise<void> {
  const allowed = await canUseCommandAccess("admin", ctx.member, ctx.source.client, ctx.services.guildConfig);
  if (!allowed) {
    throw new AttributeRuleError("Você precisa ter Administrador ou Gerenciar Servidor para configurar atributos.");
  }
}

const EDIT_FIELDS = ["nome", "descricao", "categoria", "base", "min", "max", "ordem"] as const;

const listarArgs = [] as const satisfies readonly ArgDef[];

const criarArgs = [
  { name: "chave", type: "string", description: "Chave técnica única (ex: forca)." },
  {
    name: "categoria",
    type: "string",
    description: "Físico ou mental (define em qual card da ficha ele aparece).",
    choices: ATTRIBUTE_CATEGORIES
  },
  { name: "nome", type: "text", description: "Nome de exibição do atributo." }
] as const satisfies readonly ArgDef[];

const editarArgs = [
  { name: "chave", type: "string", description: "Chave do atributo a editar." },
  { name: "campo", type: "string", description: "Campo a alterar.", choices: EDIT_FIELDS },
  { name: "valor", type: "text", description: "Novo valor para o campo." }
] as const satisfies readonly ArgDef[];

const chaveArgs = [
  { name: "chave", type: "string", description: "Chave do atributo." }
] as const satisfies readonly ArgDef[];

const removerArgs = [
  { name: "chave", type: "string", description: "Chave do atributo a remover." },
  { name: "confirmar", type: "boolean", description: "Confirme a remoção permanente." }
] as const satisfies readonly ArgDef[];

const chakraArgs = [
  {
    name: "atributos",
    type: "string",
    description: "Chaves somadas, separadas por vírgula (ex: forca,velocidade)."
  },
  { name: "multiplicador", type: "number", description: "Multiplicador da soma.", required: false },
  { name: "bonus", type: "number", description: "Bônus direto somado ao final.", required: false },
  {
    name: "multiplicador_isolado",
    type: "number",
    description: "Multiplicador isolado.",
    required: false
  }
] as const satisfies readonly ArgDef[];

export const attributeAdminCommand = defineCommandGroup<CommandServices>({
  name: "atributo",
  aliases: ["attr", "atributos", "attrs"],
  description: "Mostra sua ficha (atalho) ou configura os atributos do RPG neste servidor.",
  access: "member",
  module: "attributes",
  defaultSubcommand: "ver",
  subcommands: [
    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "ver",
      description: "Atalho para o menu da sua ficha (atributos, chakra, clã/vila).",
      args: listarArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);

        if (!character) {
          await ctx.reply(buildCreatePromptView());
          return;
        }

        const view = await buildFichaView(ctx.guild, character, ctx.services, true);
        await ctx.reply(view);
      }
    }),

    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "config",
      description: "Abre o menu de configuração de atributos (staff).",
      args: listarArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const view = await buildAttributeConfigView(ctx.guild, ctx.services);
        await ctx.reply(view);
      }
    }),

    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "listar",
      description: "Lista todos os atributos (ativos e inativos).",
      args: listarArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const attributes = await ctx.services.attributes.listAttributes(ctx.guild, { includeInactive: true });

        if (attributes.length === 0) {
          await ctx.reply("Nenhum atributo cadastrado ainda.");
          return;
        }

        const lines = attributes.map(
          (attr) =>
            `${attr.isActive ? "🟢" : "🔴"} **${attr.name}** \`[${attr.key}]\` — base ${attr.baseValue}, min ${attr.minValue}, max ${attr.maxValue ?? "∞"}`
        );

        await ctx.reply({
          embeds: [new EmbedBuilder().setTitle("Atributos (staff)").setDescription(lines.join("\n"))]
        });
      }
    }),

    defineSubcommand<typeof criarArgs, CommandServices>({
      name: "criar",
      description: "Cria um novo atributo (ajuste base/min/max depois com editar).",
      args: criarArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const created = await ctx.services.attributes.createAttribute(ctx.guild, ctx.user.id, {
          key: ctx.args.chave,
          name: ctx.args.nome,
          category: ctx.args.categoria ?? "fisico"
        });

        await ctx.reply(`Criado **${created.name}** \`[${created.key}]\`.`);
      }
    }),

    defineSubcommand<typeof editarArgs, CommandServices>({
      name: "editar",
      description: "Edita nome, descrição, base, min, max ou ordem de um atributo.",
      args: editarArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const update = buildUpdateFromField(ctx.args.campo, ctx.args.valor);
        const updated = await ctx.services.attributes.updateAttribute(ctx.guild, ctx.user.id, ctx.args.chave, update);

        if (!updated) {
          throw new AttributeRuleError(`Não encontrei o atributo \`${ctx.args.chave}\`.`);
        }

        await ctx.reply(`Editado **${updated.name}** \`[${updated.key}]\`.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "ativar",
      description: "Reativa um atributo desativado.",
      args: chaveArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const updated = await ctx.services.attributes.updateAttribute(ctx.guild, ctx.user.id, ctx.args.chave, {
          isActive: true
        });

        if (!updated) {
          throw new AttributeRuleError(`Não encontrei o atributo \`${ctx.args.chave}\`.`);
        }

        await ctx.reply(`**${updated.name}** está ativo novamente.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "desativar",
      description: "Desativa um atributo (deixa de aparecer para jogadores).",
      args: chaveArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const updated = await ctx.services.attributes.updateAttribute(ctx.guild, ctx.user.id, ctx.args.chave, {
          isActive: false
        });

        if (!updated) {
          throw new AttributeRuleError(`Não encontrei o atributo \`${ctx.args.chave}\`.`);
        }

        await ctx.reply(`**${updated.name}** foi desativado.`);
      }
    }),

    defineSubcommand<typeof removerArgs, CommandServices>({
      name: "remover",
      description: "Remove definitivamente um atributo.",
      args: removerArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        if (!ctx.args.confirmar) {
          await ctx.reply("Remoção cancelada — confirme com `confirmar: sim` para remover de verdade.");
          return;
        }

        const deleted = await ctx.services.attributes.deleteAttribute(ctx.guild, ctx.user.id, ctx.args.chave);

        if (!deleted) {
          throw new AttributeRuleError(`Não encontrei o atributo \`${ctx.args.chave}\`.`);
        }

        await ctx.reply(`Removido **${deleted.name}** \`[${deleted.key}]\`.`);
      }
    }),

    defineSubcommand<typeof chakraArgs, CommandServices>({
      name: "chakra",
      description: "Configura a fórmula de Chakra (soma ponderada de atributos).",
      args: chakraArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const formula = await ctx.services.attributes.setWeightedSumChakraFormula(ctx.guild, ctx.user.id, {
          sourceAttributeKeys: ctx.args.atributos
            .split(",")
            .map((key) => key.trim())
            .filter((key) => key.length > 0),
          sourceMultiplier: ctx.args.multiplicador ?? 1,
          directBonus: ctx.args.bonus ?? 0,
          isolatedMultiplier: ctx.args.multiplicador_isolado ?? 1
        });

        await ctx.reply(`Nova fórmula de Chakra: \`${formatFormula(formula)}\`.`);
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
    case "categoria": {
      const normalized = value.toLowerCase();
      if (!(ATTRIBUTE_CATEGORIES as readonly string[]).includes(normalized)) {
        throw new AttributeRuleError(`Categoria inválida: \`${value}\`. Opções: ${ATTRIBUTE_CATEGORIES.join(", ")}.`);
      }
      return { category: normalized };
    }
    case "base":
      return { baseValue: parseRequiredInt(value, "base") };
    case "min":
      return { minValue: parseRequiredInt(value, "min") };
    case "max":
      return {
        maxValue: ["-", "nenhum", "null"].includes(value.toLowerCase()) ? null : parseRequiredInt(value, "max")
      };
    case "ordem":
      return { sortOrder: parseRequiredInt(value, "ordem") };
    default:
      throw new AttributeRuleError(`Campo desconhecido: \`${field}\`. Opções: ${EDIT_FIELDS.join(", ")}.`);
  }
}

function parseRequiredInt(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new AttributeRuleError(`Valor inválido para **${field}**: precisa ser um número inteiro.`);
  }
  return parsed;
}
