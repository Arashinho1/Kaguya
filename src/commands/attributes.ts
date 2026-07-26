import { EmbedBuilder } from "discord.js";

import { defineCommand, defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { formatFormula } from "../core/formula/index.js";
import { registerModule } from "../core/modules/registry.js";
import { AttributeRuleError } from "../modules/attributes/AttributeService.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "attributes",
  name: "Atributos e Chakra",
  description: "Atributos configuráveis por servidor e a fórmula de Chakra derivada deles."
});

export const attributesCommand = defineCommand<readonly [], CommandServices>({
  name: "atributos",
  aliases: ["attrs"],
  description: "Mostra os atributos configurados neste RPG.",
  access: "member",
  module: "attributes",
  async handler(ctx) {
    const [attributes, chakraFormula] = await Promise.all([
      ctx.services.attributes.listAttributes(ctx.guild),
      ctx.services.attributes.getChakraFormula(ctx.guild)
    ]);

    const embed = new EmbedBuilder().setTitle("Atributos do servidor");

    if (attributes.length === 0) {
      embed.setDescription("Nenhum atributo ativo configurado ainda. Peça para a staff usar `.atributo criar`.");
    } else {
      embed.setDescription(
        attributes.map((attr) => `**${attr.name}** \`[${attr.key}]\` — base ${attr.baseValue}`).join("\n")
      );
    }

    embed.addFields({ name: "Fórmula de Chakra", value: `\`${formatFormula(chakraFormula)}\`` });

    await ctx.reply({ embeds: [embed] });
  }
});

const EDIT_FIELDS = ["nome", "descricao", "base", "min", "max", "ordem"] as const;

const listarArgs = [] as const satisfies readonly ArgDef[];

const criarArgs = [
  { name: "chave", type: "string", description: "Chave técnica única (ex: forca)." },
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
  aliases: ["attr"],
  description: "Configura atributos do RPG neste servidor.",
  access: "admin",
  module: "attributes",
  subcommands: [
    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "listar",
      description: "Lista todos os atributos (ativos e inativos).",
      args: listarArgs,
      async handler(ctx) {
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
        const created = await ctx.services.attributes.createAttribute(ctx.guild, ctx.user.id, {
          key: ctx.args.chave,
          name: ctx.args.nome
        });

        await ctx.reply(`Criado **${created.name}** \`[${created.key}]\`.`);
      }
    }),

    defineSubcommand<typeof editarArgs, CommandServices>({
      name: "editar",
      description: "Edita nome, descrição, base, min, max ou ordem de um atributo.",
      args: editarArgs,
      async handler(ctx) {
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
