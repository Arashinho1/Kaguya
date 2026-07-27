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
import {
  DEFAULT_STYLE_TARGET,
  type CardStyle,
  type CharacterAttributeView,
  type CharacterWithWorld,
  type LinkKind
} from "../modules/characters/CharacterService.js";
import { renderFichaCard } from "../services/cardGenerator.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR, truncate } from "./uiConstants.js";

const CARD_FILENAME_BASE = "ficha";
const IMAGE_FIELD_ID = "url";
const COLOR_FIELD_ID = "hex";

interface CategoryTheme {
  /** Desenhado no card (canvas), sem emoji — a fonte bundlada não tem glifos de emoji. */
  label: string;
  /** Cor de destaque padrão do card; substituível pelo editor visual (accent customizado). */
  accent?: string;
  /** Label do botão de troca (aqui pode ter emoji — é renderizado pelo próprio Discord). */
  switchLabel: string;
}

/** Cada categoria tem uma identidade visual própria por padrão — pedido explícito pra não
 * ficarem "iguais". Categoria fora dessas duas conhecidas cai num tema neutro genérico. */
const CATEGORY_THEME: Record<string, CategoryTheme> = {
  fisico: { label: "ATRIBUTOS FÍSICOS", accent: "#ff5a36", switchLabel: "💪 Físico" },
  mental: { label: "ATRIBUTOS MENTAIS", accent: "#7c6cff", switchLabel: "🧠 Mental" }
};

function categoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEME[category] ?? { label: `ATRIBUTOS (${category.toUpperCase()})`, switchLabel: category };
}

/** Nome amigável de um alvo de estilo (categoria ou o "_default" genérico), sem emoji. */
function targetDisplayName(target: string): string {
  if (target === DEFAULT_STYLE_TARGET) return "Padrão";
  return categoryTheme(target).switchLabel.replace(/^\S+\s/, "");
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

function button(action: string, label: string, style: ButtonStyle, ...parts: string[]): ButtonBuilder {
  return new ButtonBuilder().setCustomId(buildId(action, ...parts)).setLabel(label).setStyle(style);
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

interface ActiveCard {
  attachment: AttachmentBuilder;
  filename: string;
  theme: CategoryTheme | null;
  style: CardStyle;
  characterName: string;
}

/** Resolve a categoria ativa (primeira com atributos, se não pedida) e renderiza o card
 * dela — compartilhado entre a view normal da ficha e o editor visual, que precisam do
 * mesmo card, só que com barras de ação diferentes por baixo. */
async function renderActiveCard(
  guild: Guild,
  character: CharacterWithWorld,
  services: CommandServices,
  activeCategory: string | null | undefined
): Promise<{ card: ActiveCard; resolvedCategory: string | null; orderedCategories: string[] }> {
  const view = await services.characters.getCharacterView(guild, character);

  const [avatarUrl, progress] = await Promise.all([
    resolveAvatarUrl(guild, character.userId),
    services.training.getOrCreateProgress(guild, character)
  ]);

  const groups = groupAttributesByCategory(view.attributes);
  const orderedCategories = orderCategories(groups);
  const resolvedCategory =
    activeCategory && groups.has(activeCategory) ? activeCategory : (orderedCategories[0] ?? null);
  const theme = resolvedCategory ? categoryTheme(resolvedCategory) : null;
  const cardAttributes = resolvedCategory ? (groups.get(resolvedCategory) ?? []) : [];

  const target = resolvedCategory ?? DEFAULT_STYLE_TARGET;
  const style = services.characters.getCardStyle(character, target);
  const filename = `${CARD_FILENAME_BASE}${resolvedCategory ? `-${resolvedCategory}` : ""}.png`;

  const cardBuffer = await renderFichaCard({
    characterName: view.character.name,
    avatarUrl,
    backgroundUrl: style.backgroundUrl,
    backgroundColor: style.backgroundColor,
    rankName: view.character.rank?.name ?? null,
    villageName: view.character.village?.name ?? null,
    clanName: view.character.clan?.name ?? null,
    chakra: view.chakra,
    trainingPoints: progress.trainingPoints,
    attributes: cardAttributes.map((attr) => ({ name: attr.name, value: attr.value, maxValue: attr.maxValue })),
    sectionLabel: theme?.label ?? null,
    accent: style.accent ?? theme?.accent
  });

  const attachment = new AttachmentBuilder(cardBuffer, { name: filename });

  return {
    card: { attachment, filename, theme, style, characterName: view.character.name },
    resolvedCategory,
    orderedCategories
  };
}

export async function buildFichaView(
  guild: Guild,
  character: CharacterWithWorld,
  services: CommandServices,
  isOwner: boolean,
  activeCategory?: string | null
): Promise<FichaView> {
  const {
    card: { attachment, filename, characterName },
    resolvedCategory,
    orderedCategories
  } = await renderActiveCard(guild, character, services, activeCategory);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📜 ${characterName}`)
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

    const target = resolvedCategory ?? DEFAULT_STYLE_TARGET;

    // Uma vez escolhido, o select some — fixa a pessoa na escolha em vez de deixar trocar
    // livremente. Só staff consegue reverter (.ficha resetar), o que faz o select voltar.
    if (clans.length > 0 && !character.clanId) {
      components.push(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(buildId("selectClan", target))
            .setPlaceholder("Escolher clã...")
            .addOptions(
              clans.slice(0, MAX_OPTIONS).map((clan) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(truncate(clan.name, 100))
                  .setValue(clan.name)
                  .setDescription(truncate(clan.description || "Sem descrição.", 100))
              )
            )
        )
      );
    }

    if (villages.length > 0 && !character.villageId) {
      components.push(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(buildId("selectVillage", target))
            .setPlaceholder("Escolher vila...")
            .addOptions(
              villages.slice(0, MAX_OPTIONS).map((village) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(truncate(village.name, 100))
                  .setValue(village.name)
                  .setDescription(truncate(village.description || "Sem descrição.", 100))
              )
            )
        )
      );
    }

    components.push(
      row(
        new ButtonBuilder()
          .setCustomId(buildId("openVisualEditor", target))
          .setLabel(`🎨 Editar Visual (${targetDisplayName(target)})`)
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return { embeds: [embed], components, files: [attachment] };
}

export async function buildVisualEditorView(
  guild: Guild,
  character: CharacterWithWorld,
  services: CommandServices,
  target: string
): Promise<FichaView> {
  const {
    card: { attachment, filename, style }
  } = await renderActiveCard(guild, character, services, target === DEFAULT_STYLE_TARGET ? null : target);

  const backgroundLine = style.backgroundUrl
    ? "🖼️ Imagem"
    : style.backgroundColor
      ? `🎨 Cor sólida \`${style.backgroundColor}\``
      : "Padrão (sem customização)";

  const fundoCommand = target === DEFAULT_STYLE_TARGET ? ".ficha fundo" : `.ficha fundo ${target}`;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🎨 Editar Visual — ${targetDisplayName(target)}`)
    .setDescription(
      [
        "O preview abaixo atualiza a cada mudança. Imagem e cor sólida são alternativas — escolher uma limpa a outra.",
        `-# Discord não deixa anexar arquivo num formulário como esse — pra usar uma imagem do seu computador (em vez de um link), rode \`${fundoCommand}\` com a imagem anexada na mensagem.`,
        "",
        `**Fundo:** ${backgroundLine}`,
        `**Destaque (borda/chakra/barras):** ${style.accent ? `\`${style.accent}\`` : "Padrão da categoria"}`
      ].join("\n")
    )
    .setImage(`attachment://${filename}`);

  const components = [
    row(
      button("openImageModal", "🖼️ Imagem", ButtonStyle.Secondary, target),
      button("openColorModal", "🎨 Cor sólida", ButtonStyle.Secondary, target),
      button("openAccentModal", "🟧 Destaque", ButtonStyle.Secondary, target)
    ),
    row(
      button("resetStyle", "♻️ Restaurar padrão", ButtonStyle.Danger, target),
      button("backToFicha", "⬅️ Voltar pra ficha", ButtonStyle.Secondary, target)
    )
  ];

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

function buildImageModal(target: string): ModalBuilder {
  const urlInput = new TextInputBuilder()
    .setCustomId(IMAGE_FIELD_ID)
    .setLabel("Link direto da imagem")
    .setPlaceholder("https://.../imagem.jpg — não link de página (Pinterest, Google Imagens...)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("imageModal", target))
    .setTitle(`Imagem — ${targetDisplayName(target)}`.slice(0, 45))
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(urlInput));
}

function buildColorModal(action: string, title: string, target: string, currentValue: string | null): ModalBuilder {
  const hexInput = new TextInputBuilder()
    .setCustomId(COLOR_FIELD_ID)
    .setLabel("Cor em hexadecimal")
    .setPlaceholder("#1b1230")
    .setStyle(TextInputStyle.Short)
    .setMinLength(7)
    .setMaxLength(7)
    .setRequired(true);
  if (currentValue) hexInput.setValue(currentValue);

  return new ModalBuilder()
    .setCustomId(buildId(action, target))
    .setTitle(`${title} — ${targetDisplayName(target)}`.slice(0, 45))
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(hexInput));
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
  const [target] = parts;

  if (interaction.isModalSubmit()) {
    if (action === "createModal") {
      await handleCreateModalSubmit(interaction, services);
    } else if (action === "imageModal" && target) {
      await handleImageModalSubmit(interaction, services, target);
    } else if (action === "colorModal" && target) {
      await handleColorModalSubmit(interaction, services, target);
    } else if (action === "accentModal" && target) {
      await handleAccentModalSubmit(interaction, services, target);
    }
    return;
  }

  switch (action) {
    case "openCreateModal": {
      if (!interaction.isButton()) return;
      await interaction.showModal(buildCreateModal());
      return;
    }

    case "selectCategory": {
      if (!interaction.isButton()) return;
      await handleSelectCategory(interaction, services, target);
      return;
    }

    case "selectClan": {
      if (!interaction.isStringSelectMenu()) return;
      await handleLink(interaction, services, "cla", interaction.values[0], target);
      return;
    }

    case "selectVillage": {
      if (!interaction.isStringSelectMenu()) return;
      await handleLink(interaction, services, "vila", interaction.values[0], target);
      return;
    }

    case "openVisualEditor": {
      if (!interaction.isButton() || !target) return;
      await handleOpenVisualEditor(interaction, services, target);
      return;
    }

    case "openImageModal": {
      if (!interaction.isButton() || !target) return;
      await interaction.showModal(buildImageModal(target));
      return;
    }

    case "openColorModal": {
      if (!interaction.isButton() || !target) return;
      const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
      const current = character ? services.characters.getCardStyle(character, target).backgroundColor : null;
      await interaction.showModal(buildColorModal("colorModal", "Cor sólida", target, current));
      return;
    }

    case "openAccentModal": {
      if (!interaction.isButton() || !target) return;
      const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
      const current = character ? services.characters.getCardStyle(character, target).accent : null;
      await interaction.showModal(buildColorModal("accentModal", "Destaque", target, current));
      return;
    }

    case "resetStyle": {
      if (!interaction.isButton() || !target) return;
      await handleResetStyle(interaction, services, target);
      return;
    }

    case "backToFicha": {
      if (!interaction.isButton() || !target) return;
      await handleBackToFicha(interaction, services, target);
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

async function handleOpenVisualEditor(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  target: string
): Promise<void> {
  await interaction.deferUpdate();

  const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
  if (!character) return;

  const view = await buildVisualEditorView(interaction.guild, character, services, target);
  await interaction.editReply(withClearedAttachments(view));
}

async function handleResetStyle(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  target: string
): Promise<void> {
  await interaction.deferUpdate();

  const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
  if (!character) return;

  const updated = await services.characters.resetCategoryStyle(interaction.guild, character, target);
  const view = await buildVisualEditorView(interaction.guild, updated, services, target);
  await interaction.editReply(withClearedAttachments(view));
}

async function handleBackToFicha(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  target: string
): Promise<void> {
  await interaction.deferUpdate();

  const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
  if (!character) return;

  const category = target === DEFAULT_STYLE_TARGET ? undefined : target;
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

/**
 * As três abaixo seguem o mesmo formato: modal foi aberto a partir do editor visual
 * (sempre "fromMessage"), então defer+edit a própria mensagem; erro de validação (imagem
 * que não carrega, hex inválido) vira um toast efêmero sem mexer no preview já mostrado.
 */
async function handleImageModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  target: string
): Promise<void> {
  const url = interaction.fields.getTextInputValue(IMAGE_FIELD_ID).trim();
  await interaction.deferUpdate();

  try {
    if (!/^https?:\/\//i.test(url)) {
      throw new DomainError("Isso não parece um link válido (precisa começar com http:// ou https://).");
    }

    const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
    if (!character) throw new DomainError("Você ainda não tem uma ficha.");

    const updated = await services.characters.setCategoryImage(interaction.guild, character, target, url);
    const view = await buildVisualEditorView(interaction.guild, updated, services, target);
    await interaction.editReply(withClearedAttachments(view));
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleColorModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  target: string
): Promise<void> {
  const hex = interaction.fields.getTextInputValue(COLOR_FIELD_ID).trim();
  await interaction.deferUpdate();

  try {
    const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
    if (!character) throw new DomainError("Você ainda não tem uma ficha.");

    const updated = await services.characters.setCategoryColor(interaction.guild, character, target, hex);
    const view = await buildVisualEditorView(interaction.guild, updated, services, target);
    await interaction.editReply(withClearedAttachments(view));
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleAccentModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  target: string
): Promise<void> {
  const hex = interaction.fields.getTextInputValue(COLOR_FIELD_ID).trim();
  await interaction.deferUpdate();

  try {
    const character = await services.characters.getActiveCharacter(interaction.guild, interaction.user.id);
    if (!character) throw new DomainError("Você ainda não tem uma ficha.");

    const updated = await services.characters.setCategoryAccent(interaction.guild, character, target, hex);
    const view = await buildVisualEditorView(interaction.guild, updated, services, target);
    await interaction.editReply(withClearedAttachments(view));
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleFichaMenuInteraction });
