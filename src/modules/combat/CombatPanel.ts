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
  CombatRuleError,
  formatCombatStatusLines,
  formatCombatStatus,
  type CombatEncounterWithRelations
} from "./CombatService.js";
import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:combat";

export async function buildCombatPanel(
  services: CommandServices,
  guild: Guild,
  channelId: string,
  user: User,
  canManage: boolean
) {
  const overview = await services.combat.getOverview(guild, channelId);

  return {
    embeds: [renderCombatEmbed(services, overview.encounter)],
    components: buildCombatComponents(canManage)
  };
}

export async function handleCombatInteraction(
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

  if (!(await services.guildConfig.isModuleEnabled(interaction.guild, "combat"))) {
    await replyPrivately(interaction, "O módulo **Combate** está desativado neste servidor.");
    return true;
  }

  try {
    if (interaction.isButton()) {
      await handleCombatButton(interaction, services);
      return true;
    }

    await handleCombatModal(interaction, services);
    return true;
  } catch (error) {
    if (error instanceof CombatRuleError) {
      await replyPrivately(interaction, error.message);
      return true;
    }

    throw error;
  }
}

function renderCombatEmbed(
  services: CommandServices,
  encounter: CombatEncounterWithRelations | null
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xc05621)
    .setTitle("Painel de combate")
    .setDescription(
      [
        "Resumo opcional da cena e dos participantes.",
        "O fluxo principal usa comandos diretos e ações narrativas com jutsus entre colchetes."
      ].join("\n")
    );

  if (!encounter) {
    embed.addFields({
      name: "Nenhum combate neste canal",
      value: "Use `.combate @jogador` para iniciar um embate direto quando ambos estiverem no mesmo local."
    });
    return embed;
  }

  embed.addFields(
    {
      name: "Cena",
      value: [
        `Nome: **${encounter.name}**`,
        `Status: **${formatCombatStatus(encounter.status)}**`,
        `Rodada: **${encounter.round}**`,
        `Participantes: **${encounter.participants.filter((participant) => participant.isActive).length}**`
      ].join("\n")
    },
    {
      name: "Participantes",
      value: formatParticipants(services, encounter)
    },
    {
      name: "Status",
      value: formatCombatStatusLines(encounter, services.characters).join("\n").slice(0, 1024)
    }
  );

  if (encounter.actionLogs.length > 0) {
    embed.addFields({
      name: "Últimas ações",
      value: encounter.actionLogs
        .map((log) => log.summary ?? log.action)
        .join("\n")
        .slice(0, 1024)
    });
  }

  return embed;
}

function buildCombatComponents(canManage: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:join`)
        .setLabel("Entrar")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:useJutsu`)
        .setLabel("Usar jutsu")
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
          .setCustomId(`${CUSTOM_ID_PREFIX}:create`)
          .setLabel("Criar cena")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:add`)
          .setLabel("Adicionar")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:start`)
          .setLabel("Ativar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:next`)
          .setLabel("Nova rodada")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:end`)
          .setLabel("Encerrar")
          .setStyle(ButtonStyle.Danger)
      )
    );
  }

  return rows;
}

async function handleCombatButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);
  const canManage = await canManageCombat(interaction, services);

  if (action === "refresh") {
    await interaction.update(
      await buildCombatPanel(services, interaction.guild, interaction.channelId, interaction.user, canManage)
    );
    return;
  }

  if (action === "join") {
    await services.combat.joinEncounter(interaction.guild, interaction.channelId, interaction.user);
    await interaction.update(
      await buildCombatPanel(services, interaction.guild, interaction.channelId, interaction.user, canManage)
    );
    return;
  }

  if (action === "useJutsu") {
    await interaction.showModal(buildUseJutsuModal());
    return;
  }

  if (!canManage) {
    await interaction.reply({
      content: "Você precisa ter Administrador, Gerenciar Servidor ou cargo administrativo configurado para controlar o combate.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (action === "create") {
    await interaction.showModal(buildCreateCombatModal());
    return;
  }

  if (action === "add") {
    await interaction.showModal(buildAddParticipantModal());
    return;
  }

  if (action === "start") {
    await services.combat.startEncounter(interaction.guild, interaction.user.id, interaction.channelId);
    await interaction.update(
      await buildCombatPanel(services, interaction.guild, interaction.channelId, interaction.user, canManage)
    );
    return;
  }

  if (action === "next") {
    await services.combat.nextTurn(interaction.guild, interaction.user.id, interaction.channelId);
    await interaction.update(
      await buildCombatPanel(services, interaction.guild, interaction.channelId, interaction.user, canManage)
    );
    return;
  }

  if (action === "end") {
    await services.combat.endEncounter(interaction.guild, interaction.user.id, interaction.channelId);
    await interaction.update(
      await buildCombatPanel(services, interaction.guild, interaction.channelId, interaction.user, canManage)
    );
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleCombatModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channelId = getInteractionChannelId(interaction);

  if (!channelId) {
    await interaction.editReply("Não consegui identificar o canal desse painel.");
    return;
  }

  if (action === "useJutsu") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const result = await services.combat.useJutsuOnTurn(
      interaction.guild,
      interaction.user,
      channelId,
      identifier
    );

    await refreshCombatMessage(interaction, services);
    await interaction.editReply(
      [
        `**${result.character.name}** usou **${result.jutsu.name}** no combate.`,
        `Chakra: **${result.chakraBefore}** -> **${result.chakraAfter}/${result.chakraMax}**.`
      ].join("\n")
    );
    return;
  }

  if (!(await canManageCombat(interaction, services))) {
    await interaction.editReply("Você não tem permissão administrativa para controlar o combate.");
    return;
  }

  if (action === "create") {
    const name = parseRequiredText(interaction.fields.getTextInputValue("name"), "Nome", 80);
    const encounter = await services.combat.createEncounter(
      interaction.guild,
      interaction.user.id,
      channelId,
      name
    );

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Combate criado",
      description: `A cena **${encounter.name}** foi criada em <#${channelId}>.`
    });
    await refreshCombatMessage(interaction, services);
    await interaction.editReply(`Combate **${encounter.name}** criado.`);
    return;
  }

  if (action === "add") {
    const targetUserId = parseUserId(interaction.fields.getTextInputValue("target"));
    const initiative = parseOptionalInteger(interaction.fields.getTextInputValue("initiative"), "Iniciativa") ?? 0;

    if (!targetUserId) {
      await interaction.editReply("Informe uma menção ou ID de usuário válido.");
      return;
    }

    await services.combat.addParticipant(
      interaction.guild,
      interaction.user.id,
      channelId,
      targetUserId,
      initiative
    );
    await refreshCombatMessage(interaction, services);
    await interaction.editReply(`<@${targetUserId}> adicionado ao combate.`);
    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function buildCreateCombatModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:create`)
    .setTitle("Criar combate")
    .addComponents(
      textInputRow("name", "Nome da cena", "Treino no campo de Konoha", TextInputStyle.Short, true)
    );
}

function buildAddParticipantModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:add`)
    .setTitle("Adicionar participante")
    .addComponents(
      textInputRow("target", "Jogador", "@jogador ou ID", TextInputStyle.Short, true),
      textInputRow("initiative", "Iniciativa", "0", TextInputStyle.Short, false)
    );
}

function buildUseJutsuModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:useJutsu`)
    .setTitle("Usar jutsu no turno")
    .addComponents(
      textInputRow("identifier", "Jutsu aprendido", "chidori ou Chidori", TextInputStyle.Short, true)
    );
}

function textInputRow(
  customId: string,
  label: string,
  placeholder: string,
  style: TextInputStyle,
  required: boolean
): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setPlaceholder(placeholder)
      .setStyle(style)
      .setRequired(required)
  );
}

function formatParticipants(
  services: CommandServices,
  encounter: CombatEncounterWithRelations
): string {
  const activeParticipants = encounter.participants.filter((participant) => participant.isActive);

  if (activeParticipants.length === 0) {
    return "Nenhum participante ativo. Jogadores podem usar **Entrar** enquanto a cena estiver aberta.";
  }

  return activeParticipants
    .map((participant, index) => {
      const attributes = services.characters.getAttributeValues(participant.character);
      const maxChakra = attributes.chakra ?? 0;
      const currentChakra = participant.character.progress?.currentChakra ?? maxChakra;

      return [
        `${index + 1}. **${participant.character.name}** <@${participant.userId}>`,
        `Chakra: **${currentChakra}/${maxChakra}**`
      ].join("\n");
    })
    .join("\n\n")
    .slice(0, 1024);
}

async function canManageCombat(
  interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function refreshCombatMessage(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  if (!interaction.message) {
    return;
  }

  const canManage = await canManageCombat(interaction, services);
  const channelId = getInteractionChannelId(interaction);

  if (!channelId) {
    return;
  }

  await interaction.message
    .edit(await buildCombatPanel(services, interaction.guild, channelId, interaction.user, canManage))
    .catch(() => undefined);
}

function parseRequiredText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new CombatRuleError([`Preencha o campo **${label}**.`]);
  }

  if (trimmed.length > maxLength) {
    throw new CombatRuleError([`O campo **${label}** precisa ter no máximo ${maxLength} caracteres.`]);
  }

  return trimmed;
}

function parseOptionalInteger(value: string, label: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^-?\d+$/.test(trimmed)) {
    throw new CombatRuleError([`O campo **${label}** precisa ser um número inteiro.`]);
  }

  return Number(trimmed);
}

function parseUserId(value: string): string | null {
  const userId = value.replace(/\D/g, "");
  return /^\d{15,25}$/.test(userId) ? userId : null;
}

function getInteractionChannelId(interaction: ModalSubmitInteraction<"cached">): string | null {
  return interaction.channelId ?? interaction.message?.channelId ?? null;
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
