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
import type { CharacterWithWorld, LinkKind } from "../modules/characters/CharacterService.js";
import { renderFichaCard } from "../services/cardGenerator.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR, truncate } from "./uiConstants.js";

export const CARD_FILENAME = "ficha.png";
const BACKGROUND_FIELD_ID = "url";

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
  isOwner: boolean
): Promise<FichaView> {
  const view = await services.characters.getCharacterView(guild, character);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📜 ${view.character.name}`)
    .setDescription(
      view.attributes.length > 0
        ? view.attributes
            .map((attr) => `**${attr.name}**: ${attr.value}${attr.bonus !== 0 ? ` (${attr.baseValue} + ${attr.bonus})` : ""}`)
            .join("\n")
        : "Nenhum atributo configurado neste servidor ainda."
    )
    .addFields(
      { name: "💠 Chakra", value: String(view.chakra), inline: true },
      { name: "🏯 Clã", value: view.character.clan?.name ?? "—", inline: true },
      { name: "🗺️ Vila", value: view.character.village?.name ?? "—", inline: true },
      { name: "🎖️ Rank", value: view.character.rank?.name ?? "—", inline: true }
    );

  const [avatarUrl, progress] = await Promise.all([
    resolveAvatarUrl(guild, character.userId),
    services.training.getOrCreateProgress(guild, character)
  ]);

  const cardBuffer = await renderFichaCard({
    characterName: view.character.name,
    avatarUrl,
    backgroundUrl: character.backgroundUrl,
    rankName: view.character.rank?.name ?? null,
    villageName: view.character.village?.name ?? null,
    clanName: view.character.clan?.name ?? null,
    chakra: view.chakra,
    trainingPoints: progress.trainingPoints,
    attributes: view.attributes.map((attr) => ({ name: attr.name, value: attr.value, maxValue: attr.maxValue }))
  });

  const attachment = new AttachmentBuilder(cardBuffer, { name: CARD_FILENAME });
  embed.setImage(`attachment://${CARD_FILENAME}`);

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (isOwner) {
    const [clans, villages] = await Promise.all([
      services.world.listClans(guild),
      services.world.listVillages(guild)
    ]);

    if (clans.length > 0) {
      components.push(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(buildId("selectClan"))
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
            .setCustomId(buildId("selectVillage"))
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
          .setCustomId(buildId("openBackgroundModal"))
          .setLabel("🖼️ Alterar fundo")
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

function buildBackgroundModal(): ModalBuilder {
  const urlInput = new TextInputBuilder()
    .setCustomId(BACKGROUND_FIELD_ID)
    .setLabel("Link da imagem de fundo")
    .setPlaceholder("https://... (pra usar um anexo, rode .ficha fundo com a imagem anexada)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(500)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("backgroundModal"))
    .setTitle("Alterar fundo da ficha")
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
  const { action } = parseCustomId(interaction.customId);

  if (interaction.isModalSubmit()) {
    if (action === "createModal") {
      await handleCreateModalSubmit(interaction, services);
    } else if (action === "backgroundModal") {
      await handleBackgroundModalSubmit(interaction, services);
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
      await interaction.showModal(buildBackgroundModal());
      return;
    }

    case "selectClan": {
      if (!interaction.isStringSelectMenu()) return;
      await handleLink(interaction, services, "cla", interaction.values[0]);
      return;
    }

    case "selectVillage": {
      if (!interaction.isStringSelectMenu()) return;
      await handleLink(interaction, services, "vila", interaction.values[0]);
      return;
    }

    default:
      return;
  }
}

async function handleLink(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  kind: LinkKind,
  value: string | undefined
): Promise<void> {
  if (!value) return;

  await interaction.deferUpdate();

  try {
    const updated = await services.characters.linkCharacter(interaction.guild, interaction.user.id, kind, value);
    const view = await buildFichaView(interaction.guild, updated, services, true);
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
  services: CommandServices
): Promise<void> {
  const url = interaction.fields.getTextInputValue(BACKGROUND_FIELD_ID).trim();
  const fromMessage = interaction.isFromMessage();

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

    const updated = await services.characters.setBackground(interaction.guild, character, url);
    const view = await buildFichaView(interaction.guild, updated, services, true);
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
