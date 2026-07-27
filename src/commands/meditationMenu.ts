import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
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
import type { MeditationConfig, MeditationIntervalUnit } from "../modules/jutsus/JutsuService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR } from "./uiConstants.js";

/** Menu de config da meditação (`.meditar config`) — mesmo padrão dos outros menus de
 * admin: um botão abre um modal, submit re-renderiza a mesma view com os valores novos. */

const ID_PREFIX = "meditationmenu";
const RATE_FIELD = "percentual";
const INTERVAL_AMOUNT_FIELD = "quantidade";
const INTERVAL_UNIT_FIELD = "intervalo";

const INTERVAL_LABEL: Record<MeditationIntervalUnit, string> = { minute: "minuto", hour: "hora" };

export interface MeditationMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function buildId(action: string): string {
  return buildCustomId(ID_PREFIX, action);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

export async function buildMeditationConfigView(guild: Guild, services: CommandServices): Promise<MeditationMenuView> {
  const config = await services.jutsus.getMeditationConfig(guild);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🧘 Configuração de Meditação")
    .setDescription(
      `Taxa atual: **${config.ratePercent}%** do chakra total a cada **${config.intervalAmount} ${pluralizeInterval(config.intervalAmount, config.intervalUnit)}**.\n\n` +
        "Qualquer jogador pode usar `.meditar` a qualquer momento pra recuperar chakra gasto. " +
        "Pra restringir onde funciona, use `.setar`."
    );

  const editButton = new ButtonBuilder()
    .setCustomId(buildId("openEditModal"))
    .setLabel("✏️ Editar taxa")
    .setStyle(ButtonStyle.Primary);

  return { embeds: [embed], components: [row(editButton)] };
}

function pluralizeInterval(amount: number, unit: MeditationIntervalUnit): string {
  const singular = INTERVAL_LABEL[unit];
  return amount === 1 ? singular : `${singular}s`;
}

function buildEditModal(config: MeditationConfig): ModalBuilder {
  const rateInput = new TextInputBuilder()
    .setCustomId(RATE_FIELD)
    .setLabel("Percentual do chakra total")
    .setPlaceholder("Ex: 2 (recupera 2% a cada intervalo)")
    .setStyle(TextInputStyle.Short)
    .setValue(String(config.ratePercent))
    .setMaxLength(10)
    .setRequired(true);

  const intervalAmountInput = new TextInputBuilder()
    .setCustomId(INTERVAL_AMOUNT_FIELD)
    .setLabel("A cada quantas unidades")
    .setPlaceholder("Ex: 5 (junto com minuto/hora abaixo = a cada 5 minutos)")
    .setStyle(TextInputStyle.Short)
    .setValue(String(config.intervalAmount))
    .setMaxLength(10)
    .setRequired(true);

  const intervalUnitInput = new TextInputBuilder()
    .setCustomId(INTERVAL_UNIT_FIELD)
    .setLabel("Unidade: minuto ou hora")
    .setPlaceholder("minuto ou hora")
    .setStyle(TextInputStyle.Short)
    .setValue(INTERVAL_LABEL[config.intervalUnit])
    .setMaxLength(10)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("editModal"))
    .setTitle("Taxa de recuperação de chakra")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(rateInput),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(intervalAmountInput),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(intervalUnitInput)
    );
}

function normalizeInterval(value: string): MeditationIntervalUnit | null {
  const normalized = value.trim().toLowerCase();
  if (["minuto", "minutos", "min", "m"].includes(normalized)) return "minute";
  if (["hora", "horas", "h"].includes(normalized)) return "hour";
  return null;
}

/** Mensagem de config é pública — o handler reconfere acesso de admin a cada interação. */
async function requireAdminInteraction(interaction: MenuInteraction, services: CommandServices): Promise<boolean> {
  const isAdmin = await canUseCommandAccess("admin", interaction.member, interaction.client, services.guildConfig);
  if (!isAdmin) {
    await interaction.reply({
      content: "Você precisa ter Administrador ou Gerenciar Servidor para configurar a meditação.",
      ephemeral: true
    });
  }
  return isAdmin;
}

export async function handleMeditationMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  const { action } = parseCustomId(interaction.customId);

  if (interaction.isModalSubmit()) {
    if (action === "editModal") {
      await handleEditModalSubmit(interaction, services);
    }
    return;
  }

  if (!interaction.isButton()) {
    return;
  }

  if (action === "openEditModal") {
    const config = await services.jutsus.getMeditationConfig(interaction.guild);
    await interaction.showModal(buildEditModal(config));
  }
}

async function handleEditModalSubmit(interaction: ModalSubmitInteraction<"cached">, services: CommandServices): Promise<void> {
  const rateRaw = interaction.fields.getTextInputValue(RATE_FIELD).trim().replace(",", ".");
  const intervalAmountRaw = interaction.fields.getTextInputValue(INTERVAL_AMOUNT_FIELD).trim().replace(",", ".");
  const intervalUnitRaw = interaction.fields.getTextInputValue(INTERVAL_UNIT_FIELD);

  await interaction.deferUpdate();

  try {
    const ratePercent = Number.parseFloat(rateRaw);
    if (Number.isNaN(ratePercent) || ratePercent <= 0) {
      throw new DomainError("Percentual inválido — precisa ser um número maior que 0.");
    }

    const intervalAmount = Number.parseFloat(intervalAmountRaw);
    if (Number.isNaN(intervalAmount) || intervalAmount <= 0) {
      throw new DomainError("Quantidade do intervalo inválida — precisa ser um número maior que 0.");
    }

    const intervalUnit = normalizeInterval(intervalUnitRaw);
    if (!intervalUnit) {
      throw new DomainError("Unidade inválida — digite `minuto` ou `hora`.");
    }

    await services.jutsus.setMeditationConfig(interaction.guild, interaction.user.id, {
      ratePercent,
      intervalAmount,
      intervalUnit
    });

    const view = await buildMeditationConfigView(interaction.guild, services);
    await interaction.editReply(view);
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleMeditationMenuInteraction });
