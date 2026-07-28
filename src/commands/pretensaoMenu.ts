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
import { PretensaoRuleError, type PretensaoConfig, type PretensaoOverride } from "../modules/vagas/PretensaoService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR } from "./uiConstants.js";

/** Menu de config da pretensão (`.pretensao config`) — mesmo padrão dos outros menus de
 * admin: botão abre modal/select, submit re-renderiza a mesma view com os valores novos. */

const ID_PREFIX = "pretensaomenu";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const OVERRIDE_LABEL: Record<PretensaoOverride, string> = { auto: "🔄 Automático (segue horário)", open: "🟢 Forçada aberta", closed: "🔴 Forçada fechada" };

export interface PretensaoMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

function formatMinutes(minute: number): string {
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDays(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 0) return "Todos os dias";
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

export async function buildPretensaoConfigView(guild: Guild, services: CommandServices): Promise<PretensaoMenuView> {
  const config = await services.pretensao.getConfig(guild);
  const isOpenNow = services.pretensao.isOpen(config);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎫 Configuração de Pretensão")
    .setDescription(
      "Quem mandar o ID de uma vaga habilitada pra pretensão no canal configurado, dentro da janela " +
        "aberta, recebe a vaga automaticamente (se tiver ficha e bater a restrição de vila)."
    )
    .addFields(
      { name: "Canal", value: config.channelId ? `<#${config.channelId}>` : "Não configurado — use `.pretensao set <canal>`." },
      { name: "Dias", value: formatDays(config.daysOfWeek), inline: true },
      { name: "Horário", value: `${formatMinutes(config.startMinute)} (${config.durationMinutes}min)`, inline: true },
      { name: "Fuso", value: `UTC${config.utcOffsetHours >= 0 ? "+" : ""}${config.utcOffsetHours}`, inline: true },
      { name: "Status manual", value: OVERRIDE_LABEL[config.override] },
      { name: "Está aberta agora?", value: isOpenNow ? "🟢 Sim" : "🔴 Não" }
    );

  const components = [
    row(
      button("openDaysPick", "📅 Dias da semana", ButtonStyle.Secondary),
      button("openScheduleModal", "⏰ Horário e duração", ButtonStyle.Secondary)
    ),
    row(
      overrideButton("auto", "🔄 Automático", ButtonStyle.Secondary),
      overrideButton("open", "🟢 Forçar aberta", ButtonStyle.Success),
      overrideButton("closed", "🔴 Forçar fechada", ButtonStyle.Danger)
    )
  ];

  return { embeds: [embed], components };
}

function button(action: string, label: string, style: ButtonStyle): ButtonBuilder {
  return new ButtonBuilder().setCustomId(buildId(action)).setLabel(label).setStyle(style);
}

function overrideButton(value: PretensaoOverride, label: string, style: ButtonStyle): ButtonBuilder {
  return new ButtonBuilder().setCustomId(buildId("setOverride", value)).setLabel(label).setStyle(style);
}

function buildDaysPickView(config: PretensaoConfig): PretensaoMenuView {
  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("pickDays"))
    .setPlaceholder("Escolher dias (vazio = todos os dias)...")
    .setMinValues(0)
    .setMaxValues(7)
    .addOptions(
      DAY_LABELS.map((label, index) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(String(index))
          .setDefault(config.daysOfWeek.includes(index))
      )
    );

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("📅 Dias da pretensão")
    .setDescription("Nenhum dia marcado = todos os dias da semana.");

  return { embeds: [embed], components: [row(select), row(button("backToConfig", "⬅️ Voltar", ButtonStyle.Secondary))] };
}

function buildScheduleModal(config: PretensaoConfig): ModalBuilder {
  const horario = new TextInputBuilder()
    .setCustomId("horario")
    .setLabel("Horário de início (HH:MM)")
    .setStyle(TextInputStyle.Short)
    .setValue(formatMinutes(config.startMinute))
    .setMaxLength(5)
    .setRequired(true);

  const duracao = new TextInputBuilder()
    .setCustomId("duracao")
    .setLabel("Duração em minutos")
    .setStyle(TextInputStyle.Short)
    .setValue(String(config.durationMinutes))
    .setMaxLength(6)
    .setRequired(true);

  const fuso = new TextInputBuilder()
    .setCustomId("fuso")
    .setLabel("Fuso horário (UTC, ex: -3)")
    .setStyle(TextInputStyle.Short)
    .setValue(String(config.utcOffsetHours))
    .setMaxLength(4)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(buildId("scheduleModal"))
    .setTitle("Horário da pretensão")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(horario),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(duracao),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(fuso)
    );
}

function parseTimeToMinutes(value: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    throw new PretensaoRuleError("Horário inválido — use o formato HH:MM (ex: 20:00).");
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Mensagem de config é pública — o handler reconfere acesso de admin a cada interação. */
async function requireAdminInteraction(interaction: MenuInteraction, services: CommandServices): Promise<boolean> {
  const isAdmin = await canUseCommandAccess("admin", interaction.member, interaction.client, services.guildConfig);
  if (!isAdmin) {
    await interaction.reply({
      content: "Você precisa ter Administrador ou Gerenciar Servidor para configurar a pretensão.",
      ephemeral: true
    });
  }
  return isAdmin;
}

export async function handlePretensaoMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  if (interaction.isChannelSelectMenu()) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);

  if (interaction.isModalSubmit()) {
    if (action === "scheduleModal") {
      await handleScheduleModalSubmit(interaction, services);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (action === "pickDays") {
      await interaction.deferUpdate();
      const days = interaction.values.map(Number);
      const config = await services.pretensao.getConfig(interaction.guild);
      await services.pretensao.setSchedule(interaction.guild, interaction.user.id, {
        daysOfWeek: days,
        startMinute: config.startMinute,
        durationMinutes: config.durationMinutes,
        utcOffsetHours: config.utcOffsetHours
      });
      await interaction.editReply(await buildPretensaoConfigView(interaction.guild, services));
    }
    return;
  }

  if (!interaction.isButton()) return;

  if (action === "openDaysPick") {
    const config = await services.pretensao.getConfig(interaction.guild);
    await interaction.update(buildDaysPickView(config));
    return;
  }

  if (action === "backToConfig") {
    await interaction.update(await buildPretensaoConfigView(interaction.guild, services));
    return;
  }

  if (action === "openScheduleModal") {
    const config = await services.pretensao.getConfig(interaction.guild);
    await interaction.showModal(buildScheduleModal(config));
    return;
  }

  if (action === "setOverride") {
    const override = parts[0] as PretensaoOverride | undefined;
    if (!override) return;
    await interaction.deferUpdate();
    await services.pretensao.setOverride(interaction.guild, interaction.user.id, override);
    await interaction.editReply(await buildPretensaoConfigView(interaction.guild, services));
  }
}

async function handleScheduleModalSubmit(interaction: ModalSubmitInteraction<"cached">, services: CommandServices): Promise<void> {
  const horarioRaw = interaction.fields.getTextInputValue("horario").trim();
  const duracaoRaw = interaction.fields.getTextInputValue("duracao").trim();
  const fusoRaw = interaction.fields.getTextInputValue("fuso").trim();

  await interaction.deferUpdate();

  try {
    const startMinute = parseTimeToMinutes(horarioRaw);

    const durationMinutes = Number.parseInt(duracaoRaw, 10);
    if (Number.isNaN(durationMinutes)) {
      throw new PretensaoRuleError("Duração inválida — precisa ser um número de minutos.");
    }

    const utcOffsetHours = Number.parseInt(fusoRaw, 10);
    if (Number.isNaN(utcOffsetHours)) {
      throw new PretensaoRuleError("Fuso horário inválido — precisa ser um número (ex: -3).");
    }

    const config = await services.pretensao.getConfig(interaction.guild);
    await services.pretensao.setSchedule(interaction.guild, interaction.user.id, {
      daysOfWeek: config.daysOfWeek,
      startMinute,
      durationMinutes,
      utcOffsetHours
    });

    await interaction.editReply(await buildPretensaoConfigView(interaction.guild, services));
  } catch (error) {
    if (error instanceof DomainError) {
      await interaction.followUp({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handlePretensaoMenuInteraction });
