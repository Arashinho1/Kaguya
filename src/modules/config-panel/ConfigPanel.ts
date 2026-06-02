import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type User
} from "discord.js";

import { hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:config";
const CONFIG_SELECT_ID = `${CUSTOM_ID_PREFIX}:select`;

type ConfigPage = "overview" | "prefix" | "logs";

export async function buildConfigPanel(
  services: CommandServices,
  guild: Guild,
  prefix: string,
  page: ConfigPage = "overview"
) {
  return {
    embeds: [await buildConfigEmbed(services, guild, prefix, page)],
    components: [buildConfigSelect()]
  };
}

export async function handleConfigInteraction(
  interaction: Interaction,
  services: CommandServices
): Promise<boolean> {
  if (!interaction.isStringSelectMenu() && !interaction.isModalSubmit()) {
    return false;
  }

  if (!interaction.customId.startsWith(CUSTOM_ID_PREFIX)) {
    return false;
  }

  if (!interaction.inCachedGuild()) {
    await replyPrivately(interaction, "Esse painel só pode ser usado dentro de um servidor.");
    return true;
  }

  if (!hasManageGuildPermission(interaction.memberPermissions)) {
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

    if (action === "logs") {
      const logChannelId = await services.guildConfig.getLogChannelId(interaction.guild).catch(() => null);
      await resetConfigMenu(interaction, services);
      await interaction.showModal(buildLogChannelModal(logChannelId));
      return true;
    }

    const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
    await interaction.update(await buildConfigPanel(services, interaction.guild, prefix, "overview"));
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
  const logChannelId = await services.guildConfig.getLogChannelId(guild).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle("Painel de configuração")
    .setDescription(
      [
        "Configurações técnicas do RPG neste servidor.",
        "Tudo aqui é salvo por servidor e pode ser ajustado sem mexer no código.",
        "",
        `Prefixo atual: \`${overview.prefix}\``,
        `Canal de logs: ${logChannelId ? `<#${logChannelId}>` : "não configurado"}`
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
  } else if (page === "logs") {
    embed.addFields({
      name: "Logs",
      value: "Use a opção `Canal de logs` na lista suspensa. Aceita menção do canal ou ID."
    });
  } else {
    embed.addFields({
      name: "Ações disponíveis",
      value: [
        "Use a lista suspensa para alterar prefixo ou canal de logs.",
        `Atalhos ainda funcionam: \`${prefix}config prefix .\` e \`${prefix}config log #canal\`.`
      ].join("\n")
    });
  }

  return embed;
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
          .setLabel("Canal de logs")
          .setDescription("Define onde alterações administrativas serão registradas.")
          .setValue("logs")
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

function buildLogChannelModal(currentChannelId: string | null): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("channel")
    .setLabel("Canal de logs")
    .setPlaceholder("#logs ou ID do canal")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  if (currentChannelId) {
    input.setValue(currentChannelId);
  }

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:logs`)
    .setTitle("Configurar canal de logs")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
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

  if (action === "logs") {
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
      title: "Canal de logs configurado",
      description: `O canal de logs agora é <#${channel.id}>.`
    });
    await interaction.editReply(`Canal de logs configurado: <#${channel.id}>.`);
    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function parsePage(value: string): ConfigPage {
  return value === "prefix" || value === "logs" ? value : "overview";
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
