import {
  DEFAULT_MODULES,
  isGuildModuleKey,
  type GuildModuleKey
} from "../../config/defaults.js";
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
import {
  WorldConfigError,
  normalizeKey,
  type UpdateClanInput,
  type UpdateRankInput,
  type UpdateVillageInput,
  type WorldEntityType
} from "../world/WorldConfigService.js";
import { Prisma, type Clan, type RankDefinition, type Village } from "../../generated/prisma/client.js";
import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:config";
const CONFIG_SELECT_ID = `${CUSTOM_ID_PREFIX}:select`;
const PERMISSION_BUTTON_PREFIX = `${CUSTOM_ID_PREFIX}:permission`;
const MODULE_BUTTON_PREFIX = `${CUSTOM_ID_PREFIX}:module`;
const WORLD_SELECT_ID = `${CUSTOM_ID_PREFIX}:world`;

type ConfigPage =
  | "overview"
  | "prefix"
  | "adminLogs"
  | "commandLogs"
  | "permissions"
  | "modules"
  | "world"
  | "worldClans"
  | "worldVillages"
  | "worldRanks";

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
    if (interaction.customId.startsWith(WORLD_SELECT_ID)) {
      await handleWorldSelect(interaction, services);
      return true;
    }

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

    if (action === "modules") {
      const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
      await interaction.update(await buildConfigPanel(services, interaction.guild, prefix, "modules"));
      return true;
    }

    if (action === "world" || action === "worldClans" || action === "worldVillages" || action === "worldRanks") {
      const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
      await interaction.update(await buildConfigPanel(services, interaction.guild, prefix, action));
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
  const [adminLogChannelId, commandLogChannelId, moduleStatus, worldOverview] = await Promise.all([
    services.guildConfig.getLogChannelId(guild).catch(() => null),
    services.guildConfig.getCommandLogChannelId(guild).catch(() => null),
    services.guildConfig.getModuleStatus(guild),
    services.world.getOverview(guild)
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
      { name: "Módulos", value: `${overview.activeModulesCount}/${overview.modulesCount} ativos`, inline: true },
      { name: "Atributos", value: String(overview.attributesCount), inline: true },
      { name: "Clãs", value: `${worldOverview.activeClansCount}/${worldOverview.clansCount} ativos`, inline: true },
      { name: "Vilas", value: `${worldOverview.activeVillagesCount}/${worldOverview.villagesCount} ativas`, inline: true },
      { name: "Ranks", value: `${worldOverview.activeRanksCount}/${worldOverview.ranksCount} ativos`, inline: true },
      { name: "Jutsus", value: String(overview.jutsusCount), inline: true },
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
  } else if (page === "modules") {
    embed.addFields({
      name: "Módulos ativos/inativos",
      value: DEFAULT_MODULES.map((module) =>
        [
          `**${module.name}** \`[${module.key}]\``,
          `Status: **${moduleStatus[module.key] ? "Ativo" : "Inativo"}**`,
          module.description
        ].join("\n")
      ).join("\n\n")
    });
  } else if (page === "world") {
    embed.addFields({
      name: "Mundo RPG",
      value: [
        "Gerencie os dados narrativos usados pelas fichas.",
        `Clãs: **${worldOverview.activeClansCount}/${worldOverview.clansCount} ativos**`,
        `Vilas: **${worldOverview.activeVillagesCount}/${worldOverview.villagesCount} ativas**`,
        `Ranks: **${worldOverview.activeRanksCount}/${worldOverview.ranksCount} ativos**`,
        "",
        "Use a lista de dados do RPG para listar, criar, editar ou ajustar metadados.",
        "Bônus e restrições de clã, vila e rank já afetam a ficha."
      ].join("\n")
    });
  } else if (page === "worldClans") {
    const clans = await services.world.listClans(guild, { includeInactive: true });

    embed.addFields({
      name: "Clãs cadastrados",
      value: formatClanList(clans)
    });
  } else if (page === "worldVillages") {
    const villages = await services.world.listVillages(guild, { includeInactive: true });

    embed.addFields({
      name: "Vilas cadastradas",
      value: formatVillageList(villages)
    });
  } else if (page === "worldRanks") {
    const ranks = await services.world.listRanks(guild, { includeInactive: true });

    embed.addFields({
      name: "Ranks cadastrados",
      value: formatRankList(ranks)
    });
  } else {
    embed.addFields({
      name: "Ações disponíveis",
      value: [
        "Use a lista suspensa para alterar prefixo, logs, permissões ou módulos.",
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

  if (page === "modules") {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${MODULE_BUTTON_PREFIX}:enable`)
          .setLabel("Ativar módulo")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${MODULE_BUTTON_PREFIX}:disable`)
          .setLabel("Desativar módulo")
          .setStyle(ButtonStyle.Danger)
      )
    );
  }

  if (page === "world" || page === "worldClans" || page === "worldVillages" || page === "worldRanks") {
    components.push(buildWorldSelect());
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
  services: CommandServices,
  page: ConfigPage = "overview"
): Promise<void> {
  const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");

  await interaction.message
    .edit(await buildConfigPanel(services, interaction.guild, prefix, page))
    .catch(() => undefined);
}

async function handleWorldSelect(
  interaction: StringSelectMenuInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const [operation, rawEntity] = (interaction.values[0] ?? "").split(":");
  const entity = parseWorldEntityType(rawEntity);

  if (!entity) {
    await interaction.reply({
      content: "Escolha um tipo válido de dado do RPG.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (operation === "list") {
    const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");
    await interaction.update(await buildConfigPanel(services, interaction.guild, prefix, getWorldPage(entity)));
    return;
  }

  if (operation === "create") {
    await resetConfigMenu(interaction, services, getWorldPage(entity));
    await interaction.showModal(buildWorldCreateModal(entity));
    return;
  }

  if (operation === "edit") {
    await resetConfigMenu(interaction, services, getWorldPage(entity));
    await interaction.showModal(buildWorldEditModal(entity));
    return;
  }

  if (operation === "advanced") {
    await resetConfigMenu(interaction, services, getWorldPage(entity));
    await interaction.showModal(buildWorldAdvancedModal(entity));
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nos dados do RPG.",
    flags: MessageFlags.Ephemeral
  });
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
          .setValue("permissions"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Módulos")
          .setDescription("Ativa ou desativa módulos neste servidor.")
          .setValue("modules"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Mundo RPG")
          .setDescription("Gerencia clãs, vilas e ranks usados nas fichas.")
          .setValue("world")
      )
  );
}

function buildWorldSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${WORLD_SELECT_ID}:${Date.now().toString(36)}`)
      .setPlaceholder("Gerenciar dados do RPG")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Listar clãs")
          .setDescription("Mostra clãs ativos e inativos cadastrados.")
          .setValue("list:clan"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Criar clã")
          .setDescription("Cadastra um clã para vínculos de ficha.")
          .setValue("create:clan"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Editar clã")
          .setDescription("Altera nome, descrição, limite ou status.")
          .setValue("edit:clan"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Regras de clã")
          .setDescription("Ajusta bônus e restrições em JSON.")
          .setValue("advanced:clan"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Listar vilas")
          .setDescription("Mostra vilas ativas e inativas cadastradas.")
          .setValue("list:village"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Criar vila")
          .setDescription("Cadastra uma vila para vínculos de ficha.")
          .setValue("create:village"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Editar vila")
          .setDescription("Altera nome, descrição ou status.")
          .setValue("edit:village"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Metadados da vila")
          .setDescription("Ajusta bônus, restrições e metadados em JSON.")
          .setValue("advanced:village"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Listar ranks")
          .setDescription("Mostra ranks ativos e inativos cadastrados.")
          .setValue("list:rank"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Criar rank")
          .setDescription("Cadastra uma graduação para fichas.")
          .setValue("create:rank"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Editar rank")
          .setDescription("Altera nome, ordem, descrição ou status.")
          .setValue("edit:rank"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Metadados do rank")
          .setDescription("Ajusta bônus, restrições e metadados em JSON.")
          .setValue("advanced:rank")
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

function buildModuleModal(action: "enable" | "disable"): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:module:${action}`)
    .setTitle(action === "enable" ? "Ativar módulo" : "Desativar módulo")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("module")
          .setLabel("Módulo")
          .setPlaceholder(DEFAULT_MODULES.map((module) => module.key).join(", "))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

function buildWorldCreateModal(entity: WorldEntityType): ModalBuilder {
  if (entity === "clan") {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:create:clan`)
      .setTitle("Criar clã")
      .addComponents(
        textInputRow("name", "Nome", "Uchiha", TextInputStyle.Short, true),
        textInputRow("description", "Descrição", "Descrição curta do clã", TextInputStyle.Paragraph, false),
        textInputRow("memberLimit", "Limite de membros", "5 ou vazio para sem limite", TextInputStyle.Short, false),
        textInputRow("bonuses", "Bônus JSON", "{\"forca\":2,\"chakra\":10}", TextInputStyle.Paragraph, false),
        textInputRow("restrictions", "Restrições JSON", "{\"vila\":\"Konoha\",\"rank_minimo\":\"genin\"}", TextInputStyle.Paragraph, false)
      );
  }

  if (entity === "village") {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:create:village`)
      .setTitle("Criar vila")
      .addComponents(
        textInputRow("name", "Nome", "Konoha", TextInputStyle.Short, true),
        textInputRow("description", "Descrição", "Descrição curta da vila", TextInputStyle.Paragraph, false),
        textInputRow("metadata", "Metadados JSON", "{\"pais\":\"Fogo\",\"bonuses\":{\"resistencia\":1}}", TextInputStyle.Paragraph, false)
      );
  }

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:create:rank`)
    .setTitle("Criar rank")
    .addComponents(
      textInputRow("key", "Chave técnica", "tokubetsu_jonin", TextInputStyle.Short, true),
      textInputRow("name", "Nome", "Tokubetsu Jonin", TextInputStyle.Short, true),
      textInputRow("sortOrder", "Ordem", "35", TextInputStyle.Short, false),
      textInputRow("description", "Descrição", "Descrição curta do rank", TextInputStyle.Paragraph, false),
      textInputRow("metadata", "Metadados JSON", "{\"nivel\":4,\"bonuses\":{\"chakra\":5}}", TextInputStyle.Paragraph, false)
    );
}

function buildWorldEditModal(entity: WorldEntityType): ModalBuilder {
  if (entity === "clan") {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:edit:clan`)
      .setTitle("Editar clã")
      .addComponents(
        textInputRow("identifier", "Nome ou ID atual", "Uchiha", TextInputStyle.Short, true),
        textInputRow("name", "Novo nome", "Uchiha", TextInputStyle.Short, false),
        textInputRow("description", "Descrição", "- para limpar", TextInputStyle.Paragraph, false),
        textInputRow("memberLimit", "Limite de membros", "5, vazio mantém, - limpa", TextInputStyle.Short, false),
        textInputRow("status", "Status", "ativo, inativo ou vazio para manter", TextInputStyle.Short, false)
      );
  }

  if (entity === "village") {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:edit:village`)
      .setTitle("Editar vila")
      .addComponents(
        textInputRow("identifier", "Nome ou ID atual", "Konoha", TextInputStyle.Short, true),
        textInputRow("name", "Novo nome", "Konoha", TextInputStyle.Short, false),
        textInputRow("description", "Descrição", "- para limpar", TextInputStyle.Paragraph, false),
        textInputRow("status", "Status", "ativo, inativo ou vazio para manter", TextInputStyle.Short, false)
      );
  }

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:edit:rank`)
    .setTitle("Editar rank")
    .addComponents(
      textInputRow("identifier", "Chave, nome ou ID atual", "genin", TextInputStyle.Short, true),
      textInputRow("name", "Novo nome", "Genin", TextInputStyle.Short, false),
      textInputRow("sortOrder", "Ordem", "20 ou vazio para manter", TextInputStyle.Short, false),
      textInputRow("description", "Descrição", "- para limpar", TextInputStyle.Paragraph, false),
      textInputRow("status", "Status", "ativo, inativo ou vazio para manter", TextInputStyle.Short, false)
    );
}

function buildWorldAdvancedModal(entity: WorldEntityType): ModalBuilder {
  if (entity === "clan") {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:advanced:clan`)
      .setTitle("Regras avançadas do clã")
      .addComponents(
        textInputRow("identifier", "Nome ou ID do clã", "Uchiha", TextInputStyle.Short, true),
        textInputRow("bonuses", "Bônus JSON", "{\"forca\":2,\"chakra\":10}", TextInputStyle.Paragraph, false),
        textInputRow("restrictions", "Restrições JSON", "{\"vila\":\"Konoha\",\"rank_minimo\":\"genin\"}", TextInputStyle.Paragraph, false)
      );
  }

  if (entity === "village") {
    return new ModalBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:advanced:village`)
      .setTitle("Metadados da vila")
      .addComponents(
        textInputRow("identifier", "Nome ou ID da vila", "Konoha", TextInputStyle.Short, true),
        textInputRow("metadata", "Metadados JSON", "{\"bonuses\":{\"resistencia\":1},\"restrictions\":{\"rank_minimo\":\"genin\"}}", TextInputStyle.Paragraph, false)
      );
  }

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:world:advanced:rank`)
    .setTitle("Metadados do rank")
    .addComponents(
      textInputRow("identifier", "Chave, nome ou ID do rank", "genin", TextInputStyle.Short, true),
      textInputRow("metadata", "Metadados JSON", "{\"bonuses\":{\"chakra\":5},\"restrictions\":{\"vila\":\"Konoha\"}}", TextInputStyle.Paragraph, false)
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

async function handleConfigButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  if (interaction.customId.startsWith(PERMISSION_BUTTON_PREFIX)) {
    const action = interaction.customId.slice(`${PERMISSION_BUTTON_PREFIX}:`.length);

    if (action === "add" || action === "remove") {
      await interaction.showModal(buildRolePermissionModal(action));
      return;
    }
  }

  if (interaction.customId.startsWith(MODULE_BUTTON_PREFIX)) {
    const action = interaction.customId.slice(`${MODULE_BUTTON_PREFIX}:`.length);

    if (action === "enable" || action === "disable") {
      await interaction.showModal(buildModuleModal(action));
      return;
    }
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

  if (action.startsWith("world:")) {
    await handleWorldModal(interaction, services, action);
    return;
  }

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

  if (action === "module:enable" || action === "module:disable") {
    const moduleKey = parseModuleKey(interaction.fields.getTextInputValue("module"));

    if (!moduleKey) {
      await interaction.editReply(
        `Informe um módulo válido: ${DEFAULT_MODULES.map((module) => `\`${module.key}\``).join(", ")}.`
      );
      return;
    }

    const enabled = action === "module:enable";
    const module = DEFAULT_MODULES.find((entry) => entry.key === moduleKey);

    await services.guildConfig.setModuleEnabled(interaction.guild, interaction.user.id, moduleKey, enabled);
    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: enabled ? "Módulo ativado" : "Módulo desativado",
      description: `O módulo **${module?.name ?? moduleKey}** foi ${enabled ? "ativado" : "desativado"}.`
    });
    await interaction.editReply(`Módulo **${module?.name ?? moduleKey}** ${enabled ? "ativado" : "desativado"}.`);
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

async function handleWorldModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  action: string
): Promise<void> {
  const [, operation, rawEntity] = action.split(":");
  const entity = parseWorldEntityType(rawEntity);

  if (!entity) {
    await interaction.editReply("Tipo de dado do RPG inválido.");
    return;
  }

  try {
    if (operation === "create") {
      await handleWorldCreateModal(interaction, services, entity);
      return;
    }

    if (operation === "edit") {
      await handleWorldEditModal(interaction, services, entity);
      return;
    }

    if (operation === "advanced") {
      await handleWorldAdvancedModal(interaction, services, entity);
      return;
    }

    await interaction.editReply("Ação desconhecida nos dados do RPG.");
  } catch (error) {
    if (error instanceof WorldConfigError) {
      await interaction.editReply(error.message);
      return;
    }

    console.error("[config:world]", error);
    await interaction.editReply("Não consegui salvar esse dado do RPG. Verifique os logs do bot.");
  }
}

async function handleWorldCreateModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  entity: WorldEntityType
): Promise<void> {
  if (entity === "clan") {
    const name = parseRequiredText(interaction.fields.getTextInputValue("name"), "Nome", 80);
    const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900);
    const memberLimit = parseOptionalInteger(
      interaction.fields.getTextInputValue("memberLimit"),
      "Limite de membros",
      { min: 1 }
    );
    const bonuses = parseOptionalJsonObject(interaction.fields.getTextInputValue("bonuses"), "Bônus JSON");
    const restrictions = parseOptionalJsonObject(
      interaction.fields.getTextInputValue("restrictions"),
      "Restrições JSON"
    );

    const created = await services.world.createClan(interaction.guild, interaction.user.id, {
      name,
      description,
      memberLimit,
      bonuses,
      restrictions
    });

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Clã criado",
      description: `O clã **${created.name}** foi cadastrado para vínculos de ficha.`
    });
    await refreshWorldMessage(interaction, services, entity);
    await interaction.editReply(`Clã **${created.name}** criado.`);
    return;
  }

  if (entity === "village") {
    const name = parseRequiredText(interaction.fields.getTextInputValue("name"), "Nome", 80);
    const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900);
    const metadata = parseOptionalJsonObject(interaction.fields.getTextInputValue("metadata"), "Metadados JSON");

    const created = await services.world.createVillage(interaction.guild, interaction.user.id, {
      name,
      description,
      metadata
    });

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Vila criada",
      description: `A vila **${created.name}** foi cadastrada para vínculos de ficha.`
    });
    await refreshWorldMessage(interaction, services, entity);
    await interaction.editReply(`Vila **${created.name}** criada.`);
    return;
  }

  const rawKey = parseRequiredText(interaction.fields.getTextInputValue("key"), "Chave técnica", 60);
  const key = normalizeKey(rawKey);

  if (!key) {
    throw new WorldConfigError("Informe uma chave técnica com letras ou números.");
  }

  const name = parseRequiredText(interaction.fields.getTextInputValue("name"), "Nome", 80);
  const sortOrder = parseOptionalInteger(interaction.fields.getTextInputValue("sortOrder"), "Ordem", {
    min: 0
  });
  const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900);
  const metadata = parseOptionalJsonObject(interaction.fields.getTextInputValue("metadata"), "Metadados JSON");

  const created = await services.world.createRank(interaction.guild, interaction.user.id, {
    key,
    name,
    sortOrder: sortOrder ?? undefined,
    description,
    metadata
  });

  await sendConfigLog(interaction.guild, interaction.user, services, {
    title: "Rank criado",
    description: `O rank **${created.name}** \`${created.key}\` foi cadastrado para vínculos de ficha.`
  });
  await refreshWorldMessage(interaction, services, entity);
  await interaction.editReply(`Rank **${created.name}** criado com a chave \`${created.key}\`.`);
}

async function handleWorldEditModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  entity: WorldEntityType
): Promise<void> {
  const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Identificador", 120);

  if (entity === "clan") {
    const input: UpdateClanInput = {};
    const name = parseOptionalText(interaction.fields.getTextInputValue("name"), 80) ?? undefined;
    const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900, true);
    const memberLimit = parseOptionalInteger(
      interaction.fields.getTextInputValue("memberLimit"),
      "Limite de membros",
      { min: 1, clearable: true }
    );
    const isActive = parseOptionalStatus(interaction.fields.getTextInputValue("status"));

    if (name !== undefined) input.name = name;
    if (description !== undefined) input.description = description;
    if (memberLimit !== undefined) input.memberLimit = memberLimit;
    if (isActive !== undefined) input.isActive = isActive;

    if (!hasInput(input)) {
      await interaction.editReply("Informe ao menos um campo para alterar.");
      return;
    }

    const updated = await services.world.updateClan(interaction.guild, interaction.user.id, identifier, input);

    if (!updated) {
      await interaction.editReply("Não encontrei esse clã neste servidor.");
      return;
    }

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Clã atualizado",
      description: `O clã **${updated.name}** foi atualizado.`
    });
    await refreshWorldMessage(interaction, services, entity);
    await interaction.editReply(`Clã **${updated.name}** atualizado.`);
    return;
  }

  if (entity === "village") {
    const input: UpdateVillageInput = {};
    const name = parseOptionalText(interaction.fields.getTextInputValue("name"), 80) ?? undefined;
    const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900, true);
    const isActive = parseOptionalStatus(interaction.fields.getTextInputValue("status"));

    if (name !== undefined) input.name = name;
    if (description !== undefined) input.description = description;
    if (isActive !== undefined) input.isActive = isActive;

    if (!hasInput(input)) {
      await interaction.editReply("Informe ao menos um campo para alterar.");
      return;
    }

    const updated = await services.world.updateVillage(interaction.guild, interaction.user.id, identifier, input);

    if (!updated) {
      await interaction.editReply("Não encontrei essa vila neste servidor.");
      return;
    }

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Vila atualizada",
      description: `A vila **${updated.name}** foi atualizada.`
    });
    await refreshWorldMessage(interaction, services, entity);
    await interaction.editReply(`Vila **${updated.name}** atualizada.`);
    return;
  }

  const input: UpdateRankInput = {};
  const name = parseOptionalText(interaction.fields.getTextInputValue("name"), 80) ?? undefined;
  const sortOrder = parseOptionalInteger(interaction.fields.getTextInputValue("sortOrder"), "Ordem", {
    min: 0
  });
  const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900, true);
  const isActive = parseOptionalStatus(interaction.fields.getTextInputValue("status"));

  if (name !== undefined) input.name = name;
  if (sortOrder !== undefined && sortOrder !== null) input.sortOrder = sortOrder;
  if (description !== undefined) input.description = description;
  if (isActive !== undefined) input.isActive = isActive;

  if (!hasInput(input)) {
    await interaction.editReply("Informe ao menos um campo para alterar.");
    return;
  }

  const updated = await services.world.updateRank(interaction.guild, interaction.user.id, identifier, input);

  if (!updated) {
    await interaction.editReply("Não encontrei esse rank neste servidor.");
    return;
  }

  await sendConfigLog(interaction.guild, interaction.user, services, {
    title: "Rank atualizado",
    description: `O rank **${updated.name}** \`${updated.key}\` foi atualizado.`
  });
  await refreshWorldMessage(interaction, services, entity);
  await interaction.editReply(`Rank **${updated.name}** atualizado.`);
}

async function handleWorldAdvancedModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  entity: WorldEntityType
): Promise<void> {
  const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Identificador", 120);

  if (entity === "clan") {
    const bonuses = parseOptionalJsonObject(interaction.fields.getTextInputValue("bonuses"), "Bônus JSON", true);
    const restrictions = parseOptionalJsonObject(
      interaction.fields.getTextInputValue("restrictions"),
      "Restrições JSON",
      true
    );

    if (bonuses === undefined && restrictions === undefined) {
      await interaction.editReply("Informe bônus ou restrições para alterar.");
      return;
    }

    const updated = await services.world.updateClanRules(interaction.guild, interaction.user.id, identifier, {
      bonuses,
      restrictions
    });

    if (!updated) {
      await interaction.editReply("Não encontrei esse clã neste servidor.");
      return;
    }

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Regras de clã atualizadas",
      description: `As regras avançadas do clã **${updated.name}** foram atualizadas.`
    });
    await refreshWorldMessage(interaction, services, entity);
    await interaction.editReply(`Regras avançadas do clã **${updated.name}** atualizadas.`);
    return;
  }

  const metadata = parseOptionalJsonObject(interaction.fields.getTextInputValue("metadata"), "Metadados JSON", true);

  if (metadata === undefined) {
    await interaction.editReply("Informe metadados para alterar.");
    return;
  }

  if (entity === "village") {
    const updated = await services.world.updateVillageMetadata(
      interaction.guild,
      interaction.user.id,
      identifier,
      metadata
    );

    if (!updated) {
      await interaction.editReply("Não encontrei essa vila neste servidor.");
      return;
    }

    await sendConfigLog(interaction.guild, interaction.user, services, {
      title: "Metadados de vila atualizados",
      description: `Os metadados da vila **${updated.name}** foram atualizados.`
    });
    await refreshWorldMessage(interaction, services, entity);
    await interaction.editReply(`Metadados da vila **${updated.name}** atualizados.`);
    return;
  }

  const updated = await services.world.updateRankMetadata(
    interaction.guild,
    interaction.user.id,
    identifier,
    metadata
  );

  if (!updated) {
    await interaction.editReply("Não encontrei esse rank neste servidor.");
    return;
  }

  await sendConfigLog(interaction.guild, interaction.user, services, {
    title: "Metadados de rank atualizados",
    description: `Os metadados do rank **${updated.name}** \`${updated.key}\` foram atualizados.`
  });
  await refreshWorldMessage(interaction, services, entity);
  await interaction.editReply(`Metadados do rank **${updated.name}** atualizados.`);
}

function parsePage(value: string): ConfigPage {
  if (
    value === "prefix" ||
    value === "adminLogs" ||
    value === "commandLogs" ||
    value === "permissions" ||
    value === "modules" ||
    value === "world" ||
    value === "worldClans" ||
    value === "worldVillages" ||
    value === "worldRanks"
  ) {
    return value;
  }

  return value === "logs" ? "adminLogs" : "overview";
}

function parseRoleId(value: string): string | null {
  const roleId = value.replace(/\D/g, "");
  return /^\d{15,25}$/.test(roleId) ? roleId : null;
}

function parseModuleKey(value: string): GuildModuleKey | null {
  const key = value.trim().toLowerCase();

  if (["ficha", "fichas", "personagem", "personagens"].includes(key)) {
    return "characters";
  }

  if (["atributo", "atributos", "chakra"].includes(key)) {
    return "attributes";
  }

  if (["jutsu", "jutsus", "tecnica", "tecnicas", "técnica", "técnicas"].includes(key)) {
    return "jutsus";
  }

  if (["treino", "treinar", "evoluir", "evolucao", "evolução", "progressao", "progressão"].includes(key)) {
    return "training";
  }

  if (["combate", "combates", "batalha", "batalhas", "turno", "turnos"].includes(key)) {
    return "combat";
  }

  return isGuildModuleKey(key) ? key : null;
}

function parseWorldEntityType(value: string | undefined): WorldEntityType | null {
  return value === "clan" || value === "village" || value === "rank" ? value : null;
}

function getWorldPage(entity: WorldEntityType): ConfigPage {
  if (entity === "clan") {
    return "worldClans";
  }

  if (entity === "village") {
    return "worldVillages";
  }

  return "worldRanks";
}

function formatClanList(clans: Clan[]): string {
  if (clans.length === 0) {
    return "Nenhum clã cadastrado. Use `Criar clã` na lista de dados do RPG.";
  }

  return limitLines(
    clans.map((clan) =>
      [
        `${formatStatus(clan.isActive)} **${clan.name}**${clan.memberLimit ? ` | limite ${clan.memberLimit}` : ""}`,
        clan.description ? truncate(clan.description, 120) : "Sem descrição.",
        `ID: \`${clan.id}\``
      ].join("\n")
    ),
    clans.length
  );
}

function formatVillageList(villages: Village[]): string {
  if (villages.length === 0) {
    return "Nenhuma vila cadastrada. Use `Criar vila` na lista de dados do RPG.";
  }

  return limitLines(
    villages.map((village) =>
      [
        `${formatStatus(village.isActive)} **${village.name}**`,
        village.description ? truncate(village.description, 120) : "Sem descrição.",
        `ID: \`${village.id}\``
      ].join("\n")
    ),
    villages.length
  );
}

function formatRankList(ranks: RankDefinition[]): string {
  if (ranks.length === 0) {
    return "Nenhum rank cadastrado. Use `.setup` para criar defaults ou `Criar rank` na lista de dados do RPG.";
  }

  return limitLines(
    ranks.map((rank) =>
      [
        `${formatStatus(rank.isActive)} **${rank.name}** \`${rank.key}\` | ordem ${rank.sortOrder}`,
        rank.description ? truncate(rank.description, 120) : "Sem descrição.",
        `ID: \`${rank.id}\``
      ].join("\n")
    ),
    ranks.length
  );
}

function limitLines(lines: string[], total: number): string {
  const visible = lines.slice(0, 6);
  const hidden = total - visible.length;
  const suffix = hidden > 0 ? [`...e mais ${hidden} registro(s).`] : [];

  return [...visible, ...suffix].join("\n\n").slice(0, 1024);
}

function formatStatus(isActive: boolean): string {
  return isActive ? "Ativo -" : "Inativo -";
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function parseRequiredText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new WorldConfigError(`Preencha o campo **${label}**.`);
  }

  if (trimmed.length > maxLength) {
    throw new WorldConfigError(`O campo **${label}** precisa ter no máximo ${maxLength} caracteres.`);
  }

  return trimmed;
}

function parseOptionalText(
  value: string,
  maxLength: number,
  clearable = false
): string | null | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (clearable && trimmed === "-") {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new WorldConfigError(`Um dos campos de texto passou de ${maxLength} caracteres.`);
  }

  return trimmed;
}

function parseOptionalInteger(
  value: string,
  label: string,
  options: { min: number; clearable?: boolean }
): number | null | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (options.clearable && trimmed === "-") {
    return null;
  }

  if (!/^-?\d+$/.test(trimmed)) {
    throw new WorldConfigError(`O campo **${label}** precisa ser um número inteiro.`);
  }

  const parsed = Number(trimmed);

  if (parsed < options.min) {
    throw new WorldConfigError(`O campo **${label}** precisa ser maior ou igual a ${options.min}.`);
  }

  return parsed;
}

function parseOptionalStatus(value: string): boolean | undefined {
  const normalized = value.trim().toLocaleLowerCase("pt-BR");

  if (!normalized) {
    return undefined;
  }

  if (["ativo", "ativar", "on", "true", "sim"].includes(normalized)) {
    return true;
  }

  if (["inativo", "desativar", "off", "false", "nao", "não"].includes(normalized)) {
    return false;
  }

  throw new WorldConfigError("Status inválido. Use `ativo`, `inativo` ou deixe em branco para manter.");
}

function parseOptionalJsonObject(
  value: string,
  label: string,
  clearable = false
): Prisma.InputJsonObject | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (clearable && trimmed === "-") {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not-object");
    }

    return parsed as Prisma.InputJsonObject;
  } catch {
    throw new WorldConfigError(`${label} precisa ser um objeto JSON. Exemplo: \`{"chakra":10}\`.`);
  }
}

function hasInput(input: object): boolean {
  return Object.values(input).some((value) => value !== undefined);
}

async function refreshWorldMessage(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  entity: WorldEntityType
): Promise<void> {
  if (!interaction.message) {
    return;
  }

  const prefix = await services.guildConfig.getPrefix(interaction.guild).catch(() => ".");

  await interaction.message
    .edit(await buildConfigPanel(services, interaction.guild, prefix, getWorldPage(entity)))
    .catch(() => undefined);
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
