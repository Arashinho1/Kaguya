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
import { buildScopeView } from "./scopeMenu.js";
import { BRAND_COLOR } from "./uiConstants.js";

/** Menu de config da meditação (`.meditar config`) — mesmo padrão dos outros menus de
 * admin: um botão abre um modal, submit re-renderiza a mesma view com os valores novos. */

const ID_PREFIX = "meditationmenu";
const RATE_FIELD = "percentual";
const INTERVAL_FIELD = "intervalo";

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
      `Taxa atual: **${config.ratePercent}%** do chakra total por **${INTERVAL_LABEL[config.intervalUnit]}**.\n\n` +
        "Qualquer jogador pode usar `.meditar` a qualquer momento pra recuperar chakra gasto — " +
        "não precisa estar em duelo nem em nenhum lugar específico."
    );

  const editButton = new ButtonBuilder()
    .setCustomId(buildId("openEditModal"))
    .setLabel("✏️ Editar taxa")
    .setStyle(ButtonStyle.Primary);

  const scopeButton = new ButtonBuilder()
    .setCustomId(buildId("openScope"))
    .setLabel("📍 Onde funciona")
    .setStyle(ButtonStyle.Secondary);

  return { embeds: [embed], components: [row(editButton, scopeButton)] };
}

function buildEditModal(config: MeditationConfig): ModalBuilder {
  const rateInput = new TextInputBuilder()
    .setCustomId(RATE_FIELD)
    .setLabel("Percentual do chakra total")
    .setPlaceholder("Ex: 10 (recupera 10% por intervalo)")
    .setStyle(TextInputStyle.Short)
    .setValue(String(config.ratePercent))
    .setMaxLength(10)
    .setRequired(true);

  const intervalInput = new TextInputBuilder()
    .setCustomId(INTERVAL_FIELD)
    .setLabel("Intervalo: minuto ou hora")
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
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(intervalInput)
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
    return;
  }

  if (action === "openScope") {
    const view = await buildScopeView(interaction.guild, services, "meditar", {
      customId: buildId("backToConfig"),
      label: "⬅️ Voltar"
    });
    await interaction.update(view);
    return;
  }

  if (action === "backToConfig") {
    const view = await buildMeditationConfigView(interaction.guild, services);
    await interaction.update(view);
  }
}

async function handleEditModalSubmit(interaction: ModalSubmitInteraction<"cached">, services: CommandServices): Promise<void> {
  const rateRaw = interaction.fields.getTextInputValue(RATE_FIELD).trim().replace(",", ".");
  const intervalRaw = interaction.fields.getTextInputValue(INTERVAL_FIELD);

  await interaction.deferUpdate();

  try {
    const ratePercent = Number.parseFloat(rateRaw);
    if (Number.isNaN(ratePercent) || ratePercent <= 0) {
      throw new DomainError("Percentual inválido — precisa ser um número maior que 0.");
    }

    const intervalUnit = normalizeInterval(intervalRaw);
    if (!intervalUnit) {
      throw new DomainError("Intervalo inválido — digite `minuto` ou `hora`.");
    }

    await services.jutsus.setMeditationConfig(interaction.guild, interaction.user.id, { ratePercent, intervalUnit });

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
