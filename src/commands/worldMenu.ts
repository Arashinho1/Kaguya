import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Guild,
  type MessageActionRowComponentBuilder,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from "discord.js";

import { buildCustomId, parseCustomId } from "../core/commands/customId.js";
import { DomainError } from "../core/errors.js";
import type { MenuInteraction } from "../core/commands/menuRegistry.js";
import { normalizeBonuses, WorldRuleError, type WorldConfigService } from "../modules/world/WorldConfigService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { parseBonuses } from "./world.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR, truncate } from "./uiConstants.js";

/**
 * Menu de configuração do mundo (`.mundo config`, também o padrão de `.mundo`): mesma
 * filosofia do attributeMenu — criar por botão/modal, navegar por select, editar/ativar/
 * remover num detalhe. Diferente de atributos, aqui há 3 tipos (clã/vila/rank) com campos
 * um pouco diferentes entre si (clã tem limite de membros, rank tem ordem e nome editável;
 * clã/vila são identificados pelo nome — não dá pra renomear — rank pelo `key`).
 */

const ID_PREFIX = "worldmenu";
const MAX_OPTIONS = 25;

type EntityType = "cla" | "vila" | "rank";
type ComponentMenuInteraction = StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">;

interface EntityLike {
  name: string;
  key?: string;
  description: string | null;
  bonuses: unknown;
  isActive: boolean;
  memberLimit?: number | null;
  sortOrder?: number;
}

const TYPE_LABEL: Record<EntityType, string> = { cla: "Clã", vila: "Vila", rank: "Rank" };
const TYPE_EMOJI: Record<EntityType, string> = { cla: "🏯", vila: "🗺️", rank: "🎖️" };

export interface WorldMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

function button(action: string, label: string, style: ButtonStyle, ...parts: string[]): ButtonBuilder {
  return new ButtonBuilder().setCustomId(buildId(action, ...parts)).setLabel(label).setStyle(style);
}

/** Nome (clã/vila) ou chave (rank) — o identificador usado pra localizar/editar o registro. */
function identifierOf(type: EntityType, entity: EntityLike): string {
  return type === "rank" ? (entity.key ?? entity.name) : entity.name;
}

function formatBonuses(bonuses: unknown): string {
  return Object.entries(normalizeBonuses(bonuses))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

async function listEntities(guild: Guild, services: CommandServices, type: EntityType): Promise<EntityLike[]> {
  if (type === "cla") return services.world.listClans(guild, { includeInactive: true });
  if (type === "vila") return services.world.listVillages(guild, { includeInactive: true });
  return services.world.listRanks(guild, { includeInactive: true });
}

async function findEntity(
  guild: Guild,
  services: CommandServices,
  type: EntityType,
  identifier: string
): Promise<EntityLike | null> {
  if (type === "cla") return services.world.findClan(guild, identifier);
  if (type === "vila") return services.world.findVillage(guild, identifier);
  return services.world.findRank(guild, identifier);
}

async function setActive(
  guild: Guild,
  services: WorldConfigService,
  actorId: string,
  type: EntityType,
  identifier: string,
  isActive: boolean
): Promise<void> {
  if (type === "cla") await services.updateClan(guild, actorId, identifier, { isActive });
  else if (type === "vila") await services.updateVillage(guild, actorId, identifier, { isActive });
  else await services.updateRank(guild, actorId, identifier, { isActive });
}

async function removeEntity(
  guild: Guild,
  services: WorldConfigService,
  actorId: string,
  type: EntityType,
  identifier: string
): Promise<void> {
  if (type === "cla") await services.deleteClan(guild, actorId, identifier);
  else if (type === "vila") await services.deleteVillage(guild, actorId, identifier);
  else await services.deleteRank(guild, actorId, identifier);
}

function parseStrictInt(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new WorldRuleError(`Valor inválido para **${field}**: precisa ser um número inteiro.`);
  }
  return parsed;
}

// ─── Views ───────────────────────────────────────────────────────────────────

function formatEntityList(entities: EntityLike[], type: EntityType): string {
  if (entities.length === 0) return "Nenhum cadastrado.";
  return entities
    .map((e) => `${e.isActive ? "🟢" : "🔴"} ${e.name}${type === "rank" ? ` \`[${e.key}]\`` : ""}`)
    .join("\n");
}

export async function buildWorldConfigView(guild: Guild, services: CommandServices): Promise<WorldMenuView> {
  const [clans, villages, ranks] = await Promise.all([
    listEntities(guild, services, "cla"),
    listEntities(guild, services, "vila"),
    listEntities(guild, services, "rank")
  ]);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("⚙️ Configuração do Mundo")
    .addFields(
      { name: `${TYPE_EMOJI.cla} Clãs`, value: formatEntityList(clans, "cla"), inline: true },
      { name: `${TYPE_EMOJI.vila} Vilas`, value: formatEntityList(villages, "vila"), inline: true },
      { name: `${TYPE_EMOJI.rank} Ranks`, value: formatEntityList(ranks, "rank"), inline: true }
    );

  const components = [
    row(
      button("openCreateModal", "➕ Clã", ButtonStyle.Success, "cla"),
      button("openCreateModal", "➕ Vila", ButtonStyle.Success, "vila"),
      button("openCreateModal", "➕ Rank", ButtonStyle.Success, "rank")
    )
  ];

  const manageButtons = [
    clans.length > 0 ? button("manageType", `${TYPE_EMOJI.cla} Gerenciar Clãs`, ButtonStyle.Secondary, "cla") : null,
    villages.length > 0 ? button("manageType", `${TYPE_EMOJI.vila} Gerenciar Vilas`, ButtonStyle.Secondary, "vila") : null,
    ranks.length > 0 ? button("manageType", `${TYPE_EMOJI.rank} Gerenciar Ranks`, ButtonStyle.Secondary, "rank") : null
  ].filter((b): b is ButtonBuilder => b !== null);

  if (manageButtons.length > 0) {
    components.push(row(...manageButtons));
  }

  return { embeds: [embed], components };
}

export async function buildEntityListView(
  guild: Guild,
  services: CommandServices,
  type: EntityType
): Promise<WorldMenuView | null> {
  const entities = await listEntities(guild, services, type);
  if (entities.length === 0) return null;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${TYPE_EMOJI[type]} ${TYPE_LABEL[type]}s cadastrados`)
    .setDescription("Escolha um abaixo pra ver detalhes e editar.");

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("selectEntity", type))
    .setPlaceholder(`Escolher ${TYPE_LABEL[type].toLowerCase()}...`)
    .addOptions(
      entities.slice(0, MAX_OPTIONS).map((entity) => {
        const label = type === "rank" ? `${entity.name} [${entity.key}]` : entity.name;
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${entity.isActive ? "🟢" : "🔴"} ${truncate(label, 98)}`.slice(0, 100))
          .setValue(identifierOf(type, entity))
          .setDescription(truncate(entity.description ?? "Sem descrição.", 100));
      })
    );

  return {
    embeds: [embed],
    components: [row(select), row(button("backToConfig", "⬅️ Voltar", ButtonStyle.Secondary))]
  };
}

export async function buildEntityDetailView(
  guild: Guild,
  services: CommandServices,
  type: EntityType,
  identifier: string
): Promise<WorldMenuView | null> {
  const entity = await findEntity(guild, services, type, identifier);
  if (!entity) return null;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${TYPE_EMOJI[type]} ${entity.name}${type === "rank" ? ` \`[${entity.key}]\`` : ""}`)
    .setDescription(entity.description || "Sem descrição.")
    .addFields(
      { name: "Status", value: entity.isActive ? "🟢 Ativo" : "🔴 Inativo", inline: true },
      { name: "Bônus", value: formatBonuses(entity.bonuses) || "Nenhum", inline: true }
    );

  if (type === "cla") {
    embed.addFields({
      name: "Limite de membros",
      value: entity.memberLimit != null ? String(entity.memberLimit) : "Sem limite",
      inline: true
    });
  }
  if (type === "rank") {
    embed.addFields({ name: "Ordem", value: String(entity.sortOrder ?? 0), inline: true });
  }

  const encoded = encodeURIComponent(identifier);
  const components = [
    row(
      button("openEditModal", "✏️ Editar", ButtonStyle.Primary, type, encoded),
      button("toggleActive", entity.isActive ? "🔴 Desativar" : "🟢 Ativar", ButtonStyle.Secondary, type, encoded),
      button("remove", "🗑️ Remover", ButtonStyle.Danger, type, encoded)
    ),
    row(button("backToList", "⬅️ Voltar à lista", ButtonStyle.Secondary, type))
  ];

  return { embeds: [embed], components };
}

// ─── Modais ──────────────────────────────────────────────────────────────────

function inputRow(
  customId: string,
  label: string,
  style: TextInputStyle,
  opts: { required?: boolean; minLength?: number; maxLength?: number; value?: string } = {}
): ActionRowBuilder<ModalActionRowComponentBuilder> {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setRequired(opts.required ?? true);
  if (opts.minLength !== undefined) input.setMinLength(opts.minLength);
  if (opts.maxLength !== undefined) input.setMaxLength(opts.maxLength);
  if (opts.value !== undefined) input.setValue(opts.value);
  return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input);
}

function buildCreateModal(type: EntityType): ModalBuilder {
  const rows: ActionRowBuilder<ModalActionRowComponentBuilder>[] = [];

  if (type === "rank") {
    rows.push(inputRow("chave", "Chave técnica (ex: genin)", TextInputStyle.Short, { minLength: 2, maxLength: 40 }));
  }
  rows.push(inputRow("nome", "Nome de exibição", TextInputStyle.Short, { minLength: 2, maxLength: 80 }));
  rows.push(
    inputRow("descricao", "Descrição (opcional)", TextInputStyle.Paragraph, { required: false, maxLength: 300 })
  );

  return new ModalBuilder()
    .setCustomId(buildId("createModal", type))
    .setTitle(`Criar ${TYPE_LABEL[type]}`)
    .addComponents(...rows);
}

function buildEditModal(type: EntityType, entity: EntityLike): ModalBuilder {
  const rows: ActionRowBuilder<ModalActionRowComponentBuilder>[] = [];

  // Clã/vila são identificados pelo próprio nome — não dá pra renomear por aqui (quebraria
  // vínculos existentes). Rank é identificado pela chave, então o nome de exibição é editável.
  if (type === "rank") {
    rows.push(
      inputRow("nome", "Nome de exibição", TextInputStyle.Short, { minLength: 2, maxLength: 80, value: entity.name })
    );
  }
  rows.push(
    inputRow("descricao", "Descrição", TextInputStyle.Paragraph, {
      required: false,
      maxLength: 300,
      value: entity.description ?? ""
    })
  );
  rows.push(
    inputRow("bonus", "Bônus (ex: forca:2,chakra:10)", TextInputStyle.Short, {
      required: false,
      maxLength: 200,
      value: formatBonuses(entity.bonuses)
    })
  );

  if (type === "cla") {
    rows.push(
      inputRow("limite", "Limite de membros (vazio = sem limite)", TextInputStyle.Short, {
        required: false,
        maxLength: 10,
        value: entity.memberLimit != null ? String(entity.memberLimit) : ""
      })
    );
  }
  if (type === "rank") {
    rows.push(
      inputRow("ordem", "Ordem (número, menor aparece primeiro)", TextInputStyle.Short, {
        required: false,
        maxLength: 10,
        value: String(entity.sortOrder ?? 0)
      })
    );
  }

  return new ModalBuilder()
    .setCustomId(buildId("editModal", type, encodeURIComponent(identifierOf(type, entity))))
    .setTitle(`Editar ${TYPE_LABEL[type]}`.slice(0, 45))
    .addComponents(...rows);
}

// ─── Roteamento de interações ─────────────────────────────────────────────────

/** Mesma razão do attributeMenu: a mensagem de config é pública, então o próprio handler
 * reconfere acesso de admin a cada interação, não só na hora de abrir o comando. */
async function requireAdminInteraction(interaction: MenuInteraction, services: CommandServices): Promise<boolean> {
  const isAdmin = await canUseCommandAccess("admin", interaction.member, interaction.client, services.guildConfig);
  if (!isAdmin) {
    await interaction.reply({
      content: "Você precisa ter Administrador ou Gerenciar Servidor para configurar o mundo.",
      ephemeral: true
    });
  }
  return isAdmin;
}

function isEntityType(value: string | undefined): value is EntityType {
  return value === "cla" || value === "vila" || value === "rank";
}

export async function handleWorldMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);
  const [typePart, identifierPart] = parts;
  const type = isEntityType(typePart) ? typePart : null;

  if (interaction.isModalSubmit()) {
    if (!type) return;
    if (action === "createModal") {
      await handleCreateModalSubmit(interaction, services, type);
    } else if (action === "editModal" && identifierPart) {
      await handleEditModalSubmit(interaction, services, type, identifierPart);
    }
    return;
  }

  switch (action) {
    case "backToConfig": {
      if (!interaction.isButton()) return;
      await interaction.update(await buildWorldConfigView(interaction.guild, services));
      return;
    }

    case "manageType": {
      if (!interaction.isButton() || !type) return;
      const view = await buildEntityListView(interaction.guild, services, type);
      await updateOrFallback(interaction, view);
      return;
    }

    case "backToList": {
      if (!interaction.isButton() || !type) return;
      const view = await buildEntityListView(interaction.guild, services, type);
      await updateOrFallback(interaction, view ?? (await buildWorldConfigView(interaction.guild, services)));
      return;
    }

    case "selectEntity": {
      if (!interaction.isStringSelectMenu() || !type) return;
      const identifier = interaction.values[0];
      if (!identifier) return;
      const view = await buildEntityDetailView(interaction.guild, services, type, identifier);
      await updateOrFallback(interaction, view);
      return;
    }

    case "openCreateModal": {
      if (!interaction.isButton() || !type) return;
      await interaction.showModal(buildCreateModal(type));
      return;
    }

    case "openEditModal": {
      if (!interaction.isButton() || !type || !identifierPart) return;
      const entity = await findEntity(interaction.guild, services, type, decodeURIComponent(identifierPart));
      if (!entity) {
        await interaction.reply({ content: "Não encontrei mais isso.", ephemeral: true });
        return;
      }
      await interaction.showModal(buildEditModal(type, entity));
      return;
    }

    case "toggleActive": {
      if (!interaction.isButton() || !type || !identifierPart) return;
      await handleToggleActive(interaction, services, type, decodeURIComponent(identifierPart));
      return;
    }

    case "remove": {
      if (!interaction.isButton() || !type || !identifierPart) return;
      await handleRemove(interaction, services, type, decodeURIComponent(identifierPart));
      return;
    }

    default:
      return;
  }
}

async function updateOrFallback(
  interaction: ComponentMenuInteraction,
  view: WorldMenuView | null
): Promise<void> {
  if (!view) {
    await interaction.reply({ content: "Não encontrei mais esse conteúdo — pode ter sido removido.", ephemeral: true });
    return;
  }
  await interaction.update(view);
}

async function handleCreateModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  type: EntityType
): Promise<void> {
  const nome = interaction.fields.getTextInputValue("nome").trim();
  const descricaoRaw = interaction.fields.getTextInputValue("descricao").trim();
  const description = descricaoRaw.length > 0 ? descricaoRaw : undefined;

  await interaction.deferUpdate();

  try {
    if (type === "cla") {
      await services.world.createClan(interaction.guild, interaction.user.id, { name: nome, description });
    } else if (type === "vila") {
      await services.world.createVillage(interaction.guild, interaction.user.id, { name: nome, description });
    } else {
      const chave = interaction.fields.getTextInputValue("chave").trim();
      await services.world.createRank(interaction.guild, interaction.user.id, { key: chave, name: nome, description });
    }

    const view = await buildWorldConfigView(interaction.guild, services);
    await interaction.editReply(view);
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleEditModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  type: EntityType,
  encodedIdentifier: string
): Promise<void> {
  const identifier = decodeURIComponent(encodedIdentifier);
  const description = interaction.fields.getTextInputValue("descricao").trim();
  const bonuses = parseBonuses(interaction.fields.getTextInputValue("bonus").trim());

  await interaction.deferUpdate();

  try {
    if (type === "cla") {
      const limiteRaw = interaction.fields.getTextInputValue("limite").trim();
      const memberLimit = limiteRaw.length > 0 ? parseStrictInt(limiteRaw, "limite") : null;
      await services.world.updateClan(interaction.guild, interaction.user.id, identifier, {
        description,
        bonuses,
        memberLimit
      });
    } else if (type === "vila") {
      await services.world.updateVillage(interaction.guild, interaction.user.id, identifier, { description, bonuses });
    } else {
      const nome = interaction.fields.getTextInputValue("nome").trim();
      const ordemRaw = interaction.fields.getTextInputValue("ordem").trim();
      const sortOrder = ordemRaw.length > 0 ? parseStrictInt(ordemRaw, "ordem") : undefined;
      await services.world.updateRank(interaction.guild, interaction.user.id, identifier, {
        name: nome,
        description,
        bonuses,
        sortOrder
      });
    }

    const view = await buildEntityDetailView(interaction.guild, services, type, identifier);
    await interaction.editReply(view ?? (await buildWorldConfigView(interaction.guild, services)));
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleToggleActive(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  type: EntityType,
  identifier: string
): Promise<void> {
  await interaction.deferUpdate();

  const entity = await findEntity(interaction.guild, services, type, identifier);
  if (!entity) {
    await interaction.editReply({ content: "Não encontrei mais isso.", embeds: [], components: [] });
    return;
  }

  await setActive(interaction.guild, services.world, interaction.user.id, type, identifier, !entity.isActive);

  const view = await buildEntityDetailView(interaction.guild, services, type, identifier);
  await interaction.editReply(view ?? (await buildWorldConfigView(interaction.guild, services)));
}

async function handleRemove(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  type: EntityType,
  identifier: string
): Promise<void> {
  await interaction.deferUpdate();

  await removeEntity(interaction.guild, services.world, interaction.user.id, type, identifier);

  const view = await buildEntityListView(interaction.guild, services, type);
  await interaction.editReply(view ?? (await buildWorldConfigView(interaction.guild, services)));
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleWorldMenuInteraction });
