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

import type { Character } from "../../generated/prisma/client.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:characters";

export async function buildCharacterPanel(
  services: CommandServices,
  guild: Guild,
  viewer: User,
  target: User
) {
  const character = await services.characters.findDisplayCharacter(guild, target);

  if (!character) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x805ad5)
          .setTitle(`Ficha de ${target.displayName}`)
          .setDescription(
            target.id === viewer.id
              ? "Voce ainda nao tem uma ficha ativa neste RPG."
              : "Esse jogador ainda nao tem uma ficha ativa neste RPG."
          )
      ],
      components:
        target.id === viewer.id
          ? [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`${CUSTOM_ID_PREFIX}:create`)
                  .setLabel("Criar ficha")
                  .setStyle(ButtonStyle.Primary)
              )
            ]
          : []
    };
  }

  return {
    embeds: [renderCharacterEmbed(services, target, character)],
    components:
      target.id === viewer.id
        ? [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:edit`)
                .setLabel("Editar ficha")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`${CUSTOM_ID_PREFIX}:refreshAttributes`)
                .setLabel("Recalcular atributos")
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        : []
  };
}

export async function handleCharacterInteraction(
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
    await replyPrivately(interaction, "Esse painel so pode ser usado dentro de um servidor.");
    return true;
  }

  if (interaction.isButton()) {
    await handleCharacterButton(interaction, services);
    return true;
  }

  await handleCharacterModal(interaction, services);
  return true;
}

function renderCharacterEmbed(
  services: CommandServices,
  user: User,
  character: Character
): EmbedBuilder {
  const metadata = services.characters.getMetadata(character);
  const attributes = services.characters.getAttributeValues(character);
  const attributeLines = Object.entries(attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `\`${key}\`: **${value}**`);

  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
    .setTitle(character.name)
    .setDescription(metadata.concept ?? "Sem conceito definido.")
    .addFields({
      name: "Atributos",
      value: attributeLines.length > 0 ? attributeLines.join("\n") : "Nenhum atributo salvo."
    })
    .setFooter({ text: `Dono: ${user.id}` })
    .setTimestamp(character.updatedAt);

  if (metadata.imageUrl) {
    embed.setImage(metadata.imageUrl);
  }

  return embed;
}

async function handleCharacterButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);

  if (action === "create") {
    const existing = await services.characters.findActiveByUser(interaction.guild, interaction.user.id);

    if (existing) {
      await interaction.reply({
        content: "Voce ja tem uma ficha ativa neste servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.showModal(buildCreateCharacterModal());
    return;
  }

  if (action === "edit") {
    const existing = await services.characters.findActiveByUser(interaction.guild, interaction.user.id);

    if (!existing) {
      await interaction.reply({
        content: "Voce ainda nao tem uma ficha ativa neste servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.showModal(buildEditCharacterModal(services, existing));
    return;
  }

  if (action === "refreshAttributes") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const updated = await services.characters.refreshCharacterAttributes(interaction.guild, interaction.user);

    if (!updated) {
      await interaction.editReply("Voce ainda nao tem uma ficha ativa neste servidor.");
      return;
    }

    await interaction.editReply({
      content: "Atributos e Chakra recalculados com a configuracao atual do servidor.",
      embeds: [renderCharacterEmbed(services, interaction.user, updated)]
    });
    return;
  }

  await interaction.reply({
    content: "Acao desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleCharacterModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  if (!["create", "edit"].includes(action)) {
    await interaction.reply({
      content: "Modal desconhecido.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "edit") {
    const name = optionalText(interaction.fields.getTextInputValue("name"));
    const conceptValue = interaction.fields.getTextInputValue("concept").trim();
    const imageUrlValue = interaction.fields.getTextInputValue("imageUrl").trim();
    const concept = conceptValue.length === 0 ? undefined : clearableText(conceptValue);
    const imageUrl = imageUrlValue.length === 0 ? undefined : clearableText(imageUrlValue);

    if (name && (name.length < 2 || name.length > 80)) {
      await interaction.editReply("O nome da ficha precisa ter entre 2 e 80 caracteres.");
      return;
    }

    if (typeof imageUrl === "string" && !isValidHttpUrl(imageUrl)) {
      await interaction.editReply("A imagem precisa ser uma URL http ou https valida.");
      return;
    }

    if (!name && concept === undefined && imageUrl === undefined) {
      await interaction.editReply("Preencha pelo menos um campo para editar.");
      return;
    }

    const updated = await services.characters.updateCharacterDetails(interaction.guild, interaction.user, {
      name,
      concept,
      imageUrl
    });

    if (!updated) {
      await interaction.editReply("Voce ainda nao tem uma ficha ativa neste servidor.");
      return;
    }

    await interaction.editReply({
      content: "Ficha atualizada.",
      embeds: [renderCharacterEmbed(services, interaction.user, updated)]
    });
    return;
  }

  const existing = await services.characters.findActiveByUser(interaction.guild, interaction.user.id);

  if (existing) {
    await interaction.editReply("Voce ja tem uma ficha ativa neste servidor.");
    return;
  }

  const name = interaction.fields.getTextInputValue("name").trim();
  const concept = optionalText(interaction.fields.getTextInputValue("concept"));
  const imageUrl = optionalText(interaction.fields.getTextInputValue("imageUrl"));

  if (name.length < 2 || name.length > 80) {
    await interaction.editReply("O nome da ficha precisa ter entre 2 e 80 caracteres.");
    return;
  }

  if (imageUrl && !isValidHttpUrl(imageUrl)) {
    await interaction.editReply("A imagem precisa ser uma URL http ou https valida.");
    return;
  }

  const created = await services.characters.createCharacter(interaction.guild, interaction.user, {
    name,
    concept,
    imageUrl
  });

  await interaction.editReply({
    content: "Ficha criada.",
    embeds: [renderCharacterEmbed(services, interaction.user, created)]
  });
}

function buildCreateCharacterModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:create`)
    .setTitle("Criar ficha")
    .addComponents(
      textInputRow("name", "Nome do personagem", "Hatake Kaito", TextInputStyle.Short, true),
      textInputRow(
        "concept",
        "Conceito",
        "Genin especialista em taijutsu e perseguicao.",
        TextInputStyle.Paragraph,
        false
      ),
      textInputRow("imageUrl", "URL da imagem", "https://...", TextInputStyle.Short, false)
    );
}

function buildEditCharacterModal(services: CommandServices, character: Character): ModalBuilder {
  const metadata = services.characters.getMetadata(character);

  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:edit`)
    .setTitle("Editar ficha")
    .addComponents(
      textInputRow(
        "name",
        "Nome do personagem",
        "Hatake Kaito",
        TextInputStyle.Short,
        false,
        character.name
      ),
      textInputRow(
        "concept",
        "Conceito (- para limpar)",
        "Genin especialista em taijutsu.",
        TextInputStyle.Paragraph,
        false,
        metadata.concept
      ),
      textInputRow(
        "imageUrl",
        "URL da imagem (- para limpar)",
        "https://...",
        TextInputStyle.Short,
        false,
        metadata.imageUrl
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

function clearableText(value: string): string | null {
  return ["-", "limpar", "null"].includes(value.toLowerCase()) ? null : value;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
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
