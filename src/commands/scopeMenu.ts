import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  type Guild,
  type MessageActionRowComponentBuilder
} from "discord.js";

import { buildCustomId, parseCustomId } from "../core/commands/customId.js";
import type { MenuInteraction } from "../core/commands/menuRegistry.js";
import { flattenScopeSelection, type ScopeSelection } from "../services/channelScope.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR } from "./uiConstants.js";

/**
 * `.setar`: hub único pra configurar onde Duelo, [jutsu] narrado e Meditar funcionam.
 * Cada alvo tem 4 selects nativos do Discord (canal/categoria/thread/fórum) — o picker
 * do próprio Discord já cuida de busca/rolagem entre muitas opções, sem precisarmos
 * paginar nada manualmente. Escolher uma categoria ou fórum libera tudo dentro dela.
 */

const ID_PREFIX = "setar";
const MAX_SELECTABLE = 25;

export type ScopeTarget = "duelo" | "jutsu" | "meditar";

interface ScopeMeta {
  title: string;
  buttonLabel: string;
  /** true = lista vazia significa "liberado em qualquer lugar" (jutsu/meditar);
   * false = lista vazia significa "nada liberado ainda" (duelo, comportamento já existente). */
  emptyMeansAllowed: boolean;
  getSelection(services: CommandServices, guild: Guild): Promise<ScopeSelection>;
  setGroup(
    services: CommandServices,
    guild: Guild,
    actorId: string,
    group: keyof ScopeSelection,
    ids: string[]
  ): Promise<ScopeSelection>;
}

const SCOPE_META: Record<ScopeTarget, ScopeMeta> = {
  duelo: {
    title: "⚔️ Duelo",
    buttonLabel: "⚔️ Duelo",
    emptyMeansAllowed: false,
    getSelection: (services, guild) => services.combat.getScopeSelection(guild),
    setGroup: (services, guild, actorId, group, ids) => services.combat.setScopeGroup(guild, actorId, group, ids)
  },
  jutsu: {
    title: "🥷 [jutsu] narrado",
    buttonLabel: "🥷 Jutsu Narrado",
    emptyMeansAllowed: true,
    getSelection: (services, guild) => services.jutsus.getNarrationScope(guild),
    setGroup: (services, guild, actorId, group, ids) => services.jutsus.setNarrationScopeGroup(guild, actorId, group, ids)
  },
  meditar: {
    title: "🧘 Meditar",
    buttonLabel: "🧘 Meditar",
    emptyMeansAllowed: true,
    getSelection: (services, guild) => services.jutsus.getMeditationScope(guild),
    setGroup: (services, guild, actorId, group, ids) => services.jutsus.setMeditationScopeGroup(guild, actorId, group, ids)
  }
};

const GROUP_BY_ACTION: Record<string, keyof ScopeSelection> = {
  setChannels: "channels",
  setCategories: "categories",
  setThreads: "threads",
  setForums: "forums"
};

export interface ScopeMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function isScopeTarget(value: string | undefined): value is ScopeTarget {
  return value === "duelo" || value === "jutsu" || value === "meditar";
}

function formatIds(ids: string[]): string {
  return ids.map((id) => `<#${id}>`).join(", ");
}

// ─── Views ───────────────────────────────────────────────────────────────────

export function buildSetarHubView(): ScopeMenuView {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("📍 Configurar Escopo")
    .setDescription(
      "Escolha o que configurar. Em cada um você usa 4 seletores nativos do Discord " +
        "(canal, categoria, thread, fórum) — escolher uma **categoria** ou **fórum** libera " +
        "automaticamente tudo dentro dela."
    );

  const buttons = (Object.keys(SCOPE_META) as ScopeTarget[]).map((target) =>
    new ButtonBuilder()
      .setCustomId(buildId("openTarget", target))
      .setLabel(SCOPE_META[target].buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons)]
  };
}

export async function buildSetarTargetView(
  guild: Guild,
  services: CommandServices,
  target: ScopeTarget
): Promise<ScopeMenuView> {
  const meta = SCOPE_META[target];
  const selection = await meta.getSelection(services, guild);
  const isEmpty = flattenScopeSelection(selection).length === 0;

  const groupLines = [
    selection.channels.length > 0 ? `**Canais:** ${formatIds(selection.channels)}` : null,
    selection.categories.length > 0 ? `**Categorias:** ${formatIds(selection.categories)}` : null,
    selection.threads.length > 0 ? `**Threads:** ${formatIds(selection.threads)}` : null,
    selection.forums.length > 0 ? `**Fóruns:** ${formatIds(selection.forums)}` : null
  ].filter((line): line is string => line !== null);

  const statusLine = isEmpty
    ? meta.emptyMeansAllowed
      ? "Sem restrição — funciona em **qualquer lugar** do servidor."
      : "⚠️ Nada liberado ainda — ninguém consegue usar até selecionar pelo menos um lugar abaixo."
    : groupLines.join("\n");

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📍 ${meta.title}`)
    .setDescription(`${statusLine}\n\nDeixe um seletor vazio pra remover a restrição daquele grupo.`);

  function selectRow(
    action: string,
    placeholder: string,
    types: readonly ChannelType[],
    current: string[]
  ): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const select = new ChannelSelectMenuBuilder()
      .setCustomId(buildId(action, target))
      .setPlaceholder(placeholder)
      .setChannelTypes(...types)
      .setMinValues(0)
      .setMaxValues(MAX_SELECTABLE);
    if (current.length > 0) {
      select.setDefaultChannels(...current.slice(0, MAX_SELECTABLE));
    }
    return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);
  }

  const components = [
    selectRow("setChannels", "Canais...", [ChannelType.GuildText, ChannelType.GuildAnnouncement], selection.channels),
    selectRow("setCategories", "Categorias...", [ChannelType.GuildCategory], selection.categories),
    selectRow(
      "setThreads",
      "Threads...",
      [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread],
      selection.threads
    ),
    selectRow("setForums", "Fóruns...", [ChannelType.GuildForum], selection.forums),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(buildId("backToHub")).setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
    )
  ];

  return { embeds: [embed], components };
}

// ─── Roteamento de interações ─────────────────────────────────────────────────

async function requireAdminInteraction(interaction: MenuInteraction, services: CommandServices): Promise<boolean> {
  const isAdmin = await canUseCommandAccess("admin", interaction.member, interaction.client, services.guildConfig);
  if (!isAdmin) {
    await interaction.reply({
      content: "Você precisa ter Administrador ou Gerenciar Servidor para configurar isso.",
      ephemeral: true
    });
  }
  return isAdmin;
}

export async function handleSetarMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);
  const target = parts[0];

  if (interaction.isButton()) {
    if (action === "openTarget" && isScopeTarget(target)) {
      await interaction.update(await buildSetarTargetView(interaction.guild, services, target));
      return;
    }
    if (action === "backToHub") {
      await interaction.update(buildSetarHubView());
      return;
    }
    return;
  }

  if (interaction.isChannelSelectMenu()) {
    const group = GROUP_BY_ACTION[action];
    if (!group || !isScopeTarget(target)) return;

    await interaction.deferUpdate();
    await SCOPE_META[target].setGroup(services, interaction.guild, interaction.user.id, group, interaction.values);

    const view = await buildSetarTargetView(interaction.guild, services, target);
    await interaction.editReply(view);
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleSetarMenuInteraction });
