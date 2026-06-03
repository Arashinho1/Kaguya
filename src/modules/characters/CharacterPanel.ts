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

import { CharacterRuleError, type CharacterWithRelations } from "./CharacterService.js";
import { generateProfileCard } from "../../services/cardGenerator.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:characters";

/** Atributos legados que foram removidos dos defaults mas podem existir em dados antigos */
const LEGACY_ATTR_KEYS = new Set(["stamina", "inteligencia"]);

export async function buildCharacterPanel(
  services: CommandServices,
  guild: Guild,
  viewer: User,
  target: User
) {
  const character = await services.characters.findDisplayCharacter(guild, target);

  if (!character) {
    const inactiveCharacter =
      target.id === viewer.id ? await services.characters.findLatestByUser(guild, target.id) : null;

    if (inactiveCharacter && !inactiveCharacter.isActive) {
      return {
        embeds: [renderCharacterEmbed(services, target, inactiveCharacter)],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID_PREFIX}:reactivate`)
              .setLabel("Reativar ficha")
              .setStyle(ButtonStyle.Primary)
          )
        ]
      };
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x805ad5)
          .setTitle(`Ficha de ${target.displayName}`)
          .setDescription(
            target.id === viewer.id
              ? "Você ainda não tem uma ficha ativa neste RPG."
              : "Esse jogador ainda não tem uma ficha ativa neste RPG."
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

  // Botões de ação
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:edit`)
      .setLabel("Editar ficha")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:refreshAttributes`)
      .setLabel("Recalcular atributos")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}:deactivate`)
      .setLabel("Desativar ficha")
      .setStyle(ButtonStyle.Danger)
  );
  const components = target.id === viewer.id ? [actionRow] : [];

  // Tentar gerar card de imagem
  try {
    const attrDefs  = await services.attributes.listAttributes(guild);
    const attrVals  = services.characters.getAttributeValues(character);
    const metadata  = services.characters.getMetadata(character);

    const cardBuffer = await generateProfileCard({
      characterName: character.name,
      concept:       metadata.concept ?? undefined,
      villageName:   character.village?.name ?? undefined,
      clanName:      character.clan?.name    ?? undefined,
      rankName:      character.rank?.name    ?? undefined,
      isActive:      character.isActive,
      imageUrl:      metadata.imageUrl       ?? undefined,
      ownerTag:      target.displayName,
      attributes:    attrDefs
        .filter(def => !LEGACY_ATTR_KEYS.has(def.key))
        .map(def => ({
          key:      def.key,
          name:     def.name,
          value:    attrVals[def.key] ?? 0,
          maxValue: def.maxValue ?? 200,
          sortOrder: def.sortOrder
        }))
    });

    return {
      files: [{ attachment: cardBuffer, name: "perfil.png" }],
      embeds: [],
      components
    };
  } catch {
    // Fallback: embed de texto caso canvas falhe
    return {
      embeds: [renderCharacterEmbed(services, target, character)],
      components
    };
  }
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
    await replyPrivately(interaction, "Esse painel só pode ser usado dentro de um servidor.");
    return true;
  }

  if (!(await services.guildConfig.isModuleEnabled(interaction.guild, "characters"))) {
    await replyPrivately(interaction, "O módulo **Fichas** está desativado neste servidor.");
    return true;
  }

  if (interaction.isButton()) {
    try {
      await handleCharacterButton(interaction, services);
    } catch (error) {
      if (error instanceof CharacterRuleError) {
        await replyPrivately(interaction, error.message);
        return true;
      }

      throw error;
    }
    return true;
  }

  try {
    await handleCharacterModal(interaction, services);
  } catch (error) {
    if (error instanceof CharacterRuleError) {
      await replyPrivately(interaction, error.message);
      return true;
    }

    throw error;
  }
  return true;
}

function renderCharacterEmbed(
  services: CommandServices,
  user: User,
  character: CharacterWithRelations
): EmbedBuilder {
  const metadata = services.characters.getMetadata(character);
  const attributes = services.characters.getAttributeValues(character);
  const worldEffectSummary = services.characters.getWorldEffectSummary(character);
  const attributeLines = Object.entries(attributes)
    .filter(([key]) => !LEGACY_ATTR_KEYS.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `\`${key}\`: **${value}**`);

  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
    .setTitle(character.name)
    .setDescription(metadata.concept ?? "Sem conceito definido.")
    .addFields(
      {
        name: "Identidade",
        value: [
          `Status: **${character.isActive ? "Ativa" : "Inativa"}**`,
          `Clã: **${character.clan?.name ?? "Não definido"}**`,
          `Vila: **${character.village?.name ?? "Não definida"}**`,
          `Rank: **${character.rank?.name ?? "Não definido"}**`
        ].join("\n")
      },
      {
        name: "Atributos",
        value: attributeLines.length > 0 ? attributeLines.join("\n") : "Nenhum atributo salvo."
      }
    )
    .setFooter({ text: `Dono: ${user.id}` })
    .setTimestamp(character.updatedAt);

  if (metadata.imageUrl) {
    embed.setImage(metadata.imageUrl);
  }

  if (worldEffectSummary) {
    embed.addFields({
      name: "Bônus ativos",
      value: worldEffectSummary
    });
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
        content: "Você já tem uma ficha ativa neste servidor.",
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
        content: "Você ainda não tem uma ficha ativa neste servidor.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.showModal(buildEditCharacterModal(services, existing));
    return;
  }

  if (action === "reactivate") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const updated = await services.characters.setCharacterActive(interaction.guild, interaction.user, true);

    if (!updated) {
      await interaction.editReply("Não encontrei uma ficha para reativar.");
      return;
    }

    await interaction.editReply({
      content: "Ficha reativada.",
      embeds: [renderCharacterEmbed(services, interaction.user, updated)]
    });
    return;
  }

  if (action === "deactivate") {
    await interaction.showModal(buildDeactivateCharacterModal());
    return;
  }

  if (action === "refreshAttributes") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const updated = await services.characters.refreshCharacterAttributes(interaction.guild, interaction.user);

    if (!updated) {
      await interaction.editReply("Você ainda não tem uma ficha ativa neste servidor.");
      return;
    }

    await interaction.editReply({
      content: "Atributos e Chakra recalculados com a configuração atual do servidor.",
      embeds: [renderCharacterEmbed(services, interaction.user, updated)]
    });
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handleCharacterModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  if (!["create", "edit", "deactivate"].includes(action)) {
    await interaction.reply({
      content: "Modal desconhecido.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "deactivate") {
    const confirmation = interaction.fields.getTextInputValue("confirmation").trim().toLowerCase();

    if (confirmation !== "desativar") {
      await interaction.editReply("Escreva `desativar` para confirmar.");
      return;
    }

    const updated = await services.characters.setCharacterActive(interaction.guild, interaction.user, false);

    if (!updated) {
      await interaction.editReply("Você ainda não tem uma ficha ativa neste servidor.");
      return;
    }

    await interaction.editReply({
      content: "Ficha desativada.",
      embeds: [renderCharacterEmbed(services, interaction.user, updated)]
    });
    return;
  }

  if (action === "edit") {
    const name = optionalText(interaction.fields.getTextInputValue("name"));
    const conceptValue = interaction.fields.getTextInputValue("concept").trim();
    const imageUrlValue = interaction.fields.getTextInputValue("imageUrl").trim();
    const concept = conceptValue.length === 0 ? undefined : clearableText(conceptValue);
    const imageUrl = imageUrlValue.length === 0 ? undefined : clearableText(imageUrlValue);
    const clan = parseClearableOptional(interaction.fields.getTextInputValue("clan"));
    const links = await resolveLinksFromFields(
      services,
      interaction,
      clan,
      interaction.fields.getTextInputValue("villageRank")
    );

    if (name && (name.length < 2 || name.length > 80)) {
      await interaction.editReply("O nome da ficha precisa ter entre 2 e 80 caracteres.");
      return;
    }

    if (typeof imageUrl === "string" && !isValidHttpUrl(imageUrl)) {
      await interaction.editReply("A imagem precisa ser uma URL http ou https válida.");
      return;
    }

    if (!name && concept === undefined && imageUrl === undefined) {
      if (!links.hasInput) {
        await interaction.editReply("Preencha pelo menos um campo para editar.");
        return;
      }
    }

    if (links.errors.length > 0) {
      await interaction.editReply(links.errors.join("\n"));
      return;
    }

    const updated = await services.characters.updateCharacterDetails(interaction.guild, interaction.user, {
      name,
      concept,
      imageUrl,
      clanId: links.clanId,
      villageId: links.villageId,
      rankId: links.rankId
    });

    if (!updated) {
      await interaction.editReply("Você ainda não tem uma ficha ativa neste servidor.");
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
    await interaction.editReply("Você já tem uma ficha ativa neste servidor.");
    return;
  }

  const name = interaction.fields.getTextInputValue("name").trim();
  const concept = optionalText(interaction.fields.getTextInputValue("concept"));
  const imageUrl = optionalText(interaction.fields.getTextInputValue("imageUrl"));
  const links = await resolveLinksFromFields(
    services,
    interaction,
    parseClearableOptional(interaction.fields.getTextInputValue("clan")),
    interaction.fields.getTextInputValue("villageRank")
  );

  if (name.length < 2 || name.length > 80) {
    await interaction.editReply("O nome da ficha precisa ter entre 2 e 80 caracteres.");
    return;
  }

  if (imageUrl && !isValidHttpUrl(imageUrl)) {
    await interaction.editReply("A imagem precisa ser uma URL http ou https válida.");
    return;
  }

  if (links.errors.length > 0) {
    await interaction.editReply(links.errors.join("\n"));
    return;
  }

  const created = await services.characters.createCharacter(interaction.guild, interaction.user, {
    name,
    concept,
    imageUrl,
    clanId: links.clanId,
    villageId: links.villageId,
    rankId: links.rankId
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
        "Genin especialista em taijutsu e perseguição.",
        TextInputStyle.Paragraph,
        false
      ),
      textInputRow("imageUrl", "URL da imagem", "https://...", TextInputStyle.Short, false),
      textInputRow("clan", "Clã", "Uchiha", TextInputStyle.Short, false),
      textInputRow("villageRank", "Vila | Rank", "Konoha | genin", TextInputStyle.Short, false)
    );
}

function buildEditCharacterModal(services: CommandServices, character: CharacterWithRelations): ModalBuilder {
  const metadata = services.characters.getMetadata(character);
  const villageRankValue = formatVillageRankValue(character);

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
      ),
      textInputRow(
        "clan",
        "Clã (- para limpar)",
        "Uchiha",
        TextInputStyle.Short,
        false,
        character.clan?.name
      ),
      textInputRow(
        "villageRank",
        "Vila | Rank (- limpa)",
        "Konoha | genin",
        TextInputStyle.Short,
        false,
        villageRankValue
      )
    );
}

function buildDeactivateCharacterModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:deactivate`)
    .setTitle("Desativar ficha")
    .addComponents(
      textInputRow("confirmation", "Confirmação", "desativar", TextInputStyle.Short, true)
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

function parseClearableOptional(value: string): string | null | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  return clearableText(trimmed);
}

async function resolveLinksFromFields(
  services: CommandServices,
  interaction: ModalSubmitInteraction<"cached">,
  clan: string | null | undefined,
  villageRankRaw: string
) {
  const villageRank = parseVillageRank(villageRankRaw);
  const hasInput = clan !== undefined || villageRank.village !== undefined || villageRank.rank !== undefined;
  const resolved = await services.characters.resolveCharacterLinks(interaction.guild, {
    clan,
    village: villageRank.village,
    rank: villageRank.rank
  });

  return {
    ...resolved,
    hasInput
  };
}

function parseVillageRank(value: string): { village?: string | null; rank?: string | null } {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {};
  }

  const [villageRaw, rankRaw] = trimmed.split("|").map((part) => parseClearableOptional(part ?? ""));

  return {
    village: villageRaw,
    rank: rankRaw
  };
}

function formatVillageRankValue(character: CharacterWithRelations): string | undefined {
  if (!character.village && !character.rank) {
    return undefined;
  }

  return `${character.village?.name ?? ""} | ${character.rank?.key ?? character.rank?.name ?? ""}`;
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
