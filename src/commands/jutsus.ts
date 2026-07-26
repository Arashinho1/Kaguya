import { EmbedBuilder, type Guild, type User } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef } from "../core/commands/index.js";
import { formatFormula } from "../core/formula/index.js";
import { registerModule } from "../core/modules/registry.js";
import type { CharacterWithWorld } from "../modules/characters/CharacterService.js";
import { JutsuRuleError } from "../modules/jutsus/JutsuService.js";
import type { CommandServices } from "../types/command.js";

registerModule({
  key: "jutsus",
  name: "Jutsus",
  description: "Catálogo de jutsus (sincronizado do site Mundo Ninja), aprendizado e uso com custo de Chakra."
});

async function requireActiveCharacter(ctx: {
  guild: Guild;
  user: User;
  services: CommandServices;
  reply(payload: string): Promise<void>;
}): Promise<CharacterWithWorld | null> {
  const character = await ctx.services.characters.getActiveCharacter(ctx.guild, ctx.user.id);
  if (!character) {
    await ctx.reply("Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.");
    return null;
  }
  return character;
}

const catalogoArgs = [] as const satisfies readonly ArgDef[];

const tipoArgs = [
  { name: "chave", type: "string", description: "Chave do tipo de jutsu (ex: ninjutsu-elemental)." }
] as const satisfies readonly ArgDef[];

const chaveArgs = [
  { name: "chave", type: "string", description: "Chave (slug) do jutsu." }
] as const satisfies readonly ArgDef[];

export const jutsuCommand = defineCommandGroup<CommandServices>({
  name: "jutsu",
  aliases: ["jutsus", "tecnica", "tecnicas"],
  description: "Catálogo, aprendizado e uso de jutsus.",
  access: "member",
  module: "jutsus",
  defaultSubcommand: "catalogo",
  subcommands: [
    defineSubcommand<typeof catalogoArgs, CommandServices>({
      name: "catalogo",
      description: "Lista os tipos de jutsu e quantos jutsus ativos cada um tem.",
      args: catalogoArgs,
      async handler(ctx) {
        const [types, jutsus] = await Promise.all([
          ctx.services.jutsus.listTypes(ctx.guild),
          ctx.services.jutsus.listJutsus(ctx.guild)
        ]);

        if (types.length === 0) {
          await ctx.reply(
            "Nenhum tipo de jutsu cadastrado ainda. Peça para a staff rodar `.jutsuadmin sincronizar`."
          );
          return;
        }

        const counts = new Map<string, number>();
        for (const jutsu of jutsus) {
          if (!jutsu.typeId) continue;
          counts.set(jutsu.typeId, (counts.get(jutsu.typeId) ?? 0) + 1);
        }

        const lines = types.map((type) => `**${type.name}** \`[${type.key}]\` — ${counts.get(type.id) ?? 0} jutsu(s)`);

        await ctx.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Catálogo de jutsus (${jutsus.length} no total)`)
              .setDescription(lines.join("\n"))
              .setFooter({ text: "Use .jutsu tipo <chave> para ver os jutsus de um tipo." })
          ]
        });
      }
    }),

    defineSubcommand<typeof tipoArgs, CommandServices>({
      name: "tipo",
      description: "Lista os jutsus de um tipo.",
      args: tipoArgs,
      async handler(ctx) {
        const jutsus = await ctx.services.jutsus.listJutsus(ctx.guild, { typeKey: ctx.args.chave });

        if (jutsus.length === 0) {
          await ctx.reply(`Nenhum jutsu ativo encontrado para o tipo \`${ctx.args.chave}\`.`);
          return;
        }

        const shown = jutsus.slice(0, 40);
        const lines = shown.map((j) => `**${j.name}** \`[${j.key}]\`${j.jutsuRank ? ` — rank ${j.jutsuRank}` : ""}`);
        if (jutsus.length > shown.length) {
          lines.push(`…e mais ${jutsus.length - shown.length}.`);
        }

        await ctx.reply({
          embeds: [new EmbedBuilder().setTitle(`Jutsus — ${ctx.args.chave}`).setDescription(lines.join("\n"))]
        });
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "ver",
      description: "Mostra os detalhes de um jutsu.",
      args: chaveArgs,
      async handler(ctx) {
        const jutsu = await ctx.services.jutsus.findJutsu(ctx.guild, ctx.args.chave);
        if (!jutsu) {
          throw new JutsuRuleError(`Não encontrei o jutsu \`${ctx.args.chave}\`.`);
        }

        const formula = await ctx.services.jutsus.getChakraCostFormula(ctx.guild);
        const cost = ctx.services.jutsus.getChakraCostForRank(formula, jutsu.jutsuRank);

        const embed = new EmbedBuilder()
          .setTitle(jutsu.name)
          .setDescription(jutsu.description?.slice(0, 3900) ?? "Sem descrição.")
          .addFields(
            { name: "Rank", value: jutsu.jutsuRank ?? "—", inline: true },
            { name: "Elemento", value: jutsu.element ?? "—", inline: true },
            { name: "Custo de Chakra", value: String(cost), inline: true }
          );

        if (jutsu.requirements) {
          embed.addFields({ name: "Requisitos", value: jutsu.requirements.slice(0, 1024) });
        }
        if (jutsu.imageUrl) {
          embed.setThumbnail(jutsu.imageUrl);
        }

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "aprender",
      description: "Aprende um jutsu do catálogo.",
      args: chaveArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        const learned = await ctx.services.jutsus.learnJutsu(ctx.guild, character, ctx.args.chave);
        const jutsu = await ctx.services.jutsus.findJutsu(ctx.guild, ctx.args.chave);
        await ctx.reply(`**${jutsu?.name ?? learned.jutsuId}** aprendido!`);
      }
    }),

    defineSubcommand<typeof chaveArgs, CommandServices>({
      name: "usar",
      description: "Usa um jutsu aprendido, consumindo Chakra.",
      args: chaveArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        const result = await ctx.services.jutsus.useJutsu(ctx.guild, ctx.user.id, character, ctx.args.chave);

        const xpNote = result.periciaGrant ? ` (+XP de perícia)` : "";
        await ctx.reply(
          `**${result.jutsu.name}** usado! Custo: ${result.cost} Chakra (${result.chakraBefore} → ${result.chakraAfter})${xpNote}.`
        );
      }
    }),

    defineSubcommand<typeof catalogoArgs, CommandServices>({
      name: "aprendidos",
      description: "Lista os jutsus que sua ficha já aprendeu.",
      args: catalogoArgs,
      async handler(ctx) {
        const character = await requireActiveCharacter(ctx);
        if (!character) return;

        const learned = await ctx.services.jutsus.listLearnedJutsus(character);

        if (learned.length === 0) {
          await ctx.reply("Sua ficha ainda não aprendeu nenhum jutsu.");
          return;
        }

        const lines = learned.map((l) => `**${l.jutsu.name}** \`[${l.jutsu.key}]\`${l.jutsu.jutsuRank ? ` — rank ${l.jutsu.jutsuRank}` : ""}`);
        await ctx.reply({
          embeds: [new EmbedBuilder().setTitle(`Jutsus aprendidos — ${character.name}`).setDescription(lines.join("\n"))]
        });
      }
    })
  ]
});

const sincronizarArgs = [] as const satisfies readonly ArgDef[];

const autosyncArgs = [
  { name: "ativo", type: "boolean", description: "Ativar ou desativar a sincronização automática." }
] as const satisfies readonly ArgDef[];

const custoRankArgs = [
  { name: "d", type: "integer", description: "Custo de Chakra para rank D.", min: 0 },
  { name: "c", type: "integer", description: "Custo de Chakra para rank C.", min: 0 },
  { name: "b", type: "integer", description: "Custo de Chakra para rank B.", min: 0 },
  { name: "a", type: "integer", description: "Custo de Chakra para rank A.", min: 0 },
  { name: "s", type: "integer", description: "Custo de Chakra para rank S.", min: 0 }
] as const satisfies readonly ArgDef[];

const xpPorUsoArgs = [
  { name: "quantidade", type: "integer", description: "XP de perícia concedido por uso de jutsu.", min: 0 }
] as const satisfies readonly ArgDef[];

const tipoPericiaArgs = [
  { name: "tipo", type: "string", description: "Chave do tipo de jutsu." },
  { name: "pericia", type: "string", description: "Chave da perícia (ou '-' para desvincular)." }
] as const satisfies readonly ArgDef[];

export const jutsuAdminCommand = defineCommandGroup<CommandServices>({
  name: "jutsuadmin",
  description: "Sincroniza o catálogo de jutsus e configura custo de Chakra / vínculo com perícias.",
  access: "admin",
  module: "jutsus",
  subcommands: [
    defineSubcommand<typeof sincronizarArgs, CommandServices>({
      name: "sincronizar",
      description: "Puxa o catálogo atualizado do site Mundo Ninja.",
      args: sincronizarArgs,
      async handler(ctx) {
        const result = await ctx.services.jutsus.syncFromSource(ctx.guild, ctx.user.id);
        await ctx.reply(
          `Sincronizado: ${result.typesCreated} tipo(s) novo(s), ${result.typesUpdated} atualizado(s); ` +
            `${result.jutsusCreated} jutsu(s) novo(s), ${result.jutsusUpdated} atualizado(s).`
        );
      }
    }),

    defineSubcommand<typeof autosyncArgs, CommandServices>({
      name: "autosync",
      description: "Ativa/desativa a sincronização automática periódica.",
      args: autosyncArgs,
      async handler(ctx) {
        await ctx.services.jutsus.setAutoSyncEnabled(ctx.guild, ctx.user.id, ctx.args.ativo);
        await ctx.reply(`Sincronização automática ${ctx.args.ativo ? "ativada" : "desativada"}.`);
      }
    }),

    defineSubcommand<typeof custoRankArgs, CommandServices>({
      name: "custorank",
      description: "Define o custo de Chakra por rank de jutsu.",
      args: custoRankArgs,
      async handler(ctx) {
        const formula = await ctx.services.jutsus.setChakraCostByRank(ctx.guild, ctx.user.id, {
          D: ctx.args.d,
          C: ctx.args.c,
          B: ctx.args.b,
          A: ctx.args.a,
          S: ctx.args.s
        });
        await ctx.reply(`Novo custo por rank: \`${formatFormula(formula)}\`.`);
      }
    }),

    defineSubcommand<typeof xpPorUsoArgs, CommandServices>({
      name: "xppuso",
      description: "Define o XP de perícia concedido a cada uso de jutsu.",
      args: xpPorUsoArgs,
      async handler(ctx) {
        await ctx.services.jutsus.setXpPerUse(ctx.guild, ctx.user.id, ctx.args.quantidade);
        await ctx.reply(`XP por uso definido para ${ctx.args.quantidade}.`);
      }
    }),

    defineSubcommand<typeof tipoPericiaArgs, CommandServices>({
      name: "tipopericia",
      description: "Vincula (ou desvincula) um tipo de jutsu a uma perícia, para conceder XP ao usar.",
      args: tipoPericiaArgs,
      async handler(ctx) {
        const periciaKey = ctx.args.pericia === "-" ? null : ctx.args.pericia;
        const type = await ctx.services.jutsus.setTypePericia(ctx.guild, ctx.user.id, ctx.args.tipo, periciaKey);
        await ctx.reply(
          periciaKey
            ? `Tipo **${type.name}** agora concede XP para \`${periciaKey}\`.`
            : `Tipo **${type.name}** não concede mais XP de perícia.`
        );
      }
    })
  ]
});
