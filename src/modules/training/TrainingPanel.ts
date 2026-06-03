import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type ModalSubmitInteraction,
  type User
} from "discord.js";

import {
  TrainingRuleError,
  formatTrainingConfig,
  type TrainingConfig
} from "./TrainingService.js";
import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:training";

export async function buildTrainingPanel(
  services: CommandServices,
  guild: Guild,
  user: User,
  canManage: boolean
) {
  return {
    embeds: [await buildTrainingEmbed(services, guild, user)],
    components: buildTrainingComponents(canManage)
  };
}

export async function handleTrainingInteraction(
  interaction: Interaction,
  services: CommandServices
): Promise<boolean> {
  if (!interaction.isButton() && !interaction.isModalSubmit()) {
    return false;
  }

  if (!interaction.customId.startsWith(CUSTOM_ID_PREFIX)) {
    return false;
  }

  if (!interaction.inCachedGuild()) {
    await replyPrivately(interaction, "Esse painel só pode ser usado dentro de um servidor.");
    return true;
  }

  if (!(await services.guildConfig.isModuleEnabled(interaction.guild, "training"))) {
    await replyPrivately(interaction, "O módulo **Treino** está desativado neste servidor.");
    return true;
  }

  try {
    if (interaction.isButton()) {
      await handleTrainingButton(interaction, services);
      return true;
    }

    await handleTrainingModal(interaction, services);
    return true;
  } catch (error) {
    if (error instanceof TrainingRuleError) {
      await replyPrivately(interaction, error.message);
      return true;
    }

    throw error;
  }
}

async function buildTrainingEmbed(
  services: CommandServices,
  guild: Guild,
  user: User
): Promise<EmbedBuilder> {
  const overview = await services.training.getOverview(guild, user.id);
  const attributes = await services.attributes.listAttributes(guild);
  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle("Painel de treino")
    .setDescription(
      [
        "Evolução de atributos da ficha ativa.",
        "A staff concede pontos; jogadores gastam pontos conforme a regra de custo deste servidor."
      ].join("\n")
    );

  if (!overview.character || !overview.progress) {
    embed.addFields(
      {
        name: "Ficha",
        value: "Você ainda não tem uma ficha ativa para treinar."
      },
      {
        name: "Regra de custo",
        value: formatTrainingConfig(overview.config)
      }
    );
    return embed;
  }

  const chakra = overview.effectiveAttributes.chakra;
  const attributeLines = attributes
    .filter((attribute) => attribute.key !== "chakra")
    .map((attribute) => {
      const base = overview.baseAttributes[attribute.key] ?? attribute.baseValue;
      const effective = overview.effectiveAttributes[attribute.key] ?? base;
      const effectiveText = effective === base ? "" : ` | efetivo **${effective}**`;

      return `**${attribute.name}** \`${attribute.key}\`: base **${base}**${effectiveText}`;
    });

  embed.addFields(
    {
      name: "Ficha",
      value: [
        `Personagem: **${overview.character.name}**`,
        `Dono: <@${overview.character.userId}>`,
        `Pontos de treino: **${overview.progress.trainingPoints}**`,
        chakra === undefined ? null : `Chakra derivado: **${chakra}**`
      ].filter((line): line is string => Boolean(line)).join("\n")
    },
    {
      name: "Atributos treináveis",
      value:
        attributeLines.length > 0
          ? truncate(attributeLines.join("\n"), 1024)
          : "Nenhum atributo ativo configurado para treino."
    },
    {
      name: "Regra de custo",
      value: formatTrainingConfig(overview.config)
    }
  );

  return embed;
}

function buildTrainingComponents(canManage: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:train`)
        .setLabel("Evoluir atributo")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:refresh`)
        .setLabel("Atualizar")
        .setStyle(ButtonStyle.Secondary)
    )
  ];

  if (canManage) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:grant`)
          .setLabel("Conceder pontos")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:config`)
          .setLabel("Configurar custo")
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return rows;
}

async function handleTrainingButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);
  const canManage = await canManageTraining(interaction, services);

  if (action === "refresh") {
    await interaction.update(
      await buildTrainingPanel(services, interaction.guild, interaction.user, canManage)
    );
    return;
  }

  if (action === "train") {
    await interaction.showModal(buildTrainAttributeModal());
    return;
  }

  if (!canManage) {
    await interaction.reply({
      content: "Você precisa ter Administrador, Gerenciar Servidor ou cargo administrativo configurado para editar treinos.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (action === "grant") {
    await interaction.showModal(buildGrantPointsModal());
    return;
  }

  if (action === "config") {
    const config = await services.training.getTrainingConfig(interaction.guild);
    await interaction.showModal(buildTrainingConfigModal(config));
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleTrainingModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "train") {
    const attribute = parseRequiredText(interaction.fields.getTextInputValue("attribute"), "Atributo", 60);
    const amount = parseInteger(interaction.fields.getTextInputValue("amount"), "Evolução", { min: 1 });
    const result = await services.training.trainAttribute(interaction.guild, interaction.user.id, attribute, amount);

    await refreshTrainingMessage(interaction, services);
    await interaction.editReply(
      `**${result.attribute.name}** evoluiu de **${result.beforeValue}** para **${result.afterValue}**. Custo: **${result.cost}** ponto(s).`
    );
    return;
  }

  if (!(await canManageTraining(interaction, services))) {
    await interaction.editReply("Você não tem permissão administrativa para editar treinos.");
    return;
  }

  if (action === "grant") {
    const targetUserId = parseUserId(interaction.fields.getTextInputValue("target"));
    const amount = parseInteger(interaction.fields.getTextInputValue("amount"), "Pontos", {});
    const reason = parseOptionalText(interaction.fields.getTextInputValue("reason"), 200);

    if (!targetUserId) {
      await interaction.editReply("Informe uma menção ou ID de usuário válido.");
      return;
    }

    const result = await services.training.grantTrainingPoints(
      interaction.guild,
      interaction.user.id,
      targetUserId,
      amount,
      reason
    );

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Pontos de treino ajustados",
      description: [
        `Ficha: **${result.character.name}** (<@${targetUserId}>)`,
        `Alteração: **${amount > 0 ? "+" : ""}${amount}** ponto(s)`,
        `Saldo atual: **${result.progress.trainingPoints}**`,
        reason ? `Motivo: ${reason}` : null
      ].filter((line): line is string => Boolean(line)).join("\n")
    });
    await refreshTrainingMessage(interaction, services);
    await interaction.editReply(
      `Pontos de treino de **${result.character.name}** ajustados para **${result.progress.trainingPoints}**.`
    );
    return;
  }

  if (action === "config") {
    const config = await services.training.setTrainingConfig(interaction.guild, interaction.user.id, {
      baseCost: parseDecimal(interaction.fields.getTextInputValue("baseCost"), "Custo base", { min: 0 }),
      costPerCurrentValue: parseDecimal(
        interaction.fields.getTextInputValue("costPerCurrentValue"),
        "Custo por valor atual",
        { min: 0 }
      ),
      maxIncreasePerAction: parseInteger(
        interaction.fields.getTextInputValue("maxIncreasePerAction"),
        "Máximo por treino",
        { min: 1 }
      )
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Custo de treino configurado",
      description: formatTrainingConfig(config)
    });
    await refreshTrainingMessage(interaction, services);
    await interaction.editReply("Configuração de treino atualizada.");
    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function buildTrainAttributeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:train`)
    .setTitle("Evoluir atributo")
    .addComponents(
      textInputRow("attribute", "Atributo", "forca, velocidade, ninjutsu...", TextInputStyle.Short, true),
      textInputRow("amount", "Evoluir quantos pontos", "1", TextInputStyle.Short, true)
    );
}

function buildGrantPointsModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:grant`)
    .setTitle("Conceder pontos de treino")
    .addComponents(
      textInputRow("target", "Jogador", "@jogador ou ID", TextInputStyle.Short, true),
      textInputRow("amount", "Pontos", "5 ou -5 para remover", TextInputStyle.Short, true),
      textInputRow("reason", "Motivo", "Recompensa de missão", TextInputStyle.Paragraph, false)
    );
}

function buildTrainingConfigModal(config: TrainingConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:config`)
    .setTitle("Configurar custo de treino")
    .addComponents(
      textInputRow("baseCost", "Custo base", "1", TextInputStyle.Short, true, String(config.baseCost)),
      textInputRow(
        "costPerCurrentValue",
        "Custo por valor atual",
        "0",
        TextInputStyle.Short,
        true,
        String(config.costPerCurrentValue)
      ),
      textInputRow(
        "maxIncreasePerAction",
        "Máximo por treino",
        "5",
        TextInputStyle.Short,
        true,
        String(config.maxIncreasePerAction)
      )
    );
}

function textInputRow(
  customId: string,
  label: string,
  placeholder: string,
  style: TextInputStyle,
  required: boolean,
  value?: string
): ActionRowBuilder<TextInputBuilder> {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setPlaceholder(placeholder)
    .setStyle(style)
    .setRequired(required);

  if (value) {
    input.setValue(value);
  }

  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

async function canManageTraining(
  interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function refreshTrainingMessage(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  if (!interaction.message) {
    return;
  }

  const canManage = await canManageTraining(interaction, services);

  await interaction.message
    .edit(await buildTrainingPanel(services, interaction.guild, interaction.user, canManage))
    .catch(() => undefined);
}

function parseRequiredText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new TrainingRuleError([`Preencha o campo **${label}**.`]);
  }

  if (trimmed.length > maxLength) {
    throw new TrainingRuleError([`O campo **${label}** precisa ter no máximo ${maxLength} caracteres.`]);
  }

  return trimmed;
}

function parseOptionalText(value: string, maxLength: number): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new TrainingRuleError([`Um campo de texto passou de ${maxLength} caracteres.`]);
  }

  return trimmed;
}

function parseInteger(
  value: string,
  label: string,
  options: { min?: number } = {}
): number {
  const trimmed = value.trim();

  if (!/^-?\d+$/.test(trimmed)) {
    throw new TrainingRuleError([`O campo **${label}** precisa ser um número inteiro.`]);
  }

  const parsed = Number(trimmed);

  if (options.min !== undefined && parsed < options.min) {
    throw new TrainingRuleError([`O campo **${label}** precisa ser maior ou igual a ${options.min}.`]);
  }

  return parsed;
}

function parseDecimal(
  value: string,
  label: string,
  options: { min?: number } = {}
): number {
  const trimmed = value.trim().replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new TrainingRuleError([`O campo **${label}** precisa ser um número.`]);
  }

  const parsed = Number(trimmed);

  if (options.min !== undefined && parsed < options.min) {
    throw new TrainingRuleError([`O campo **${label}** precisa ser maior ou igual a ${options.min}.`]);
  }

  return parsed;
}

function parseUserId(value: string): string | null {
  const userId = value.replace(/\D/g, "");
  return /^\d{15,25}$/.test(userId) ? userId : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

async function replyPrivately(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  content: string
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
