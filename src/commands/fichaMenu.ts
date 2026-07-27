import {
  ActionRowBuilder,
  AttachmentBuilder,
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
import { ATTRIBUTE_CATEGORIES } from "../modules/attributes/AttributeService.js";
import type { CharacterAttributeView, CharacterWithWorld, LinkKind } from "../modules/characters/CharacterService.js";
import { renderFichaCard } from "../services/cardGenerator.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR, truncate } from "./uiConstants.js";

const CARD_FILENAME_BASE = "ficha";
const BACKGROUND_FIELD_ID = "url";
/** Parte de customId usada quando o fundo alterado é o genérico (sem categoria ativa). */
const NO_CATEGORY = "-";

interface CategoryTheme {
  /** Desenhado no card (canvas), sem emoji — a fonte bundlada não tem glifos de emoji. */
  label: string;
  /** Cor de destaque do card; omitido cai no laranja padrão do cardGenerator. */
  accent?: string;
  /** Label do botão de troca (aqui pode ter emoji — é renderizado pelo próprio Discord). */
  switchLabel: string;
}

/** Cada categoria tem uma identidade visual própria — pedido explícito pra não ficarem
 * "iguais". Categoria fora dessas duas conhecidas cai num tema neutro genérico. */
const CATEGORY_THEME: Record<string, CategoryTheme> = {
  fisico: { label: "ATRIBUTOS FÍSICOS", accent: "#ff5a36", switchLabel: "💪 Físico" },
  mental: { label: "ATRIBUTOS MENTAIS", accent: "#7c6cff", switchLabel: "🧠 Mental" }
};

function categoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEME[category] ?? { label: `ATRIBUTOS (${category.toUpperCase()})`, switchLabel: category };
}

/** Preserva a ordem de primeira aparição das categorias (attributes já vêm ordenados por sortOrder/nome). */
function groupAttributesByCategory(attributes: CharacterAttributeView[]): Map<string, CharacterAttributeView[]> {
  const groups = new Map<string, CharacterAttributeView[]>();
  for (const attr of attributes) {
    const group = groups.get(attr.category);
    if (group) {
      group.push(attr);
    } else {
      groups.set(attr.category, [attr]);
    }
  }
  return groups;
}

/** Físico/mental primeiro (ordem consistente com os botões de criação em attributeMenu.ts), depois qualquer outra categoria presente. */
function orderCategories(groups: Map<string, CharacterAttributeView[]>): string[] {
  const known: readonly string[] = ATTRIBUTE_CATEGORIES;
  const present = [...groups.keys()];
  return [...ATTRIBUTE_CATEGORIES.filter((c) => groups.has(c)), ...present.filter((c) => !known.includes(c))];
}

/**
 * Menu interativo da ficha: clã e vila são escolhidos por select (só entre o que o
 * servidor cadastrou); rank não é selecionável aqui — começa no mais básico na criação
 * (CharacterService.createCharacter) e só muda por um sistema futuro de vagas/graduação.
 * Sem ficha ainda, um botão abre um Modal pedindo o nome em vez de exigir `.ficha criar`.
 */

const ID_PREFIX = "fichamenu";
const MAX_OPTIONS = 25;
const NAME_FIELD_ID = "nome";

type ComponentMenuInteraction = StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">;

export interface FichaView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  files?: AttachmentBuilder[];
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

// ─── Views ───────────────────────────────────────────────────────────────────

export function buildCreatePromptView(): FichaView {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("📜 Você ainda não tem uma ficha")
    .setDescription("Clique no botão abaixo pra criar seu personagem neste servidor.");

  const createButton = new ButtonBuilder()
    .setCustomId(buildId("openCreateModal"))
    .setLabel("📝 Criar ficha")
    .setStyle(ButtonStyle.Success);

  return { embeds: [embed], components: [row(createButton)] };
}

async function resolveAvatarUrl(guild: Guild, userId: string): Promise<string> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    return member.displayAvatarURL({ extension: "png", size: 256 });
  }
  const user = await guild.client.users.fetch(userId).catch(() => null);
  return user?.displayAvatarURL({ extension: "png", size: 256 }) ?? guild.client.user.displayAvatarURL();
}

export async function buildFichaView(
  guild: Guild,
  character: CharacterWithWorld,
  services: CommandServices,
  isOwner: boolean,
  activeCategory?: string | null
): Promise<FichaView> {
  const view = await services.characters.getCharacterView(guild, character);

  const [avatarUrl, progress] = await Promise.all([
    resolveAvatarUrl(guild, character.userId),
    services.training.getOrCreateProgress(guild, character)
  ]);

  // Um card por vez (não mais os dois juntos numa mensagem só) — um botão troca de
  // categoria. Sem categoria pedida (ou pedida mas vazia), cai na primeira categoria
  // com atributos; sem nenhum atributo cadastrado, vira o card genérico de sempre.
  const groups = groupAttributesByCategory(view.attributes);
  const orderedCategories = orderCategories(groups);
  const resolvedCategory =
    activeCategory && groups.has(activeCategory) ? activeCategory : (orderedCategories[0] ?? null);
  const theme = resolvedCategory ? categoryTheme(resolvedCategory) : null;
  const cardAttributes = resolvedCategory ? (groups.get(resolvedCategory) ?? []) : [];

  const filename = `${CARD_FILENAME_BASE}${resolvedCategory ? `-${resolvedCategory}` : ""}.png`;
  const backgroundUrl = services.characters.getBackgroundForCategory(character, resolvedCategory);

  const cardBuffer = await renderFichaCard({
    characterName: view.character.name,
    avatarUrl,
    backgroundUrl,
    rankName: view.character.rank?.name ?? null,
    villageName: view.character.village?.name ?? null,
    clanName: view.character.clan?.name ?? null,
    chakra: view.chakra,
    trainingPoints: progress.trainingPoints,
    attributes: cardAttributes.map((attr) => ({ name: attr.name, value: attr.value, maxValue: attr.maxValue })),
    sectionLabel: theme?.label ?? null,
    accent: theme?.accent
  });

  const attachment = new AttachmentBuilder(cardBuffer, { name: filename });
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📜 ${view.character.name}`)
    .setImage(`attachment://${filename}`);

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  // Botões de troca de categoria: disponíveis pra qualquer um que veja a ficha (é só
  // navegação, não uma mutação) — só aparecem as categorias que a ficha ainda não está mostrando.
  const otherCategories = orderedCategories.filter((c) => c !== resolvedCategory);
  if (otherCategories.length > 0) {
    components.push(
      row(
        ...otherCategories.map((category) =>
          new ButtonBuilder()
            .setCustomId(buildId("selectCategory", category))
            .setLabel(categoryTheme(category).switchLabel)
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }

  if (isOwner) {
    const [clans, villages] = await Promise.all([
      services.world.listClans(guild),
      services.world.listVillages(guild)
    ]);

    if (clans.length > 0) {
      components.push(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(buildId("selectClan", resolvedCategory ?? NO_CATEGORY))
            .setPlaceholder("Escolher clã...")
            .addOptions(
              clans.slice(0, MAX_OPTIONS).map((clan) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(truncate(clan.name, 100))
                  .setValue(clan.name)
                  .setDescription(truncate(clan.description ?? "Sem descrição.", 100))
                  .setDefault(clan.id === view.character.clanId)
              )
            )
        )
      );
    }

    if (villages.length > 0) {
      components.push(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(buildId("selectVillage", resolvedCategory ?? NO_CATEGORY))
            .setPlaceholder("Escolher vila...")
            .addOptions(
              villages.slice(0, MAX_OPTIONS).map((village) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(truncate(village.name, 100))
                  .setValue(village.name)
                  .setDescription(truncate(village.description ?? "Sem descrição.", 100))
                  .setDefault(village.id === view.character.villageId)
              )
            )
        )
      );
    }

    components.push(
      row(
        new ButtonBuilder()
          .setCustomId(buildId("openBackgroundModal", resolvedCategory ?? NO_CATEGORY))
          .setLabel(`🖼️ Alterar fundo${theme ? ` (${theme.switchLabel.replace(/^\S+\s/, "")})` : ""}`)
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return { embeds: [embed], components, files: [attachment] };
}

function buildCreateModal(): ModalBuilder {
  const nameInput = new TextInputBuilder()
    .setCustomId(NAME_FIELD_ID)
    .setLabel("Nome do personagem")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("createModal"))
    .setTitle("Criar ficha")
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput));
}

function buildBackgroundModal(category: string): ModalBuilder {
  const urlInput = new TextInputBuilder()
    .setCustomId(BACKGROUND_FIELD_ID)
    .setLabel("Link da imagem de fundo")
    .setPlaceholder("https://... (pra usar um anexo, rode .ficha fundo com a imagem anexada)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(true);

  const theme = category !== NO_CATEGORY ? categoryTheme(category) : null;

  return new ModalBuilder()
    .setCustomId(buildId("backgroundModal", category))
    .setTitle(`Alterar fundo${theme ? ` — ${theme.switchLabel.replace(/^\S+\s/, "")}` : ""}`.slice(0, 45))
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(urlInput));
}

// ─── Roteamento de interações ─────────────────────────────────────────────────

/** Mesmo problema do JutsuMenu: sem `attachments: []` explícito, o Discord mantém o
 * anexo antigo numa edição — aqui toda view sempre tem uma imagem nova, mas mantém
 * a mesma defesa por segurança/consistência. */
function withClearedAttachments(view: FichaView): FichaView & { attachments: [] } {
  return { ...view, files: view.files ?? [], attachments: [] };
}

async function handleFichaMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  const { action, parts } = parseCustomId(interaction.customId);

  if (interaction.isModalSubmit()) {
    if (action === "createModal") {
      await handleCreateModalSubmit(interaction, services);
    } else if (action === "backgroundModal") {
      await handleBackgroundModalSubmit(interaction, services, parts[0]);
    }
    return;
  }

  switch (action) {
    case "openCreateModal": {
      if (!interaction.isButton()) return;
      await interaction.showModal(buildCreateModal());
      return;
    }

    case "openBackgroundModal": {
      if (!interaction.isButton()) return;
      await interaction.showModal(buildBackgroundModal(parts[0] ?? NO_CATEGORY));
      return;
    }

    case "selectCategory": {
      if (!interaction.isButton()) return;
      await handleSelectCategory(interaction, services, parts[0]);
      return;
    }

    case "selectClan": {
      if (!interaction.isStringSelectMenu()) return;
      await handleLink(interaction, services, "cla", interaction.values[0], parts[0]);
      return;
    }

    case "selectVillage": {
      if (!interaction.isStringSelectMenu()) return;
      await handleLink(interaction, services, "vila", interaction.values[0], parts[0]);
      return;
    }

    default:
      return;
  }
}

async function handleSelectCategory(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  category: string | undefined
): Promise<void> {
  if (!category) return;

  await interaction.deferUpdate();

  const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
  if (!character) return;

  const view = await buildFichaView(interaction.guild, character, services, true, category);
  await interaction.editReply(withClearedAttachments(view));
}

async function handleLink(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  kind: LinkKind,
  value: string | undefined,
  activeCategory: string | undefined
): Promise<void> {
  if (!value) return;

  await interaction.deferUpdate();

  try {
    const updated = await services.characters.linkCharacter(interaction.guild, interaction.user.id, kind, value);
    const view = await buildFichaView(interaction.guild, updated, services, true, activeCategory);
    await interaction.editReply(withClearedAttachments(view));
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleCreateModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const name = interaction.fields.getTextInputValue(NAME_FIELD_ID).trim();
  const fromMessage = interaction.isFromMessage();

  if (fromMessage) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ ephemeral: true });
  }

  try {
    const created = await services.characters.createCharacter(interaction.guild, interaction.user.id, name);
    const view = await buildFichaView(interaction.guild, created, services, true);
    await interaction.editReply(fromMessage ? withClearedAttachments(view) : view);
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.editReply({ content: error.message, embeds: [], components: [], files: [] });
      return;
    }
    throw error;
  }
}

async function handleBackgroundModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  categoryPart: string | undefined
): Promise<void> {
  const url = interaction.fields.getTextInputValue(BACKGROUND_FIELD_ID).trim();
  const fromMessage = interaction.isFromMessage();
  const category = categoryPart && categoryPart !== NO_CATEGORY ? categoryPart : null;

  if (fromMessage) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ ephemeral: true });
  }

  try {
    if (!/^https?:\/\//i.test(url)) {
      throw new DomainError("Isso não parece um link válido (precisa começar com http:// ou https://).");
    }

    const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
    if (!character) {
      throw new DomainError("Você ainda não tem uma ficha.");
    }

    const updated = category
      ? await services.characters.setCategoryBackground(interaction.guild, character, category, url)
      : await services.characters.setBackground(interaction.guild, character, url);
    const view = await buildFichaView(interaction.guild, updated, services, true, category);
    await interaction.editReply(fromMessage ? withClearedAttachments(view) : view);
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.editReply({ content: error.message, embeds: [], components: [], files: [] });
      return;
    }
    throw error;
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleFichaMenuInteraction });
