import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type Guild,
  type MessageActionRowComponentBuilder,
  type StringSelectMenuInteraction
} from "discord.js";

import { buildCustomId, parseCustomId } from "../core/commands/customId.js";
import { DomainError } from "../core/errors.js";
import type { MenuInteraction } from "../core/commands/menuRegistry.js";
import type { JutsuService } from "../modules/jutsus/JutsuService.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import {
  elementEmoji,
  EMBED_COLOR,
  fetchImageAttachment,
  RANK_ORDER,
  rankBadge,
  rankColor,
  sortByRank,
  truncate,
  typeEmoji
} from "./jutsuDisplay.js";

/**
 * Menu interativo de jutsus: categoria -> (rank, se a categoria tiver mais de 25) -> jutsu ->
 * detalhe. Navegação por StringSelectMenu/Button, sempre editando a mesma mensagem
 * (interaction.update) — nada de spammar reply novo a cada clique.
 */

const ID_PREFIX = "jutsumenu";
const MAX_OPTIONS = 25;
/** Sentinelas de rank: "all" = categoria sem filtro (<=25 jutsus), "none" = jutsus sem rank definido. */
const RANK_ALL = "all";
const RANK_NONE = "none";

export interface InteractiveView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  files?: AttachmentBuilder[];
}

/** JutsuMenu não usa modal — só select/botão. */
type ComponentMenuInteraction = StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">;

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function button(action: string, label: string, style: ButtonStyle, ...parts: string[]): ButtonBuilder {
  return new ButtonBuilder().setCustomId(buildId(action, ...parts)).setLabel(label).setStyle(style);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

// ─── Views ───────────────────────────────────────────────────────────────────

export async function buildCategoriesView(guild: Guild, jutsuService: JutsuService): Promise<InteractiveView | null> {
  const [types, allJutsus] = await Promise.all([jutsuService.listTypes(guild), jutsuService.listJutsus(guild)]);
  if (types.length === 0) return null;

  const counts = new Map<string, number>();
  for (const jutsu of allJutsus) {
    if (!jutsu.typeId) continue;
    counts.set(jutsu.typeId, (counts.get(jutsu.typeId) ?? 0) + 1);
  }

  const shownTypes = types.slice(0, MAX_OPTIONS);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("🥷 Catálogo de Jutsus")
    .setDescription(
      `**${allJutsus.length}** jutsus catalogados neste servidor. Escolha uma categoria abaixo para explorar.`
    )
    .addFields(
      shownTypes.map((type) => ({
        name: `${typeEmoji(type.key)} ${type.name}`,
        value: `**${counts.get(type.id) ?? 0}** jutsu(s)`,
        inline: true
      }))
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("selectType"))
    .setPlaceholder("Escolha uma categoria...")
    .addOptions(
      shownTypes.map((type) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(type.name, 100))
          .setValue(type.key)
          .setDescription(truncate(`${counts.get(type.id) ?? 0} jutsu(s)`, 100))
          .setEmoji(typeEmoji(type.key))
      )
    );

  return { embeds: [embed], components: [row(select)] };
}

export async function buildRankView(
  guild: Guild,
  jutsuService: JutsuService,
  typeKey: string
): Promise<InteractiveView | null> {
  const type = await jutsuService.findType(guild, typeKey);
  if (!type) return null;

  const jutsusOfType = await jutsuService.listJutsus(guild, { typeKey });
  if (jutsusOfType.length === 0) return null;

  const counts = new Map<string, number>();
  for (const jutsu of jutsusOfType) {
    const key = jutsu.jutsuRank ?? RANK_NONE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ranks = [...counts.keys()].sort((a, b) => (RANK_ORDER[a] ?? 0) - (RANK_ORDER[b] ?? 0));

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${typeEmoji(type.key)} ${type.name}`)
    .setDescription(`**${jutsusOfType.length}** jutsus nesta categoria — escolha um rank para estreitar a busca.`);

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("selectRank", type.key))
    .setPlaceholder("Escolha um rank...")
    .addOptions(
      ranks.map((rank) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(rank === RANK_NONE ? "Sem rank definido" : `Rank ${rank}`)
          .setValue(rank)
          .setDescription(`${counts.get(rank)} jutsu(s)`)
          .setEmoji(rankBadge(rank === RANK_NONE ? null : rank))
      )
    );

  return {
    embeds: [embed],
    components: [row(select), row(button("showCategories", "⬅️ Categorias", ButtonStyle.Secondary))]
  };
}

export async function buildJutsuListView(
  guild: Guild,
  jutsuService: JutsuService,
  typeKey: string,
  rankFilter: string
): Promise<InteractiveView | null> {
  const type = await jutsuService.findType(guild, typeKey);
  if (!type) return null;

  const all = await jutsuService.listJutsus(guild, { typeKey });
  const filtered =
    rankFilter === RANK_ALL
      ? all
      : rankFilter === RANK_NONE
        ? all.filter((jutsu) => jutsu.jutsuRank === null)
        : all.filter((jutsu) => jutsu.jutsuRank === rankFilter);

  if (filtered.length === 0) return null;

  const shown = sortByRank(filtered).slice(0, MAX_OPTIONS);
  const rankLabel = rankFilter === RANK_ALL ? "" : ` — Rank ${rankFilter === RANK_NONE ? "?" : rankFilter}`;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${typeEmoji(type.key)} ${type.name}${rankLabel}`)
    .setDescription(
      `Escolha um jutsu abaixo para ver os detalhes.` +
        (filtered.length > shown.length ? `\n_(mostrando ${shown.length} de ${filtered.length})_` : "")
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("selectJutsu", type.key, rankFilter))
    .setPlaceholder("Escolha um jutsu...")
    .addOptions(
      shown.map((jutsu) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(jutsu.name, 100))
          .setValue(jutsu.key)
          .setDescription(truncate(jutsu.element ?? jutsu.description ?? "Sem descrição.", 100))
          .setEmoji(rankBadge(jutsu.jutsuRank))
      )
    );

  const backButton =
    rankFilter === RANK_ALL
      ? button("showCategories", "⬅️ Categorias", ButtonStyle.Secondary)
      : button("showRanks", "⬅️ Ranks", ButtonStyle.Secondary, type.key);

  return { embeds: [embed], components: [row(select), row(backButton)] };
}

export async function buildJutsuDetailView(
  guild: Guild,
  jutsuService: JutsuService,
  jutsuKey: string,
  typeKey: string,
  rankFilter: string
): Promise<InteractiveView | null> {
  const jutsu = await jutsuService.findJutsu(guild, jutsuKey);
  if (!jutsu) return null;

  const [formula, types] = await Promise.all([jutsuService.getChakraCostFormula(guild), jutsuService.listTypes(guild)]);
  const cost = jutsuService.getChakraCostForRank(formula, jutsu.jutsuRank);
  const typeName = types.find((t) => t.id === jutsu.typeId)?.name;

  const embed = new EmbedBuilder()
    .setColor(rankColor(jutsu.jutsuRank))
    .setTitle(`${rankBadge(jutsu.jutsuRank)} ${jutsu.name}`)
    .setDescription(jutsu.description?.slice(0, 3900) ?? "Sem descrição cadastrada.")
    .addFields(
      { name: "🏷️ Rank", value: jutsu.jutsuRank ?? "Sem rank", inline: true },
      { name: `${elementEmoji(jutsu.element) || "🌊"} Elemento`, value: jutsu.element ?? "—", inline: true },
      { name: "💠 Custo de Chakra", value: `${cost}`, inline: true }
    );

  if (typeName) {
    embed.addFields({ name: "📚 Tipo", value: typeName, inline: true });
  }
  if (jutsu.requirements) {
    embed.addFields({ name: "📋 Requisitos", value: jutsu.requirements.slice(0, 1024) });
  }
  embed.setFooter({ text: `Chave: ${jutsu.key}` });

  const actionRow = row(
    button("showList", "⬅️ Voltar", ButtonStyle.Secondary, typeKey, rankFilter),
    button("learn", "📘 Aprender", ButtonStyle.Success, jutsu.key),
    button("use", "✨ Usar", ButtonStyle.Primary, jutsu.key)
  );

  const files: AttachmentBuilder[] = [];
  if (jutsu.imageUrl) {
    // Vários hosts de imagem cadastrados no site bloqueiam o crawler do Discord
    // mesmo respondendo normal a qualquer outro cliente — baixa e reenvia como
    // anexo em vez de linkar direto (ver fetchImageAttachment).
    const image = await fetchImageAttachment(jutsu.imageUrl, jutsu.key);
    if (image) {
      embed.setImage(image.imageUrl);
      files.push(image.attachment);
    }
  }

  return { embeds: [embed], components: [actionRow], files };
}

// ─── Roteamento de interações ─────────────────────────────────────────────────

export async function handleJutsuMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (interaction.isModalSubmit()) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);
  const selected = interaction.isStringSelectMenu() ? interaction.values[0] : undefined;

  switch (action) {
    case "selectType": {
      if (!selected) return;
      const jutsusOfType = await services.jutsus.listJutsus(interaction.guild, { typeKey: selected });
      const view =
        jutsusOfType.length > MAX_OPTIONS
          ? await buildRankView(interaction.guild, services.jutsus, selected)
          : await buildJutsuListView(interaction.guild, services.jutsus, selected, RANK_ALL);
      await updateOrFallback(interaction, view);
      return;
    }

    case "selectRank": {
      const [typeKey] = parts;
      if (!typeKey || !selected) return;
      const view = await buildJutsuListView(interaction.guild, services.jutsus, typeKey, selected);
      await updateOrFallback(interaction, view);
      return;
    }

    case "selectJutsu": {
      const [typeKey, rankFilter] = parts;
      if (!typeKey || !rankFilter || !selected) return;
      // Buscar/reenviar a imagem pode passar da janela de 3s de ack de interação —
      // adia a resposta antes de montar a view em vez de arriscar "This interaction failed".
      await interaction.deferUpdate();
      const view = await buildJutsuDetailView(interaction.guild, services.jutsus, selected, typeKey, rankFilter);
      await editOrFallback(interaction, view);
      return;
    }

    case "showCategories": {
      const view = await buildCategoriesView(interaction.guild, services.jutsus);
      await updateOrFallback(interaction, view);
      return;
    }

    case "showRanks": {
      const [typeKey] = parts;
      if (!typeKey) return;
      const view = await buildRankView(interaction.guild, services.jutsus, typeKey);
      await updateOrFallback(interaction, view);
      return;
    }

    case "showList": {
      const [typeKey, rankFilter] = parts;
      if (!typeKey || !rankFilter) return;
      const view = await buildJutsuListView(interaction.guild, services.jutsus, typeKey, rankFilter);
      await updateOrFallback(interaction, view);
      return;
    }

    case "learn": {
      const [jutsuKey] = parts;
      if (jutsuKey) await handleJutsuAction(interaction, services, jutsuKey, "learn");
      return;
    }

    case "use": {
      const [jutsuKey] = parts;
      if (jutsuKey) await handleJutsuAction(interaction, services, jutsuKey, "use");
      return;
    }

    default:
      return;
  }
}

/**
 * Discord mantém anexos antigos da mensagem numa edição a menos que `attachments`
 * seja explicitamente informado — sem isso, a imagem de uma view anterior (ex: o
 * detalhe de um jutsu) continua aparecendo em telas seguintes que não têm imagem
 * nenhuma. Toda edição de mensagem do menu passa por aqui pra sempre zerar isso.
 */
function withClearedAttachments(view: InteractiveView): InteractiveView & { attachments: [] } {
  return { ...view, files: view.files ?? [], attachments: [] };
}

async function updateOrFallback(interaction: ComponentMenuInteraction, view: InteractiveView | null): Promise<void> {
  if (!view) {
    await interaction.reply({ content: "Não encontrei mais esse conteúdo — pode ter sido removido.", ephemeral: true });
    return;
  }
  await interaction.update(withClearedAttachments(view));
}

/** Mesma coisa que updateOrFallback, mas pra depois de um deferUpdate() (edita em vez de "update"). */
async function editOrFallback(interaction: ComponentMenuInteraction, view: InteractiveView | null): Promise<void> {
  if (!view) {
    await interaction.editReply({
      content: "Não encontrei mais esse conteúdo — pode ter sido removido.",
      embeds: [],
      components: [],
      attachments: []
    });
    return;
  }
  await interaction.editReply(withClearedAttachments(view));
}

async function handleJutsuAction(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  jutsuKey: string,
  kind: "learn" | "use"
): Promise<void> {
  const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
  if (!character) {
    await interaction.reply({
      content: "Você ainda não tem uma ficha. Crie uma com `.ficha criar <nome>`.",
      ephemeral: true
    });
    return;
  }

  try {
    if (kind === "learn") {
      const jutsu = await services.jutsus.findJutsu(interaction.guild, jutsuKey);
      await services.jutsus.learnJutsu(interaction.guild, character, jutsuKey);
      await interaction.reply({ content: `📘 **${jutsu?.name ?? jutsuKey}** aprendido!`, ephemeral: true });
      return;
    }

    const result = await services.jutsus.useJutsu(interaction.guild, interaction.user.id, character, jutsuKey);
    const xpNote = result.periciaGrant ? " (+XP de perícia)" : "";
    await interaction.reply({
      content: `✨ **${result.jutsu.name}** usado! Custo: ${result.cost} Chakra (${result.chakraBefore} → ${result.chakraAfter})${xpNote}.`,
      ephemeral: true
    });
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleJutsuMenuInteraction });
