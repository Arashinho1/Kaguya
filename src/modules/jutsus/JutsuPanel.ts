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

import { JutsuRuleError, type JutsuWithRelations } from "./JutsuService.js";
import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:jutsus";

type JutsuPage = "home" | "catalog" | "known";

export async function buildJutsuPanel(
  services: CommandServices,
  guild: Guild,
  user: User,
  canManage: boolean,
  page: JutsuPage = "home"
) {
  return {
    embeds: [await buildJutsuEmbed(services, guild, user, page)],
    components: buildJutsuComponents(canManage)
  };
}

export async function handleJutsuInteraction(
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

  if (!(await services.guildConfig.isModuleEnabled(interaction.guild, "jutsus"))) {
    await replyPrivately(interaction, "O módulo **Jutsus** está desativado neste servidor.");
    return true;
  }

  try {
    if (interaction.isButton()) {
      await handleJutsuButton(interaction, services);
      return true;
    }

    await handleJutsuModal(interaction, services);
    return true;
  } catch (error) {
    if (error instanceof JutsuRuleError) {
      await replyPrivately(interaction, error.message);
      return true;
    }

    throw error;
  }
}

async function buildJutsuEmbed(
  services: CommandServices,
  guild: Guild,
  user: User,
  page: JutsuPage
): Promise<EmbedBuilder> {
  const overview = await services.jutsus.getOverview(guild, user);
  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle("Painel de jutsus")
    .setDescription(
      [
        "Catálogo e aprendizado de jutsus deste servidor.",
        "A staff configura o catálogo; jogadores aprendem com a ficha ativa.",
        "",
        `Jutsus ativos: **${overview.activeCount}/${overview.totalCount}**`,
        `Seus jutsus aprendidos: **${overview.learnedCount}**`
      ].join("\n")
    );

  if (page === "catalog") {
    const jutsus = await services.jutsus.listJutsus(guild);
    embed.addFields({
      name: "Catálogo ativo",
      value: formatJutsuList(services, jutsus, "Nenhum jutsu ativo cadastrado.")
    });
  } else if (page === "known") {
    const known = await services.jutsus.listKnownJutsus(guild, user);
    embed.addFields({
      name: "Jutsus aprendidos",
      value:
        known.length > 0
          ? known
              .slice(0, 8)
              .map((entry) => services.jutsus.formatJutsu(entry.jutsu))
              .join("\n\n")
              .slice(0, 1024)
          : "Você ainda não aprendeu jutsus neste servidor."
    });
  } else {
    embed.addFields({
      name: "Como usar",
      value: [
        "Use **Catálogo** para ver jutsus disponíveis.",
        "Use **Aprender** para informar nome ou chave técnica do jutsu.",
        "A ficha ativa precisa cumprir rank e requisitos configurados."
      ].join("\n")
    });
  }

  return embed;
}

function buildJutsuComponents(canManage: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:catalog`)
        .setLabel("Catálogo")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:known`)
        .setLabel("Meus jutsus")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:learn`)
        .setLabel("Aprender")
        .setStyle(ButtonStyle.Primary)
    )
  ];

  if (canManage) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:create`)
          .setLabel("Criar jutsu")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:edit`)
          .setLabel("Editar jutsu")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:rules`)
          .setLabel("Requisitos")
          .setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return rows;
}

async function handleJutsuButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);
  const canManage = await canManageJutsus(interaction, services);

  if (action === "catalog" || action === "known") {
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, action)
    );
    return;
  }

  if (action === "learn") {
    await interaction.showModal(buildLearnJutsuModal());
    return;
  }

  if (!canManage) {
    await interaction.reply({
      content: "Você precisa ter Administrador, Gerenciar Servidor ou cargo administrativo configurado para editar jutsus.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (action === "create") {
    await interaction.showModal(buildCreateJutsuModal());
    return;
  }

  if (action === "edit") {
    await interaction.showModal(buildEditJutsuModal());
    return;
  }

  if (action === "rules") {
    await interaction.showModal(buildJutsuRulesModal());
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleJutsuModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "learn") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const learned = await services.jutsus.learnJutsu(interaction.guild, interaction.user, identifier);

    await refreshJutsuMessage(interaction, services, "known");
    await interaction.editReply(`**${learned.jutsu.name}** aprendido pela sua ficha ativa.`);
    return;
  }

  if (!(await canManageJutsus(interaction, services))) {
    await interaction.editReply("Você não tem permissão administrativa para editar jutsus.");
    return;
  }

  if (action === "create") {
    const key = parseRequiredText(interaction.fields.getTextInputValue("key"), "Chave", 60);
    const name = parseRequiredText(interaction.fields.getTextInputValue("name"), "Nome", 80);
    const description = parseOptionalText(interaction.fields.getTextInputValue("description"), 900);
    const { type, rank } = parseTypeRank(interaction.fields.getTextInputValue("typeRank"));
    const chakraCost = parseIntegerField(interaction.fields.getTextInputValue("chakraCost"), "Custo de Chakra", 0);
    const created = await services.jutsus.createJutsu(interaction.guild, interaction.user.id, {
      key,
      name,
      description,
      type,
      requiredRank: rank,
      chakraCost
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Jutsu criado",
      description: `O jutsu **${created.name}** \`${created.key}\` foi cadastrado.`
    });
    await refreshJutsuMessage(interaction, services, "catalog");
    await interaction.editReply(`Jutsu **${created.name}** criado.`);
    return;
  }

  if (action === "edit") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const name = parseOptionalText(interaction.fields.getTextInputValue("name"), 80);
    const { type, rank, hasInput: hasTypeRankInput } = parseTypeRank(interaction.fields.getTextInputValue("typeRank"));
    const chakraCost = parseOptionalIntegerField(interaction.fields.getTextInputValue("chakraCost"), "Custo de Chakra", 0);
    const isActive = parseOptionalStatus(interaction.fields.getTextInputValue("status"));

    if (name === undefined && !hasTypeRankInput && chakraCost === undefined && isActive === undefined) {
      await interaction.editReply("Informe ao menos um campo para alterar.");
      return;
    }

    const updated = await services.jutsus.updateJutsu(interaction.guild, interaction.user.id, identifier, {
      name,
      type: hasTypeRankInput ? type : undefined,
      requiredRank: hasTypeRankInput ? rank : undefined,
      chakraCost,
      isActive
    });

    if (!updated) {
      await interaction.editReply("Não encontrei esse jutsu neste servidor.");
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Jutsu atualizado",
      description: `O jutsu **${updated.name}** \`${updated.key}\` foi atualizado.`
    });
    await refreshJutsuMessage(interaction, services, "catalog");
    await interaction.editReply(`Jutsu **${updated.name}** atualizado.`);
    return;
  }

  if (action === "rules") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const requirements = parseOptionalJsonObject(
      interaction.fields.getTextInputValue("requirements"),
      "Requisitos JSON",
      true
    );
    const metadata = parseOptionalJsonObject(
      interaction.fields.getTextInputValue("metadata"),
      "Metadados JSON",
      true
    );

    if (requirements === undefined && metadata === undefined) {
      await interaction.editReply("Informe requisitos ou metadados para alterar.");
      return;
    }

    const updated = await services.jutsus.updateJutsuRules(interaction.guild, interaction.user.id, identifier, {
      requirements,
      metadata
    });

    if (!updated) {
      await interaction.editReply("Não encontrei esse jutsu neste servidor.");
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Requisitos de jutsu atualizados",
      description: `Os requisitos do jutsu **${updated.name}** \`${updated.key}\` foram atualizados.`
    });
    await refreshJutsuMessage(interaction, services, "catalog");
    await interaction.editReply(`Requisitos de **${updated.name}** atualizados.`);
    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function buildLearnJutsuModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:learn`)
    .setTitle("Aprender jutsu")
    .addComponents(textInputRow("identifier", "Jutsu", "chidori ou Chidori", TextInputStyle.Short, true));
}

function buildCreateJutsuModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:create`)
    .setTitle("Criar jutsu")
    .addComponents(
      textInputRow("key", "Chave técnica", "chidori", TextInputStyle.Short, true),
      textInputRow("name", "Nome", "Chidori", TextInputStyle.Short, true),
      textInputRow("typeRank", "Tipo | Rank mínimo", "ninjutsu | chunin", TextInputStyle.Short, false),
      textInputRow("chakraCost", "Custo de Chakra", "10", TextInputStyle.Short, false),
      textInputRow("description", "Descrição", "Jutsu de investida elétrica.", TextInputStyle.Paragraph, false)
    );
}

function buildEditJutsuModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:edit`)
    .setTitle("Editar jutsu")
    .addComponents(
      textInputRow("identifier", "Chave, nome ou ID", "chidori", TextInputStyle.Short, true),
      textInputRow("name", "Novo nome", "Chidori", TextInputStyle.Short, false),
      textInputRow("typeRank", "Tipo | Rank mínimo", "ninjutsu | chunin ou - | -", TextInputStyle.Short, false),
      textInputRow("chakraCost", "Custo de Chakra", "10 ou vazio para manter", TextInputStyle.Short, false),
      textInputRow("status", "Status", "ativo, inativo ou vazio para manter", TextInputStyle.Short, false)
    );
}

function buildJutsuRulesModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:rules`)
    .setTitle("Requisitos do jutsu")
    .addComponents(
      textInputRow("identifier", "Chave, nome ou ID", "chidori", TextInputStyle.Short, true),
      textInputRow(
        "requirements",
        "Requisitos JSON",
        "{\"atributos\":{\"ninjutsu\":5},\"jutsus\":[\"raiton_basico\"]}",
        TextInputStyle.Paragraph,
        false
      ),
      textInputRow("metadata", "Metadados JSON", "{\"elemento\":\"Raiton\"}", TextInputStyle.Paragraph, false)
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

async function canManageJutsus(
  interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function refreshJutsuMessage(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  page: JutsuPage
): Promise<void> {
  if (!interaction.message) {
    return;
  }

  const canManage = await canManageJutsus(interaction, services);

  await interaction.message
    .edit(await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, page))
    .catch(() => undefined);
}

function formatJutsuList(
  services: CommandServices,
  jutsus: JutsuWithRelations[],
  emptyText: string
): string {
  if (jutsus.length === 0) {
    return emptyText;
  }

  const visible = jutsus.slice(0, 8).map((jutsu) => services.jutsus.formatJutsu(jutsu));
  const hidden = jutsus.length - visible.length;
  const suffix = hidden > 0 ? [`...e mais ${hidden} jutsu(s).`] : [];

  return [...visible, ...suffix].join("\n\n").slice(0, 1024);
}

function parseTypeRank(value: string): {
  type?: string | null;
  rank?: string | null;
  hasInput: boolean;
} {
  const trimmed = value.trim();

  if (!trimmed) {
    return { hasInput: false };
  }

  const [typeRaw, rankRaw] = trimmed.split("|").map((part) => parseClearableOptional(part ?? ""));

  return {
    type: typeRaw,
    rank: rankRaw,
    hasInput: true
  };
}

function parseRequiredText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new JutsuRuleError([`Preencha o campo **${label}**.`]);
  }

  if (trimmed.length > maxLength) {
    throw new JutsuRuleError([`O campo **${label}** precisa ter no máximo ${maxLength} caracteres.`]);
  }

  return trimmed;
}

function parseOptionalText(value: string, maxLength: number): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new JutsuRuleError([`Um dos campos de texto passou de ${maxLength} caracteres.`]);
  }

  return trimmed;
}

function parseIntegerField(value: string, label: string, min: number): number {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  return parseRequiredInteger(trimmed, label, min);
}

function parseOptionalIntegerField(value: string, label: string, min: number): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return parseRequiredInteger(trimmed, label, min);
}

function parseRequiredInteger(value: string, label: string, min: number): number {
  if (!/^-?\d+$/.test(value)) {
    throw new JutsuRuleError([`O campo **${label}** precisa ser um número inteiro.`]);
  }

  const parsed = Number(value);

  if (parsed < min) {
    throw new JutsuRuleError([`O campo **${label}** precisa ser maior ou igual a ${min}.`]);
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

  throw new JutsuRuleError(["Status inválido. Use `ativo`, `inativo` ou deixe em branco para manter."]);
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
    throw new JutsuRuleError([`${label} precisa ser um objeto JSON. Exemplo: \`{"atributos":{"ninjutsu":5}}\`.`]);
  }
}

function parseClearableOptional(value: string): string | null | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return ["-", "limpar", "null", "nenhum", "nenhuma"].includes(trimmed.toLowerCase()) ? null : trimmed;
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
