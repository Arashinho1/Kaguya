import { EmbedBuilder } from "discord.js";

import { defineCommandGroup, defineSubcommand, type ArgDef, type CommandContext } from "../core/commands/index.js";
import { registerModule } from "../core/modules/registry.js";
import { CharacterRuleError } from "../modules/characters/CharacterService.js";
import { VagaRuleError, type VagaOccupantWithCharacter, type VagaWithRelations } from "../modules/vagas/VagaService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { buildVagaConfigView, buildVagaCreateHubView, listAvailableBonusKeys } from "./vagaMenu.js";
import { BRAND_COLOR } from "./uiConstants.js";

registerModule({
  key: "vagas",
  name: "Vagas",
  description: "Vagas personalizadas que dão vantagens iniciais (bônus, jutsus, rank) via pretensão."
});

const HISTORY_ACTION_LABEL: Record<string, string> = {
  GRANT: "🟢 Deu",
  REVOKE: "🔴 Tirou",
  RESET: "🔴 Resetou",
  CLEAR: "🔴 Limpou"
};

/** `.vagas` inteiro é `access: "member"` (listar/ver/info funcionam pra qualquer um) — as
 * ações de gerenciamento se auto-protegem, mesmo padrão usado em `.ficha`. */
async function requireAdmin<TArgs extends readonly ArgDef[]>(
  ctx: CommandContext<TArgs, CommandServices>
): Promise<void> {
  const allowed = await canUseCommandAccess("admin", ctx.member, ctx.source.client, ctx.services.guildConfig);
  if (!allowed) {
    throw new VagaRuleError("Você precisa ter Administrador ou Gerenciar Servidor para usar esse comando.");
  }
}

async function requireActiveCharacter<TArgs extends readonly ArgDef[]>(
  ctx: CommandContext<TArgs, CommandServices>,
  userId: string,
  label: string
) {
  const character = await ctx.services.characters.getActiveCharacter(ctx.guild, userId);
  if (!character) {
    throw new CharacterRuleError(`${label} não tem uma ficha ativa neste servidor.`);
  }
  return character;
}

function formatOccupants(occupants: VagaOccupantWithCharacter[], limit = 8): string {
  if (occupants.length === 0) return "_Disponível._";

  const shown = occupants.slice(0, limit).map((o) => `<@${o.character.userId}>${o.isExtra ? "*" : ""}`);
  const extra = occupants.length - shown.length;
  return shown.join(", ") + (extra > 0 ? ` +${extra}` : "");
}

function formatLimit(vaga: VagaWithRelations, officialCount: number): string {
  return vaga.memberLimit > 0 ? `${officialCount}/${vaga.memberLimit}` : `${officialCount}/∞`;
}

const listarArgs = [] as const satisfies readonly ArgDef[];

const addcatArgs = [
  { name: "nome", type: "text", description: "Nome da categoria (ex: Backstorys, Traços, Exóticas)." }
] as const satisfies readonly ArgDef[];

const verArgs = [
  { name: "usuario", type: "user", description: "Ver as vagas de outro jogador.", required: false }
] as const satisfies readonly ArgDef[];

const idArgs = [
  { name: "id", type: "string", description: "ID da vaga." }
] as const satisfies readonly ArgDef[];

const idOpcionalArgs = [
  { name: "id", type: "string", description: "ID da vaga (vazio = histórico recente geral).", required: false }
] as const satisfies readonly ArgDef[];

const darArgs = [
  { name: "id", type: "string", description: "ID da vaga." },
  { name: "usuario", type: "user", description: "Quem vai receber a vaga." },
  { name: "extra", type: "boolean", description: "Vaga extra (não ocupa espaço oficial).", required: false }
] as const satisfies readonly ArgDef[];

const tirarArgs = [
  { name: "id", type: "string", description: "ID da vaga." },
  { name: "usuario", type: "user", description: "De quem tirar a vaga." }
] as const satisfies readonly ArgDef[];

const resetarArgs = [
  { name: "usuario", type: "user", description: "De quem remover todas as vagas." }
] as const satisfies readonly ArgDef[];

export const vagaCommand = defineCommandGroup<CommandServices>({
  name: "vagas",
  description: "Vagas personalizadas — vantagens iniciais adquiridas via pretensão.",
  access: "member",
  module: "vagas",
  defaultSubcommand: "ver",
  subcommands: [
    defineSubcommand<typeof listarArgs, CommandServices>({
      name: "listar",
      description: "Lista todas as vagas cadastradas, por categoria.",
      args: listarArgs,
      async handler(ctx) {
        const categories = await ctx.services.vagas.listCategories(ctx.guild);
        if (categories.length === 0) {
          await ctx.reply("Nenhuma categoria de vaga cadastrada ainda. Use `.vagas addcat <nome>`.");
          return;
        }

        const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("📋 Lista de Vagas");

        for (const category of categories) {
          const vagas = await ctx.services.vagas.listVagas(ctx.guild, { categoryId: category.id, includeInactive: true });
          if (vagas.length === 0) continue;

          const lines: string[] = [];
          for (const vaga of vagas) {
            const occupants = await ctx.services.vagas.listOccupants(vaga.id);
            const officialCount = occupants.filter((o) => !o.isExtra).length;
            lines.push(
              `${vaga.isActive ? "🟢" : "🔴"} **${vaga.name}** \`[${vaga.key}]\` • ${formatLimit(vaga, officialCount)}\n` +
                formatOccupants(occupants)
            );
          }

          embed.addFields({ name: `📂 ${category.name}`, value: lines.join("\n\n").slice(0, 1024) });
        }

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<typeof addcatArgs, CommandServices>({
      name: "addcat",
      description: "Staff: cria uma categoria de vaga.",
      args: addcatArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const created = await ctx.services.vagas.createCategory(ctx.guild, ctx.user.id, { name: ctx.args.nome });
        await ctx.reply(`Categoria de vaga **${created.name}** criada. Ajuste o limite por pessoa em \`.vagas config\`.`);
      }
    }),

    defineSubcommand<typeof verArgs, CommandServices>({
      name: "ver",
      description: "Mostra suas vagas (ou as de outro jogador).",
      args: verArgs,
      async handler(ctx) {
        const target = ctx.args.usuario ?? ctx.user;
        const isOwner = target.id === ctx.user.id;
        const character = await ctx.services.characters.getActiveCharacter(ctx.guild, target.id);

        if (!character) {
          await ctx.reply(isOwner ? "Você ainda não tem uma ficha ativa." : `${target.username} ainda não tem uma ficha ativa.`);
          return;
        }

        const occupancies = await ctx.services.vagas.listCharacterVagas(character.id);

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setAuthor({ name: character.name })
          .setTitle("🎫 Vagas");

        if (occupancies.length === 0) {
          embed.setDescription("Nenhuma vaga registrada.");
        } else {
          embed.setDescription(`Total: **${occupancies.length}** vaga(s) • Extras: **${occupancies.filter((o) => o.isExtra).length}**`);
          for (const occupancy of occupancies) {
            embed.addFields({
              name: `📂 ${occupancy.vaga.category.name}${occupancy.isExtra ? " (extra)" : ""}`,
              value: `**${occupancy.vaga.name}** \`[${occupancy.vaga.key}]\``,
              inline: true
            });
          }
        }

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<[], CommandServices>({
      name: "config",
      description: "Staff: configura limites por categoria e edita vagas cadastradas.",
      args: [] as const,
      async handler(ctx) {
        await requireAdmin(ctx);
        await ctx.reply(await buildVagaConfigView(ctx.guild, ctx.services));
      }
    }),

    defineSubcommand<[], CommandServices>({
      name: "criar",
      description: "Staff: abre o assistente de criação de vaga.",
      args: [] as const,
      async handler(ctx) {
        await requireAdmin(ctx);
        const view = await buildVagaCreateHubView(ctx.guild, ctx.services);
        await ctx.reply(view);
      }
    }),

    defineSubcommand<typeof idArgs, CommandServices>({
      name: "info",
      description: "Mostra os detalhes de uma vaga.",
      args: idArgs,
      async handler(ctx) {
        const vaga = await ctx.services.vagas.findVaga(ctx.guild, ctx.args.id);
        if (!vaga) throw new VagaRuleError(`Não encontrei a vaga \`${ctx.args.id}\`.`);

        const occupants = await ctx.services.vagas.listOccupants(vaga.id);
        const officialCount = occupants.filter((o) => !o.isExtra).length;
        const linkedKeys = ctx.services.vagas.getLinkedVagaKeys(vaga);

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle(`🎫 ${vaga.name} \`[${vaga.key}]\``)
          .setDescription(vaga.description || "Sem descrição.")
          .addFields(
            { name: "Categoria", value: vaga.category.name, inline: true },
            { name: "Status", value: vaga.isActive ? "🟢 Ativa" : "🔴 Inativa", inline: true },
            { name: "Ocupação", value: formatLimit(vaga, officialCount), inline: true },
            {
              name: "Bônus",
              value: Object.entries(vaga.bonuses as Record<string, number>).length
                ? Object.entries(vaga.bonuses as Record<string, number>).map(([k, v]) => `${k}:${v}`).join(", ")
                : "Nenhum"
            },
            { name: "Chaves de bônus disponíveis", value: (await listAvailableBonusKeys(ctx.guild, ctx.services)).join(", ") || "Nenhuma" },
            { name: "Rank inicial", value: vaga.initialRank ? vaga.initialRank.name : "Nenhum", inline: true },
            { name: "Restrição de vila", value: vaga.villageRestriction ? vaga.villageRestriction.name : "Nenhuma", inline: true },
            {
              name: "Jutsus iniciais",
              value: vaga.initialJutsus.length ? vaga.initialJutsus.map((j) => j.name).join(", ") : "Nenhum"
            },
            { name: "Vínculos", value: linkedKeys.length ? linkedKeys.map((k) => `\`${k}\``).join(", ") : "Nenhum" },
            { name: "Ocupantes", value: formatOccupants(occupants, 15) }
          );

        await ctx.reply({ embeds: [embed] });
      }
    }),

    defineSubcommand<typeof darArgs, CommandServices>({
      name: "dar",
      description: "Staff: dá uma vaga específica para uma pessoa.",
      args: darArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const character = await requireActiveCharacter(ctx, ctx.args.usuario.id, ctx.args.usuario.username);

        const { occupant, rankBumped } = await ctx.services.vagas.grantVaga(
          ctx.guild,
          ctx.user.id,
          ctx.args.id,
          character.id,
          { extra: ctx.args.extra ?? false }
        );

        await ctx.reply(
          `Vaga \`${ctx.args.id}\` concedida a **${character.name}**${occupant.isExtra ? " (extra)" : ""}.` +
            (rankBumped ? " O rank da ficha foi ajustado pra corresponder à vaga." : "")
        );
      }
    }),

    defineSubcommand<typeof tirarArgs, CommandServices>({
      name: "tirar",
      description: "Staff: remove uma vaga específica de uma pessoa.",
      args: tirarArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const character = await requireActiveCharacter(ctx, ctx.args.usuario.id, ctx.args.usuario.username);

        const removed = await ctx.services.vagas.revokeVaga(ctx.guild, ctx.user.id, ctx.args.id, character.id);
        if (removed === 0) {
          throw new VagaRuleError(`**${character.name}** não ocupa a vaga \`${ctx.args.id}\`.`);
        }

        await ctx.reply(`Removi a vaga \`${ctx.args.id}\` de **${character.name}**.`);
      }
    }),

    defineSubcommand<typeof resetarArgs, CommandServices>({
      name: "resetar",
      description: "Staff: remove todas as vagas de uma pessoa.",
      args: resetarArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const character = await requireActiveCharacter(ctx, ctx.args.usuario.id, ctx.args.usuario.username);

        const removed = await ctx.services.vagas.resetPerson(ctx.guild, ctx.user.id, character.id);
        await ctx.reply(
          removed > 0
            ? `Removi ${removed} vaga(s) de **${character.name}**.`
            : `**${character.name}** não tinha nenhuma vaga.`
        );
      }
    }),

    defineSubcommand<typeof idArgs, CommandServices>({
      name: "limpar",
      description: "Staff: remove todos os ocupantes de uma vaga.",
      args: idArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const removed = await ctx.services.vagas.clearVaga(ctx.guild, ctx.user.id, ctx.args.id);
        await ctx.reply(
          removed > 0 ? `Removi ${removed} ocupante(s) da vaga \`${ctx.args.id}\`.` : `A vaga \`${ctx.args.id}\` já estava vazia.`
        );
      }
    }),

    defineSubcommand<typeof idOpcionalArgs, CommandServices>({
      name: "hist",
      description: "Staff: histórico de movimentação de uma vaga (ou geral, se omitido).",
      args: idOpcionalArgs,
      async handler(ctx) {
        await requireAdmin(ctx);
        const entries = await ctx.services.vagas.listHistory(ctx.guild, { vagaKey: ctx.args.id });

        if (entries.length === 0) {
          await ctx.reply("Nenhuma movimentação registrada ainda.");
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle(ctx.args.id ? `🕘 Histórico — ${ctx.args.id}` : "🕘 Histórico recente")
          .setDescription(
            entries
              .map((entry) => {
                const label = HISTORY_ACTION_LABEL[entry.action] ?? entry.action;
                const when = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`;
                return (
                  `${label} \`${entry.vaga.key}\`${entry.isExtra ? " (extra)" : ""} — ` +
                  `**${entry.character.name}** por <@${entry.actorId}> • ${when}`
                );
              })
              .join("\n")
              .slice(0, 4000)
          );

        await ctx.reply({ embeds: [embed] });
      }
    })
  ]
});
