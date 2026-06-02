import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type User
} from "discord.js";

import { ADMIN_COMMAND_PERMISSION } from "../guild-config/GuildConfigService.js";
import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:config";
const CONFIG_SELECT_ID = `${CUSTOM_ID_PREFIX}:select`;
const PERMISSION_BUTTON_PREFIX = `${CUSTOM_ID_PREFIX}:permission`;

type ConfigPage = "overview" | "prefix" | "adminLogs" | "commandLogs" | "permissions";

export async function buildConfigPanel(
  services: CommandServices,
  guild: Guild,
  prefix: string,
  page: ConfigPage = "overview"
) {
  return {
    embeds: [await buildConfigEmbed(services, guild, prefix, page)],
    components: buildConfigComponents(page)
  };
}

export async function handleConfigInteraction(
  interaction: Interaction,
  services: CommandServices
): Promise<boolean> {
  if (!interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isButton()) {
    return false;
  }

  if (!interaction.customId.startsWith(CUSTOM_ID_PREFIX)) {
    return false;
  }

  if (!interaction.inCachedGuild()) {
    await replyPrivately(interaction, "Esse painel só pode ser usado dentro de um servidor.");
    return true;
  }

  if (!(await canUseConfigPanel(interaction, services))) {
    await replyPrivately(interaction, "Você precisa ter Administrador ou Gerenciar Servidor para usar esse painel.");
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    const action = parsePage(interaction.values[0] ?? "overview");

    if (action === "prefix") {
      const currentPrefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
      await resetConfigMenu(interaction, services);
      await interaction.showModal(buildPrefixModal(currentPrefix));
      return true;
    }

    if (action === "adminLogs") {
      const logChannelId = await services.guildConfig.getLogChannelId(interaction.guild).catch(() => null);
      await resetConfigMenu(interaction, services);
      await interaction.showModal(
        buildLogChannelModal("adminLogs", "Configurar log administrativo", logChannelId)
      );
      return true;
    }

    if (action === "commandLogs") {
      const logChannelId = await services.guildConfig.getCommandLogChannelId(interaction.guild).catch(() => null);
      await resetConfigMenu(interaction, services);
      await interaction.showModal(
        buildLogChannelModal("commandLogs", "Configurar log de comandos", logChannelId)
      );
      return true;
    }

    if (action === "permissions") {
      const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
      await interaction.update(await buildConfigPanel(services, interaction.guild, prefix, "permissions"));
      return true;
    }

    const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
    await interaction.update(await buildConfigPanel(services, interaction.guild, prefix, "overview"));
    return true;
  }

  if (interaction.isButton()) {
    await handleConfigButton(interaction, services);
    return true;
  }

  await handleConfigModal(interaction, services);
  return true;
}

function normalizePrefix(prefix: string): string | null {
  const trimmed = prefix.trim();

  if (trimmed.length === 0 || trimmed.length > 5 || trimmed.includes(" ")) {
    return null;
  }

  return trimmed;
}

async function buildConfigEmbed(
  services: CommandServices,
  guild: Guild,
  prefix: string,
  page: ConfigPage
): Promise<EmbedBuilder> {
  const overview = await services.guildConfig.getGuildOverview(guild);
  const [adminLogChannelId, commandLogChannelId] = await Promise.all([
    services.guildConfig.getLogChannelId(guild).catch(() => null),
    services.guildConfig.getCommandLogChannelId(guild).catch(() => null)
  ]);

  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle("Painel de configuração")
    .setDescription(
      [
        "Configurações técnicas do RPG neste servidor.",
        "Tudo aqui é salvo por servidor e pode ser ajustado sem mexer no código.",
        "",
        `Prefixo atual: \`${overview.prefix}\``,
        `Log administrativo: ${adminLogChannelId ? `<#${adminLogChannelId}>` : "não configurado"}`,
        `Log de comandos: ${commandLogChannelId ? `<#${commandLogChannelId}>` : "não configurado"}`
      ].join("\n")
    )
    .addFields(
      { name: "Configurações", value: String(overview.settingsCount), inline: true },
      { name: "Atributos", value: String(overview.attributesCount), inline: true },
      { name: "Ranks", value: String(overview.ranksCount), inline: true },
      { name: "Tipos de jutsu", value: String(overview.jutsuTypesCount), inline: true }
    );

  if (page === "prefix") {
    embed.addFields({
      name: "Prefixo",
      value: "Use a opção `Alterar prefixo` na lista suspensa. O prefixo precisa ter 1 a 5 caracteres, sem espaços."
    });
  } else if (page === "adminLogs") {
    embed.addFields({
      name: "Log administrativo",
      value: "Registra configurações do bot neste servidor, como prefixo, canais de log e futuras regras administrativas."
    });
  } else if (page === "commandLogs") {
    embed.addFields({
      name: "Log de comandos",
      value: "Registra comandos executados no servidor, com usuário, canal, servidor, comando e horário."
    });
  } else if (page === "permissions") {
    const adminRoleIds = await services.guildConfig.listRolePermissions(guild, ADMIN_COMMAND_PERMISSION);

    embed.addFields({
      name: "Permissões administrativas",
      value:
        adminRoleIds.length > 0
          ? adminRoleIds.map((roleId) => `<@&${roleId}>`).join("\n")
          : "Nenhum cargo configurado. Administrador e Gerenciar Servidor continuam liberados por padrão."
    });
  } else {
    embed.addFields({
      name: "Ações disponíveis",
      value: [
        "Use a lista suspensa para alterar prefixo, logs ou permissões.",
        `Atalhos ainda funcionam: \`${prefix}config prefix .\`, \`${prefix}config log #canal\` e \`${prefix}config log-comandos #canal\`.`
      ].join("\n")
    });
  }

  return embed;
}

function buildConfigComponents(page: ConfigPage) {
  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [buildConfigSelect()];

  if (page === "permissions") {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${PERMISSION_BUTTON_PREFIX}:add`)
          .setLabel("Adicionar cargo")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${PERMISSION_BUTTON_PREFIX}:remove`)
          .setLabel("Remover cargo")
          .setStyle(ButtonStyle.Danger)
      )
    );
  }

  return components;
}

async function canUseConfigPanel(
  interaction:
    | StringSelectMenuInteraction<"cached">
    | ModalSubmitInteraction<"cached">
    | ButtonInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function resetConfigMenu(
  interaction: StringSelectMenuInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");

  await interaction.message
    .edit(await buildConfigPanel(services, interaction.guild, prefix, "overview"))
    .catch(() => undefined);
}

function buildConfigSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CONFIG_SELECT_ID}:${Date.now().toString(36)}`)
      .setPlaceholder("Escolha uma configuração")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Visão geral")
          .setDescription("Resumo técnico do servidor no bot.")
          .setValue("overview"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Alterar prefixo")
          .setDescription("Muda o prefixo usado pelos comandos.")
          .setValue("prefix"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Log administrativo")
          .setDescription("Define onde configurações do bot serão registradas.")
          .setValue("adminLogs"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Log de comandos")
          .setDescription("Define onde comandos executados serão registrados.")
          .setValue("commandLogs"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Permissões")
          .setDescription("Define cargos que podem usar comandos administrativos.")
          .setValue("permissions")
      )
  );
}

function buildPrefixModal(currentPrefix: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:prefix`)
    .setTitle("Alterar prefixo")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("prefix")
          .setLabel("Novo prefixo")
          .setPlaceholder(".")
          .setValue(currentPrefix)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

function buildLogChannelModal(
  action: "adminLogs" | "commandLogs",
  title: string,
  currentChannelId: string | null
): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("channel")
    .setLabel("Canal")
    .setPlaceholder("#logs ou ID do canal")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  if (currentChannelId) {
    input.setValue(currentChannelId);
  }

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:${action}`)
    .setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

function buildRolePermissionModal(action: "add" | "remove"): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:permission:${action}`)
    .setTitle(action === "add" ? "Adicionar cargo admin" : "Remover cargo admin")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("role")
          .setLabel("Cargo")
          .setPlaceholder("@Cargo ou ID do cargo")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

async function handleConfigButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${PERMISSION_BUTTON_PREFIX}:`.length);

  if (action === "add" || action === "remove") {
    await interaction.showModal(buildRolePermissionModal(action));
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleConfigModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "prefix") {
    const currentPrefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
    const nextPrefix = normalizePrefix(interaction.fields.getTextInputValue("prefix"));

    if (!nextPrefix) {
      await interaction.editReply("Informe um prefixo com 1 a 5 caracteres, sem espaços.");
      return;
    }

    await services.guildConfig.setPrefix(interaction.guild, interaction.user.id, nextPrefix);
    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Prefixo atualizado",
      description: `O prefixo do servidor foi alterado de \`${currentPrefix}\` para \`${nextPrefix}\`.`
    });
    await interaction.editReply(`Prefixo atualizado para \`${nextPrefix}\`.`);
    return;
  }

  if (action === "permission:add" || action === "permission:remove") {
    const roleId = parseRoleId(interaction.fields.getTextInputValue("role"));

    if (!roleId) {
      await interaction.editReply("Informe uma menção ou ID de cargo válido.");
      return;
    }

    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);

    if (!role) {
      await interaction.editReply("Não encontrei esse cargo no servidor.");
      return;
    }

    if (action === "permission:add") {
      await services.guildConfig.grantRolePermission(
        interaction.guild,
        interaction.user.id,
        role.id,
        ADMIN_COMMAND_PERMISSION
      );
      await sendConfigLog(interaction.guild, interaction.user, services, {
        title: "Permissão administrativa concedida",
        description: `O cargo ${role} agora pode usar comandos administrativos.`
      });
      await interaction.editReply(`Cargo ${role} liberado para comandos administrativos.`);
      return;
    }

    const removed = await services.guildConfig.revokeRolePermission(
      interaction.guild,
      interaction.user.id,
      role.id,
      ADMIN_COMMAND_PERMISSION
    );

    if (!removed) {
      await interaction.editReply(`O cargo ${role} não estava configurado como administrador do bot.`);
      return;
    }

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Permissão administrativa removida",
      description: `O cargo ${role} não pode mais usar comandos administrativos pelo bot.`
    });
    await interaction.editReply(`Cargo ${role} removido das permissões administrativas.`);
    return;
  }

  if (action === "adminLogs" || action === "logs") {
    const rawChannel = interaction.fields.getTextInputValue("channel");
    const channelId = rawChannel.replace(/\D/g, "");

    if (!channelId) {
      await interaction.editReply("Informe uma menção ou ID de canal válido.");
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      await interaction.editReply("Esse canal não parece ser um canal de texto válido.");
      return;
    }

    await services.guildConfig.setLogChannel(interaction.guild, interaction.user.id, channel.id);
    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Log administrativo configurado",
      description: `O log administrativo agora é <#${channel.id}>.`
    });
    await interaction.editReply(`Log administrativo configurado: <#${channel.id}>.`);
    return;
  }

  if (action === "commandLogs") {
    const rawChannel = interaction.fields.getTextInputValue("channel");
    const channelId = rawChannel.replace(/\D/g, "");

    if (!channelId) {
      await interaction.editReply("Informe uma menção ou ID de canal válido.");
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      await interaction.editReply("Esse canal não parece ser um canal de texto válido.");
      return;
    }

    await services.guildConfig.setCommandLogChannel(interaction.guild, interaction.user.id, channel.id);
    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Log de comandos configurado",
      description: `O log de comandos agora é <#${channel.id}>.`
    });
    await interaction.editReply(`Log de comandos configurado: <#${channel.id}>.`);
    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function parsePage(value: string): ConfigPage {
  if (value === "prefix" || value === "adminLogs" || value === "commandLogs" || value === "permissions") {
    return value;
  }

  return value === "logs" ? "adminLogs" : "overview";
}

function parseRoleId(value: string): string | null {
  const roleId = value.replace(/\D/g, "");
  return /^\d{15,25}$/.test(roleId) ? roleId : null;
}

async function sendConfigLog(
  guild: Guild,
  user: User,
  services: CommandServices,
  input: {
    title: string;
    description: string;
  }
): Promise<void> {
  await sendStaffLogForGuild(guild, user, services, input);
}

async function replyPrivately(
  interaction: Interaction,
  content: string
): Promise<void> {
  if (!interaction.isRepliable()) {
    return;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
