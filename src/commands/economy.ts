import { EmbedBuilder } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { EconomyRuleError } from "../modules/economy/EconomyService.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "economy",
  name: "Economia",
  description: "Moeda do RPG, loja de itens com bônus de atributo e inventário/equipamento."
});

async function requireActiveCharacter(ctx: {
  guild: Parameters<CommandServices["characters"]["getActiveCharacter"]>[0];
  user: { id: string };
  services: CommandServices;
  reply(payload: string): Promise<void>;
}) {
  const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
  if (!character) {
    await ctx.reply("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
    return null;
  }
  return character;
}

const semArgs = [] as const satisfies readonly ArgDef[];
const chaveArgs = [
  { name: "chave", type: "string", description: "Chave do item." }
] as const satisfies readonly ArgDef[];

export const economyCommand = defineCommandGroup<CommandServices>({
  name: "economia",
  aliases: ["banco"],
  description: "Saldo, loja e inventário da sua ficha.",
  access: "member",
  module: "economy",
  defaultSubcommand: "saldo",
  subcommands: [
    defineSubcommand<typeof semArgs, CommandServices>({
      name: "saldo",
      description: "Mostra seu saldo atual.",
      args: semArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        const [balance, currencyName] = await Promise.all([
          ctx.services.economy.getBalance(ctx.guild, character.id),
          ctx.services.economy.getCurrencyName(ctx.guild)
        ]);

        await ctx.reply(`**${character.name}** tem ${balance} ${currencyName}.`);
      }
    }),

    defineSubcommand<typeof semArgs, CommandServices>({
      name: "loja",
      description: "Lista os itens à venda.",
      args: semArgs,
      async handler(ctx) {
        const [items, currencyName] = await Promise.all([
          ctx.services.economy.listItems(ctx.guild),
          ctx.services.economy.getCurrencyName(ctx.guild)
        ]);

        const forSale = items.filter((item) => item.price !== null);

        if (forSale.length === 0) {
          await ctx.reply("Nenhum item à venda ainda.");
          return;
        }

        const lines = forSale.map((item) => `**${item.name}** \`[${item.key}]\` — ${item.price} ${currencyName}`);
        await ctx.reply({ embeds: [new EmbedBuilder().setTitle("Loja").setDescription(lines.join("\n"))] });
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "comprar",
      description: "Compra um item da loja.",
      args: chaveArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        await ctx.services.economy.buyItem(ctx.guild, ctx.user.id, character.id, ctx.args.chave);
        await ctx.reply(`Compra realizada! Confira com \`.economia inventario\`.`);
      }
    }),

    defineSubcommand<typeof semArgs, CommandServices>({
      name: "inventario",
      description: "Mostra seus itens.",
      args: semArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        const inventory = await ctx.services.economy.listInventory(character.id);
        if (inventory.length === 0) {
          await ctx.reply("Seu inventário está vazio.");
          return;
        }

        const lines = inventory.map(
          (entry) =>
            `${entry.equipped ? "🟢" : "⚪"} **${entry.item.name}** \`[${entry.item.key}]\` x${entry.quantity}`
        );

        await ctx.reply({
          embeds: [new EmbedBuilder().setTitle(`Inventário — ${character.name}`).setDescription(lines.join("\n"))]
        });
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "equipar",
      description: "Equipa um item do inventário (aplica os bônus dele à ficha).",
      args: chaveArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        await ctx.services.economy.setEquipped(ctx.guild, character.id, ctx.args.chave, true);
        await ctx.reply(`Item equipado.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "desequipar",
      description: "Desequipa um item.",
      args: chaveArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        await ctx.services.economy.setEquipped(ctx.guild, character.id, ctx.args.chave, false);
        await ctx.reply(`Item desequipado.`);
      }
    })
  ]
});

const moedaNomeArgs = [
  { name: "nome", type: "text", description: "Novo nome da moeda." }
] as const satisfies readonly ArgDef[];

const itemCriarArgs = [
  { name: "chave", type: "string", description: "Chave técnica única." },
  { name: "nome", type: "text", description: "Nome de exibição do item." }
] as const satisfies readonly ArgDef[];

const EDIT_FIELDS = ["nome", "descricao", "preco", "bonus", "ordem"] as const;

const itemEditarArgs = [
  { name: "chave", type: "string", description: "Chave do item a editar." },
  { name: "campo", type: "string", description: "Campo a alterar.", choices: EDIT_FIELDS },
  { name: "valor", type: "text", description: "Novo valor. Bônus: forca:2,chakra:10" }
] as const satisfies readonly ArgDef[];

const concederArgs = [
  { name: "usuario", type: "user", description: "Jogador a conceder/remover moeda." },
  { name: "quantidade", type: "integer", description: "Positivo concede, negativo remove." },
  { name: "motivo", type: "text", description: "Motivo (opcional).", required: false }
] as const satisfies readonly ArgDef[];

const recompensaArgs = [
  { name: "quantidade", type: "integer", description: "Valor da recompensa. 0 desativa.", min: 0 }
] as const satisfies readonly ArgDef[];

export const economyAdminCommand = defineCommandGroup<CommandServices>({
  name: "economiaadmin",
  description: "Configura moeda, itens e recompensas automáticas.",
  access: "admin",
  module: "economy",
  subcommands: [
    defineSubcommand<typeof moedaNomeArgs, CommandServices>({
      name: "moedanome",
      description: "Define o nome exibido para a moeda.",
      args: moedaNomeArgs,
      async handler(ctx) {
        await ctx.services.economy.setCurrencyName(ctx.guild, ctx.user.id, ctx.args.nome);
        await ctx.reply(`Moeda agora se chama **${ctx.args.nome}**.`);
      }
    }),

    defineSubcommand<typeof semArgs, CommandServices>({
      name: "itemlistar",
      description: "Lista todos os itens (ativos e inativos).",
      args: semArgs,
      async handler(ctx) {
        const items = await ctx.services.economy.listItems(ctx.guild, { includeInactive: true });
        if (items.length === 0) {
          await ctx.reply("Nenhum item cadastrado ainda.");
          return;
        }

        const lines = items.map(
          (item) =>
            `${item.isActive ? "🟢" : "🔴"} **${item.name}** \`[${item.key}]\`${item.price !== null ? ` — ${item.price}` : ""}`
        );
        await ctx.reply({ embeds: [new EmbedBuilder().setTitle("Itens (staff)").setDescription(lines.join("\n"))] });
      }
    }),

    defineSubcommand<typeof itemCriarArgs, CommandServices>({
      name: "itemcriar",
      description: "Cria um novo item (ajuste preço/bônus depois com itemeditar).",
      args: itemCriarArgs,
      async handler(ctx) {
        const created = await ctx.services.economy.createItem(ctx.guild, ctx.user.id, {
          key: ctx.args.chave,
          name: ctx.args.nome
        });
        await ctx.reply(`Item **${created.name}** \`[${created.key}]\` criado.`);
      }
    }),

    defineSubcommand<typeof itemEditarArgs, CommandServices>({
      name: "itemeditar",
      description: "Edita nome, descrição, preço, bônus ou ordem de um item.",
      args: itemEditarArgs,
      async handler(ctx) {
        const update = buildItemUpdate(ctx.args.campo, ctx.args.valor);
        const updated = await ctx.services.economy.updateItem(ctx.guild, ctx.user.id, ctx.args.chave, update);
        if (!updated) throw new EconomyRuleError(`Não encontrei o item \`${ctx.args.chave}\`.`);
        await ctx.reply(`Item **${updated.name}** editado.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "itemativar",
      description: "Reativa um item desativado.",
      args: chaveArgs,
      async handler(ctx) {
        const updated = await ctx.services.economy.updateItem(ctx.guild, ctx.user.id, ctx.args.chave, {
          isActive: true
        });
        if (!updated) throw new EconomyRuleError(`Não encontrei o item \`${ctx.args.chave}\`.`);
        await ctx.reply(`**${updated.name}** está ativo novamente.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "itemdesativar",
      description: "Desativa um item (some da loja).",
      args: chaveArgs,
      async handler(ctx) {
        const updated = await ctx.services.economy.updateItem(ctx.guild, ctx.user.id, ctx.args.chave, {
          isActive: false
        });
        if (!updated) throw new EconomyRuleError(`Não encontrei o item \`${ctx.args.chave}\`.`);
        await ctx.reply(`**${updated.name}** foi desativado.`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "itemremover",
      description: "Remove definitivamente um item.",
      args: chaveArgs,
      async handler(ctx) {
        const deleted = await ctx.services.economy.deleteItem(ctx.guild, ctx.user.id, ctx.args.chave);
        if (!deleted) throw new EconomyRuleError(`Não encontrei o item \`${ctx.args.chave}\`.`);
        await ctx.reply(`Removido **${deleted.name}**.`);
      }
    }),

    defineSubcommand<typeof concederArgs, CommandServices>({
      name: "conceder",
      description: "Concede ou remove moeda de um jogador.",
      args: concederArgs,
      async handler(ctx) {
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.args.usuario.id);
        if (!character) {
          throw new EconomyRuleError(`${ctx.args.usuario.username} não tem uma ficha ativa.`);
        }

        const balance = await ctx.services.economy.grantCurrency(
          ctx.guild,
          ctx.user.id,
          character.id,
          ctx.args.quantidade,
          ctx.args.motivo
        );

        const currencyName = await ctx.services.economy.getCurrencyName(ctx.guild);
        await ctx.reply(`**${character.name}** agora tem ${balance} ${currencyName}.`);
      }
    }),

    defineSubcommand<typeof recompensaArgs, CommandServices>({
      name: "recompensaduelo",
      description: "Define a recompensa automática por vencer um duelo.",
      args: recompensaArgs,
      async handler(ctx) {
        await ctx.services.economy.setDuelWinReward(ctx.guild, ctx.user.id, ctx.args.quantidade);
        await ctx.reply(`Recompensa por vencer duelo: ${ctx.args.quantidade}.`);
      }
    }),

    defineSubcommand<typeof recompensaArgs, CommandServices>({
      name: "recompensapericia",
      description: "Define a recompensa automática por subir de nível numa perícia.",
      args: recompensaArgs,
      async handler(ctx) {
        await ctx.services.economy.setPericiaLevelUpReward(ctx.guild, ctx.user.id, ctx.args.quantidade);
        await ctx.reply(`Recompensa por subir de nível: ${ctx.args.quantidade}.`);
      }
    })
  ]
});

function buildItemUpdate(field: string, value: string) {
  switch (field) {
    case "nome":
      return { name: value };
    case "descricao":
      return { description: ["-", "limpar", "null"].includes(value.toLowerCase()) ? null : value };
    case "preco":
      return { price: ["-", "nenhum", "null"].includes(value.toLowerCase()) ? null : parseRequiredInt(value, "preço") };
    case "bonus":
      return { bonuses: parseBonuses(value) };
    case "ordem":
      return { sortOrder: parseRequiredInt(value, "ordem") };
    default:
      throw new EconomyRuleError(`Campo desconhecido: \`${field}\`. Opções: ${EDIT_FIELDS.join(", ")}.`);
  }
}

function parseBonuses(value: string): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const pair of value.split(",")) {
    const [key, rawAmount] = pair.split(":").map((part) => part.trim());
    if (!key || rawAmount === undefined) continue;
    const amount = Number.parseFloat(rawAmount);
    if (!Number.isNaN(amount)) bonuses[key] = amount;
  }
  return bonuses;
}

function parseRequiredInt(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new EconomyRuleError(`Valor inválido para **${field}**: precisa ser um número inteiro.`);
  }
  return parsed;
}
