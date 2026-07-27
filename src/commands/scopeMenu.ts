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
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR } from "./uiConstants.js";

/**
 * Menu de escopo por local (categoria/canal/fórum/thread), compartilhado por duelo,
 * meditação e a detecção narrada de [jutsu] — mesmo componente (ChannelSelectMenuBuilder
 * nativo do Discord), só troca qual serviço/chave de configuração ele lê e grava.
 * Selecionar uma categoria ou fórum libera automaticamente tudo dentro dela.
 */

const ID_PREFIX = "scopemenu";
const MAX_SELECTABLE = 25;

const SCOPE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildCategory,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread
] as const;

export type ScopeTarget = "duelo" | "jutsu" | "meditar";

interface ScopeMeta {
  title: string;
  /** true = lista vazia significa "liberado em qualquer lugar" (jutsu/meditar);
   * false = lista vazia significa "nada liberado ainda" (duelo, comportamento já existente). */
  emptyMeansAllowed: boolean;
  getIds(services: CommandServices, guild: Guild): Promise<string[]>;
  setIds(services: CommandServices, guild: Guild, actorId: string, ids: string[]): Promise<void>;
}

const SCOPE_META: Record<ScopeTarget, ScopeMeta> = {
  duelo: {
    title: "⚔️ Onde o Duelo funciona",
    emptyMeansAllowed: false,
    getIds: (services, guild) => services.combat.getAllowedChannelIds(guild),
    setIds: (services, guild, actorId, ids) => services.combat.setAllowedChannelIds(guild, actorId, ids)
  },
  jutsu: {
    title: "🥷 Onde o [jutsu] narrado funciona",
    emptyMeansAllowed: true,
    getIds: (services, guild) => services.jutsus.getNarrationScope(guild),
    setIds: (services, guild, actorId, ids) => services.jutsus.setNarrationScope(guild, actorId, ids)
  },
  meditar: {
    title: "🧘 Onde a Meditação funciona",
    emptyMeansAllowed: true,
    getIds: (services, guild) => services.jutsus.getMeditationScope(guild),
    setIds: (services, guild, actorId, ids) => services.jutsus.setMeditationScope(guild, actorId, ids)
  }
};

export interface ScopeMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface BackButtonOptions {
  customId: string;
  label: string;
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function formatScopeList(ids: string[]): string {
  return ids.map((id) => `<#${id}>`).join(", ");
}

export async function buildScopeView(
  guild: Guild,
  services: CommandServices,
  target: ScopeTarget,
  back?: BackButtonOptions
): Promise<ScopeMenuView> {
  const meta = SCOPE_META[target];
  const ids = await meta.getIds(services, guild);

  const statusLine =
    ids.length === 0
      ? meta.emptyMeansAllowed
        ? "Sem restrição — funciona em **qualquer** canal, categoria ou thread do servidor."
        : "⚠️ Nada liberado ainda — ninguém consegue usar até selecionar pelo menos um lugar abaixo."
      : `Liberado em: ${formatScopeList(ids)}`;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(meta.title)
    .setDescription(
      `${statusLine}\n\n` +
        "Selecionar uma **categoria** ou **fórum** libera automaticamente tudo dentro dela " +
        "(canais, threads e posts). Deixe vazio pra remover a restrição."
    );

  const select = new ChannelSelectMenuBuilder()
    .setCustomId(buildId("select", target))
    .setPlaceholder("Escolher categorias, canais, fóruns ou threads...")
    .setChannelTypes(...SCOPE_CHANNEL_TYPES)
    .setMinValues(0)
    .setMaxValues(MAX_SELECTABLE);

  if (ids.length > 0) {
    select.setDefaultChannels(...ids.slice(0, MAX_SELECTABLE));
  }

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select)
  ];

  if (back) {
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setCustomId(back.customId).setLabel(back.label).setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return { embeds: [embed], components };
}

function isScopeTarget(value: string | undefined): value is ScopeTarget {
  return value === "duelo" || value === "jutsu" || value === "meditar";
}

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

export async function handleScopeMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  if (!interaction.isChannelSelectMenu()) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);
  if (action !== "select") return;

  const target = parts[0];
  if (!isScopeTarget(target)) return;

  await interaction.deferUpdate();

  const meta = SCOPE_META[target];
  await meta.setIds(services, interaction.guild, interaction.user.id, interaction.values);

  const view = await buildScopeView(interaction.guild, services, target);
  await interaction.editReply(view);
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleScopeMenuInteraction });
