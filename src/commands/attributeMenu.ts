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
  type Guild,
  type MessageActionRowComponentBuilder,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction
} from "discord.js";

import { buildCustomId, parseCustomId } from "../core/commands/customId.js";
import { DomainError } from "../core/errors.js";
import type { MenuInteraction } from "../core/commands/menuRegistry.js";
import { ATTRIBUTE_CATEGORIES, type AttributeCategory } from "../modules/attributes/AttributeService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR, truncate } from "./uiConstants.js";

const CATEGORY_LABELS: Record<AttributeCategory, string> = {
  fisico: "💪 Físico",
  mental: "🧠 Mental"
};

function isAttributeCategory(value: string | undefined): value is AttributeCategory {
  return (ATTRIBUTE_CATEGORIES as readonly string[]).includes(value ?? "");
}

/**
 * Menu de configuração de atributos (`.atributo config` / `.attr config`): dois botões
 * (criar atributo, fórmula de chakra). A fórmula de chakra por rank usa o node "lookup"
 * do motor de fórmulas — um select de ranks abre um modal pedindo o valor fixo daquele
 * rank, sem exigir edição de JSON/código (ver AttributeService.setChakraRankValue).
 */

const ID_PREFIX = "attrmenu";
const CREATE_KEY_FIELD = "chave";
const CREATE_NAME_FIELD = "nome";
const CHAKRA_VALUE_FIELD = "valor";
const MAX_OPTIONS = 25;

export interface AttributeMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

// ─── Views ───────────────────────────────────────────────────────────────────

export async function buildAttributeConfigView(guild: Guild, services: CommandServices): Promise<AttributeMenuView> {
  const [attributes, rankTable] = await Promise.all([
    services.attributes.listAttributes(guild),
    services.attributes.getChakraRankTable(guild)
  ]);

  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle("⚙️ Configuração de Atributos");

  if (attributes.length === 0) {
    embed.setDescription("Nenhum atributo ativo configurado ainda.");
  } else {
    for (const category of ATTRIBUTE_CATEGORIES) {
      const inCategory = attributes.filter((attr) => attr.category === category);
      if (inCategory.length === 0) continue;

      embed.addFields({
        name: CATEGORY_LABELS[category],
        value: inCategory.map((attr) => `**${attr.name}** \`[${attr.key}]\` — base ${attr.baseValue}`).join("\n")
      });
    }

    const knownCategories: readonly string[] = ATTRIBUTE_CATEGORIES;
    const others = attributes.filter((attr) => !knownCategories.includes(attr.category));
    if (others.length > 0) {
      embed.addFields({
        name: "🔹 Outros",
        value: others.map((attr) => `**${attr.name}** \`[${attr.key}]\` (${attr.category})`).join("\n")
      });
    }
  }

  embed.addFields({
    name: "💠 Chakra por rank",
    value:
      Object.keys(rankTable).length > 0
        ? Object.entries(rankTable)
            .map(([key, value]) => `\`${key}\`: ${value}`)
            .join("\n")
        : "Ainda não configurado — use o botão abaixo."
  });

  const buttons = row(
    new ButtonBuilder()
      .setCustomId(buildId("openCreateModal", "fisico"))
      .setLabel(`➕ Criar — ${CATEGORY_LABELS.fisico}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildId("openCreateModal", "mental"))
      .setLabel(`➕ Criar — ${CATEGORY_LABELS.mental}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(buildId("openChakraMenu")).setLabel("💠 Fórmula de Chakra").setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [buttons] };
}

export async function buildChakraRankView(guild: Guild, services: CommandServices): Promise<AttributeMenuView> {
  const [ranks, rankTable] = await Promise.all([
    services.world.listRanks(guild),
    services.attributes.getChakraRankTable(guild)
  ]);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("💠 Chakra por rank")
    .setDescription(
      ranks.length > 0
        ? "Escolha um rank abaixo para definir o valor fixo de Chakra dele. Ranks sem valor definido concedem 0 (além de bônus de clã/vila/equipamento)."
        : "Nenhum rank cadastrado ainda. Cadastre ranks com `.mundo rank criar` antes de configurar o chakra por rank."
    );

  if (ranks.length > 0) {
    embed.addFields({
      name: "Valores atuais",
      value: ranks.map((rank) => `**${rank.name}**: ${rankTable[rank.key] ?? "0"}`).join("\n")
    });
  }

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (ranks.length > 0) {
    components.push(
      row(
        new StringSelectMenuBuilder()
          .setCustomId(buildId("selectRankForChakra"))
          .setPlaceholder("Escolher rank...")
          .addOptions(
            ranks.slice(0, MAX_OPTIONS).map((rank) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(truncate(rank.name, 100))
                .setValue(rank.key)
                .setDescription(`Chakra atual: ${rankTable[rank.key] ?? 0}`)
            )
          )
      )
    );
  }

  components.push(
    row(new ButtonBuilder().setCustomId(buildId("backToConfig")).setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary))
  );

  return { embeds: [embed], components };
}

function buildCreateModal(category: AttributeCategory): ModalBuilder {
  const keyInput = new TextInputBuilder()
    .setCustomId(CREATE_KEY_FIELD)
    .setLabel("Chave técnica (ex: forca)")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(40)
    .setRequired(true);

  const nameInput = new TextInputBuilder()
    .setCustomId(CREATE_NAME_FIELD)
    .setLabel("Nome de exibição")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("createModal", category))
    .setTitle(`Criar atributo — ${CATEGORY_LABELS[category]}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(keyInput),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput)
    );
}

function buildChakraValueModal(rankKey: string, rankName: string): ModalBuilder {
  const valueInput = new TextInputBuilder()
    .setCustomId(CHAKRA_VALUE_FIELD)
    .setLabel(`Chakra para o rank ${rankName}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("chakraValueModal", rankKey))
    .setTitle(`Chakra — ${rankName}`.slice(0, 45))
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(valueInput));
}

// ─── Roteamento de interações ─────────────────────────────────────────────────

/**
 * Diferente do menu da ficha (onde qualquer clique só afeta o personagem de quem
 * clicou), aqui um clique cria/edita configuração do servidor inteiro — a mensagem
 * do `.atributo config` é pública, então o próprio handler precisa reconferir acesso
 * de admin a cada interação, não só na hora de abrir o comando.
 */
async function requireAdminInteraction(interaction: MenuInteraction, services: CommandServices): Promise<boolean> {
  const isAdmin = await canUseCommandAccess("admin", interaction.member, interaction.client, services.guildConfig);
  if (!isAdmin) {
    await interaction.reply({
      content: "Você precisa ter Administrador ou Gerenciar Servidor para configurar atributos.",
      ephemeral: true
    });
  }
  return isAdmin;
}

export async function handleAttributeMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);

  if (interaction.isModalSubmit()) {
    if (action === "createModal") {
      await handleCreateModalSubmit(interaction, services, parts[0]);
    } else if (action === "chakraValueModal") {
      await handleChakraValueModalSubmit(interaction, services, parts[0]);
    }
    return;
  }

  if (interaction.isChannelSelectMenu()) {
    return;
  }

  switch (action) {
    case "openCreateModal": {
      if (!interaction.isButton()) return;
      const category = isAttributeCategory(parts[0]) ? parts[0] : "fisico";
      await interaction.showModal(buildCreateModal(category));
      return;
    }

    case "openChakraMenu": {
      if (!interaction.isButton()) return;
      const view = await buildChakraRankView(interaction.guild, services);
      await interaction.update(view);
      return;
    }

    case "backToConfig": {
      if (!interaction.isButton()) return;
      const view = await buildAttributeConfigView(interaction.guild, services);
      await interaction.update(view);
      return;
    }

    case "selectRankForChakra": {
      if (!interaction.isStringSelectMenu()) return;
      const rankKey = interaction.values[0];
      if (!rankKey) return;

      const rank = await services.world.findRank(interaction.guild, rankKey);
      if (!rank) {
        await interaction.reply({ content: "Não encontrei mais esse rank.", ephemeral: true });
        return;
      }

      await interaction.showModal(buildChakraValueModal(rank.key, rank.name));
      return;
    }

    default:
      return;
  }
}

async function handleCreateModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  categoryPart: string | undefined
): Promise<void> {
  const key = interaction.fields.getTextInputValue(CREATE_KEY_FIELD).trim();
  const name = interaction.fields.getTextInputValue(CREATE_NAME_FIELD).trim();
  const category = isAttributeCategory(categoryPart) ? categoryPart : "fisico";

  await interaction.deferUpdate();

  try {
    await services.attributes.createAttribute(interaction.guild, interaction.user.id, { key, name, category });
    const view = await buildAttributeConfigView(interaction.guild, services);
    await interaction.editReply(view);
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleChakraValueModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  rankKey: string | undefined
): Promise<void> {
  if (!rankKey) return;

  const raw = interaction.fields.getTextInputValue(CHAKRA_VALUE_FIELD).trim();
  const value = Number.parseInt(raw, 10);

  await interaction.deferUpdate();

  if (Number.isNaN(value) || value < 0) {
    await interaction.followUp({ content: "Valor inválido — informe um número inteiro maior ou igual a 0.", ephemeral: true });
    return;
  }

  try {
    await services.attributes.setChakraRankValue(interaction.guild, interaction.user.id, rankKey, value);
    const view = await buildChakraRankView(interaction.guild, services);
    await interaction.editReply(view);
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleAttributeMenuInteraction });
