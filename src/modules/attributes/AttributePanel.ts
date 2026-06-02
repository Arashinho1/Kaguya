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
  type Interaction,
  type ModalSubmitInteraction
} from "discord.js";

import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import type { CommandServices } from "../../types/command.js";
import {
  normalizeKey,
  parseDecimal,
  parseInteger,
  parseOptionalInteger,
  splitPipeArgs
} from "../../utils/text.js";
import { formatChakraFormula, type ChakraFormula } from "./AttributeService.js";

const CUSTOM_ID_PREFIX = "kaguya:attributes";

export async function buildAttributePanel(
  services: CommandServices,
  guild: Parameters<CommandServices["attributes"]["listAttributes"]>[0],
  prefix: string
) {
  const [attributes, formula] = await Promise.all([
    services.attributes.listAttributes(guild, { includeInactive: true }),
    services.attributes.getChakraFormula(guild)
  ]);

  const activeCount = attributes.filter((attribute) => attribute.isActive).length;
  const preview =
    attributes.length === 0
      ? "Nenhum atributo configurado ainda."
      : attributes
          .slice(0, 8)
          .map(
            (attribute) =>
              `**${attribute.name}** \`[${attribute.key}]\` ${attribute.isActive ? "" : "(inativo)"}`
          )
          .join("\n");

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x805ad5)
        .setTitle("Painel de atributos")
        .setDescription(
          [
            "Configure os atributos deste RPG sem mexer no código.",
            "",
            `Ativos: **${activeCount}** | Total: **${attributes.length}**`,
            "",
            preview,
            "",
            `Chakra: \`${formatChakraFormula(formula)}\``
          ].join("\n")
        )
        .addFields({
          name: "Atalhos por texto",
          value: [
            `\`${prefix}atributo listar\``,
            `\`${prefix}atributo criar chave | Nome | base | min | max | descrição\``,
            `\`${prefix}atributo chakra\``
          ].join("\n")
        })
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:list`)
          .setLabel("Listar")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:create`)
          .setLabel("Criar")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:edit`)
          .setLabel("Editar")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:toggle`)
          .setLabel("Ativar/desativar")
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:chakra`)
          .setLabel("Fórmula de chakra")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:delete`)
          .setLabel("Remover")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

export async function handleAttributeInteraction(
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

  if (!(await canUseAttributePanel(interaction, services))) {
    await replyPrivately(interaction, "Você precisa ter Administrador ou Gerenciar Servidor para usar esse painel.");
    return true;
  }

  if (!(await services.guildConfig.isModuleEnabled(interaction.guild, "attributes"))) {
    await replyPrivately(interaction, "O módulo **Atributos e Chakra** está desativado neste servidor.");
    return true;
  }

  if (interaction.isButton()) {
    await handleAttributeButton(interaction, services);
    return true;
  }

  await handleAttributeModal(interaction, services);
  return true;
}

async function canUseAttributePanel(
  interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function handleAttributeButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);

  if (action === "list") {
    const [attributes, formula] = await Promise.all([
      services.attributes.listAttributes(interaction.guild, { includeInactive: true }),
      services.attributes.getChakraFormula(interaction.guild)
    ]);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2f855a)
          .setTitle("Atributos configurados")
          .setDescription(
            attributes.length === 0
              ? "Nenhum atributo configurado."
              : attributes
                  .map(
                    (attribute) =>
                      `**${attribute.name}** \`[${attribute.key}]\` ${attribute.isActive ? "" : "(inativo)"}\nBase: ${attribute.baseValue} | Min: ${attribute.minValue} | Max: ${attribute.maxValue ?? "sem limite"} | Ordem: ${attribute.sortOrder}`
                  )
                  .join("\n\n")
          )
          .addFields({ name: "Fórmula de Chakra", value: `\`${formatChakraFormula(formula)}\`` })
      ],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (action === "create") {
    await interaction.showModal(buildCreateAttributeModal());
    return;
  }

  if (action === "edit") {
    await interaction.showModal(buildEditAttributeModal());
    return;
  }

  if (action === "toggle") {
    await interaction.showModal(buildToggleAttributeModal());
    return;
  }

  if (action === "delete") {
    await interaction.showModal(buildDeleteAttributeModal());
    return;
  }

  if (action === "chakra") {
    const formula = await services.attributes.getChakraFormula(interaction.guild);
    await interaction.showModal(buildChakraFormulaModal(formula));
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleAttributeModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "create") {
    const key = normalizeKey(interaction.fields.getTextInputValue("key"));
    const name = interaction.fields.getTextInputValue("name").trim();
    const values = splitPipeArgs(interaction.fields.getTextInputValue("values"));
    const baseValue = parseInteger(values[0]) ?? 0;
    const minValue = parseInteger(values[1]) ?? 0;
    const maxValue = parseOptionalInteger(values[2]);
    const sortOrder = parseInteger(values[3]) ?? 0;
    const description = optionalText(interaction.fields.getTextInputValue("description"));

    if (!key || !name || maxValue === undefined) {
      await interaction.editReply("Preencha chave, nome e valores no formato `base | min | max | ordem`.");
      return;
    }

    if (maxValue !== null && maxValue < minValue) {
      await interaction.editReply("O valor máximo não pode ser menor que o mínimo.");
      return;
    }

    const existing = await services.attributes.findAttribute(interaction.guild, key);

    if (existing) {
      await interaction.editReply(`Já existe um atributo com a chave \`${key}\`.`);
      return;
    }

    const created = await services.attributes.createAttribute(interaction.guild, interaction.user.id, {
      key,
      name,
      baseValue,
      minValue,
      maxValue,
      sortOrder,
      description
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Atributo criado",
      description: `Criado **${created.name}** \`[${created.key}]\` pelo painel.`
    });
    await interaction.editReply(`Atributo **${created.name}** criado.`);
    return;
  }

  if (action === "edit") {
    const key = normalizeKey(interaction.fields.getTextInputValue("key"));
    const name = optionalText(interaction.fields.getTextInputValue("name"));
    const valuesText = optionalText(interaction.fields.getTextInputValue("values"));
    const descriptionText = interaction.fields.getTextInputValue("description").trim();

    if (!key) {
      await interaction.editReply("Informe uma chave válida.");
      return;
    }

    const update: {
      name?: string;
      description?: string | null;
      baseValue?: number;
      minValue?: number;
      maxValue?: number | null;
      sortOrder?: number;
    } = {};

    if (name) {
      update.name = name;
    }

    if (descriptionText.length > 0) {
      update.description = ["-", "limpar", "null"].includes(descriptionText.toLowerCase())
        ? null
        : descriptionText;
    }

    if (valuesText) {
      const values = splitPipeArgs(valuesText);
      const baseValue = parseInteger(values[0]);
      const minValue = parseInteger(values[1]);
      const maxValue = parseOptionalInteger(values[2]);
      const sortOrder = parseInteger(values[3]);

      if (values[0] && baseValue === null) {
        await interaction.editReply("Base inválida.");
        return;
      }

      if (values[1] && minValue === null) {
        await interaction.editReply("Mínimo inválido.");
        return;
      }

      if (maxValue === undefined) {
        await interaction.editReply("Máximo inválido.");
        return;
      }

      if (values[3] && sortOrder === null) {
        await interaction.editReply("Ordem inválida.");
        return;
      }

      if (baseValue !== null) {
        update.baseValue = baseValue;
      }

      if (minValue !== null) {
        update.minValue = minValue;
      }

      if (values[2]) {
        update.maxValue = maxValue;
      }

      if (sortOrder !== null) {
        update.sortOrder = sortOrder;
      }
    }

    if (Object.keys(update).length === 0) {
      await interaction.editReply("Nenhum campo foi preenchido para editar.");
      return;
    }

    const updated = await services.attributes.updateAttribute(
      interaction.guild,
      interaction.user.id,
      key,
      update
    );

    if (!updated) {
      await interaction.editReply(`Não encontrei atributo com chave \`${key}\`.`);
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Atributo editado",
      description: `Editado **${updated.name}** \`[${updated.key}]\` pelo painel.`
    });
    await interaction.editReply(`Atributo \`${updated.key}\` atualizado.`);
    return;
  }

  if (action === "toggle") {
    const key = normalizeKey(interaction.fields.getTextInputValue("key"));
    const status = interaction.fields.getTextInputValue("status").trim().toLowerCase();
    const isActive = status === "ativar" ? true : status === "desativar" ? false : null;

    if (!key || isActive === null) {
      await interaction.editReply("Informe a chave e use status `ativar` ou `desativar`.");
      return;
    }

    const updated = await services.attributes.setAttributeActive(
      interaction.guild,
      interaction.user.id,
      key,
      isActive
    );

    if (!updated) {
      await interaction.editReply(`Não encontrei atributo com chave \`${key}\`.`);
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: isActive ? "Atributo ativado" : "Atributo desativado",
      description: `**${updated.name}** \`[${updated.key}]\` pelo painel.`
    });
    await interaction.editReply(`Atributo \`${updated.key}\` ${isActive ? "ativado" : "desativado"}.`);
    return;
  }

  if (action === "delete") {
    const key = normalizeKey(interaction.fields.getTextInputValue("key"));
    const confirmation = interaction.fields.getTextInputValue("confirmation").trim().toLowerCase();

    if (!key || confirmation !== "confirmar") {
      await interaction.editReply("Informe a chave e escreva `confirmar`.");
      return;
    }

    const deleted = await services.attributes.deleteAttribute(interaction.guild, interaction.user.id, key);

    if (!deleted) {
      await interaction.editReply(`Não encontrei atributo com chave \`${key}\`.`);
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Atributo removido",
      description: `Removido **${deleted.name}** \`[${deleted.key}]\` pelo painel.`
    });
    await interaction.editReply(`Atributo \`${deleted.key}\` removido.`);
    return;
  }

  if (action === "chakra") {
    const sourceKeys = interaction.fields
      .getTextInputValue("sourceKeys")
      .split(",")
      .map((key) => normalizeKey(key))
      .filter((key): key is string => Boolean(key));
    const multipliers = splitPipeArgs(interaction.fields.getTextInputValue("multipliers"));
    const sourceMultiplier = parseDecimal(multipliers[0]);
    const isolatedMultiplier = parseDecimal(multipliers[1]);
    const directBonus = parseDecimal(interaction.fields.getTextInputValue("directBonus"));

    if (
      sourceKeys.length === 0 ||
      sourceMultiplier === null ||
      isolatedMultiplier === null ||
      directBonus === null
    ) {
      await interaction.editReply(
        "Preencha atributos, multiplicadores no formato `multiplicador_soma | multiplicador_isolado` e bônus direto."
      );
      return;
    }

    const formula = await services.attributes.setChakraFormula(interaction.guild, interaction.user.id, {
      sourceAttributeKeys: sourceKeys,
      sourceMultiplier,
      isolatedMultiplier,
      directBonus
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Fórmula de chakra atualizada",
      description: `Nova fórmula: \`${formatChakraFormula(formula)}\`.`
    });
    await interaction.editReply(`Fórmula de chakra atualizada: \`${formatChakraFormula(formula)}\`.`);
    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function buildCreateAttributeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:create`)
    .setTitle("Criar atributo")
    .addComponents(
      textInputRow("key", "Chave", "forca", TextInputStyle.Short, true),
      textInputRow("name", "Nome", "Força", TextInputStyle.Short, true),
      textInputRow("values", "Base | Min | Max | Ordem", "0 | 0 | 100 | 10", TextInputStyle.Short, true),
      textInputRow("description", "Descrição", "Atributo físico base.", TextInputStyle.Paragraph, false)
    );
}

function buildEditAttributeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:edit`)
    .setTitle("Editar atributo")
    .addComponents(
      textInputRow("key", "Chave", "forca", TextInputStyle.Short, true),
      textInputRow("name", "Novo nome", "Força", TextInputStyle.Short, false),
      textInputRow("values", "Base | Min | Max | Ordem", "10 | 0 | 100 | 10", TextInputStyle.Short, false),
      textInputRow("description", "Descrição (- para limpar)", "Nova descrição", TextInputStyle.Paragraph, false)
    );
}

function buildToggleAttributeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:toggle`)
    .setTitle("Ativar ou desativar atributo")
    .addComponents(
      textInputRow("key", "Chave", "forca", TextInputStyle.Short, true),
      textInputRow("status", "Status", "ativar ou desativar", TextInputStyle.Short, true)
    );
}

function buildDeleteAttributeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:delete`)
    .setTitle("Remover atributo")
    .addComponents(
      textInputRow("key", "Chave", "forca", TextInputStyle.Short, true),
      textInputRow("confirmation", "Confirmação", "confirmar", TextInputStyle.Short, true)
    );
}

function buildChakraFormulaModal(formula: ChakraFormula): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:chakra`)
    .setTitle("Fórmula de chakra")
    .addComponents(
      textInputRow(
        "sourceKeys",
        "Atributos somados",
        "forca, velocidade, resistencia",
        TextInputStyle.Short,
        true,
        formula.sourceAttributeKeys.join(", ")
      ),
      textInputRow(
        "multipliers",
        "Multiplicador soma | isolado",
        "1 | 1",
        TextInputStyle.Short,
        true,
        `${formula.sourceMultiplier} | ${formula.isolatedMultiplier}`
      ),
      textInputRow(
        "directBonus",
        "Bônus direto no chakra",
        "0",
        TextInputStyle.Short,
        true,
        String(formula.directBonus)
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

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
