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

import { generatePericiaCard, type PericiaEntry } from "../../services/cardGenerator.js";
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
import {
  PERICIA_MAX_XP,
  PericiaRuleError,
  computeMaxXpPerLevel,
  formatPericiaConfig,
  type PericiaConfig
} from "./PericiaService.js";

const CUSTOM_ID_PREFIX = "kaguya:pericias";

export async function buildPericiaPanel(
  services: CommandServices,
  guild: Guild,
  viewer: User,
  target: User,
  canManage: boolean
) {
  const character = await services.characters.findDisplayCharacter(guild, target);

  if (!character) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x805ad5)
          .setTitle(`Perícias de ${target.displayName}`)
          .setDescription(
            target.id === viewer.id
              ? "Você ainda não tem uma ficha ativa neste RPG."
              : "Esse jogador ainda não tem uma ficha ativa neste RPG."
          )
      ],
      components: []
    };
  }

  const components = buildComponents(canManage);
  const [progress, periciaConfig] = await Promise.all([
    services.pericias.listProgress(guild, character),
    services.pericias.getPericiaConfig(guild)
  ]);
  const maxXpPerLevel = computeMaxXpPerLevel(periciaConfig, character.rank?.key ?? null);

  try {
    const cardBuffer = await generatePericiaCard({
      characterName: character.name,
      ownerTag: target.displayName,
      pericias: progress.map(({ pericia, progress: entry }): PericiaEntry => ({
        key: pericia.key,
        name: pericia.name,
        level: entry.level,
        xp: entry.xp,
        maxXp: maxXpPerLevel,
        sortOrder: pericia.sortOrder
      }))
    });

    return {
      files: [{ attachment: cardBuffer, name: "pericias.png" }],
      embeds: [],
      components
    };
  } catch {
    return {
      embeds: [renderPericiaEmbed(target, character.name, progress, maxXpPerLevel)],
      components
    };
  }
}

function renderPericiaEmbed(
  target: User,
  characterName: string,
  progress: Awaited<ReturnType<CommandServices["pericias"]["listProgress"]>>,
  maxXpPerLevel: number = PERICIA_MAX_XP
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x805ad5)
    .setTitle(`Perícias de ${characterName}`)
    .setDescription(
      progress.length === 0
        ? "Nenhuma perícia configurada ainda."
        : progress
            .map(
              ({ pericia, progress: entry }) =>
                `**${pericia.name}** — Nv. ${entry.level} (${entry.xp}/${maxXpPerLevel} XP)`
            )
            .join("\n")
    )
    .setFooter({ text: target.displayName });
}

function buildComponents(isAdmin: boolean): ActionRowBuilder<ButtonBuilder>[] {
  if (!isAdmin) {
    return [];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:config`)
        .setLabel("Configurar XP")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:create`)
        .setLabel("Criar perícia")
        .setStyle(ButtonStyle.Secondary),
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
        .setCustomId(`${CUSTOM_ID_PREFIX}:adjust`)
        .setLabel("Ajustar XP/Nível")
        .setStyle(ButtonStyle.Success)
    )
  ];
}

export async function handlePericiaInteraction(
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

  if (!(await canUsePericiaPanel(interaction, services))) {
    await replyPrivately(interaction, "Você precisa ter Administrador ou Gerenciar Servidor para usar esse painel.");
    return true;
  }

  if (!(await services.guildConfig.isModuleEnabled(interaction.guild, "pericias"))) {
    await replyPrivately(interaction, "O módulo **Perícias** está desativado neste servidor.");
    return true;
  }

  if (interaction.isButton()) {
    await handlePericiaButton(interaction, services);
    return true;
  }

  await handlePericiaModal(interaction, services);
  return true;
}

async function canUsePericiaPanel(
  interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function handlePericiaButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);

  if (action === "config") {
    const config = await services.pericias.getPericiaConfig(interaction.guild);
    await interaction.showModal(buildPericiaConfigModal(config));
    return;
  }

  if (action === "create") {
    await interaction.showModal(buildCreatePericiaModal());
    return;
  }

  if (action === "edit") {
    await interaction.showModal(buildEditPericiaModal());
    return;
  }

  if (action === "toggle") {
    await interaction.showModal(buildTogglePericiaModal());
    return;
  }

  if (action === "adjust") {
    await interaction.showModal(buildAdjustPericiaModal());
    return;
  }

  await interaction.reply({
    content: "Ação desconhecida nesse painel.",
    flags: MessageFlags.Ephemeral
  });
}

async function handlePericiaModal(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const action = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:modal:`.length);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "config") {
    const baseXpPerUse = parseDecimal(interaction.fields.getTextInputValue("baseXpPerUse"));
    const multiplierEntries = splitPipeArgs(interaction.fields.getTextInputValue("rankMultipliers"));
    const caps = splitPipeArgs(interaction.fields.getTextInputValue("caps"));
    const dailyXpCap = parseInteger(caps[0]);
    const postCapXpGain = parseInteger(caps[1]);
    const rankXpRequiredRaw = interaction.fields.getTextInputValue("rankXpRequired").trim();

    if (baseXpPerUse === null || dailyXpCap === null || postCapXpGain === null) {
      await interaction.editReply(
        "Preencha o XP base, e o cap diário no formato `cap diário | ganho após o cap` com números válidos."
      );
      return;
    }

    const rankMultipliers = parseRankMultipliers(multiplierEntries);

    if (!rankMultipliers) {
      await interaction.editReply(
        "Informe os multiplicadores por rank no formato `E=0.5 | D=0.75 | C=1 | B=1.5 | A=2 | S=3`."
      );
      return;
    }

    const rankXpRequired = rankXpRequiredRaw ? parseRankXpRequired(splitPipeArgs(rankXpRequiredRaw)) : undefined;

    if (rankXpRequiredRaw && !rankXpRequired) {
      await interaction.editReply(
        "Informe o XP por patente no formato `genin=300 | chunin=1500 | jonin=3000` com valores inteiros positivos."
      );
      return;
    }

    const updated = await services.pericias.setPericiaConfig(interaction.guild, interaction.user.id, {
      baseXpPerUse,
      rankMultipliers,
      dailyXpCap,
      postCapXpGain,
      ...(rankXpRequired ? { rankXpRequired } : {})
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Configuração de perícias atualizada",
      description: formatPericiaConfig(updated)
    });
    await interaction.editReply(`Configuração de perícias atualizada:\n${formatPericiaConfig(updated)}`);
    return;
  }

  if (action === "create") {
    const key = normalizeKey(interaction.fields.getTextInputValue("key"));
    const name = interaction.fields.getTextInputValue("name").trim();
    const sortOrder = parseInteger(interaction.fields.getTextInputValue("sortOrder")) ?? 0;
    const description = optionalText(interaction.fields.getTextInputValue("description"));

    if (!key || !name) {
      await interaction.editReply("Preencha a chave e o nome da perícia.");
      return;
    }

    const existing = await services.pericias.findPericia(interaction.guild, key);

    if (existing) {
      await interaction.editReply(`Já existe uma perícia com a chave \`${key}\`.`);
      return;
    }

    const created = await services.pericias.createPericia(interaction.guild, interaction.user.id, {
      key,
      name,
      description,
      sortOrder
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Perícia criada",
      description: `Criada **${created.name}** \`[${created.key}]\` pelo painel.`
    });
    await interaction.editReply(`Perícia **${created.name}** criada.`);
    return;
  }

  if (action === "edit") {
    const key = normalizeKey(interaction.fields.getTextInputValue("key"));
    const name = optionalText(interaction.fields.getTextInputValue("name"));
    const sortOrder = parseOptionalInteger(interaction.fields.getTextInputValue("sortOrder"));
    const descriptionText = interaction.fields.getTextInputValue("description").trim();

    if (!key) {
      await interaction.editReply("Informe uma chave válida.");
      return;
    }

    if (sortOrder === null) {
      await interaction.editReply("Ordem inválida.");
      return;
    }

    const update: { name?: string; description?: string | null; sortOrder?: number } = {};

    if (name) {
      update.name = name;
    }

    if (descriptionText.length > 0) {
      update.description = ["-", "limpar", "null"].includes(descriptionText.toLowerCase())
        ? null
        : descriptionText;
    }

    if (sortOrder !== undefined) {
      update.sortOrder = sortOrder;
    }

    if (Object.keys(update).length === 0) {
      await interaction.editReply("Nenhum campo foi preenchido para editar.");
      return;
    }

    const updated = await services.pericias.updatePericia(interaction.guild, interaction.user.id, key, update);

    if (!updated) {
      await interaction.editReply(`Não encontrei perícia com chave \`${key}\`.`);
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Perícia editada",
      description: `Editada **${updated.name}** \`[${updated.key}]\` pelo painel.`
    });
    await interaction.editReply(`Perícia \`${updated.key}\` atualizada.`);
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

    const updated = await services.pericias.setPericiaActive(interaction.guild, interaction.user.id, key, isActive);

    if (!updated) {
      await interaction.editReply(`Não encontrei perícia com chave \`${key}\`.`);
      return;
    }

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: isActive ? "Perícia ativada" : "Perícia desativada",
      description: `**${updated.name}** \`[${updated.key}]\` pelo painel.`
    });
    await interaction.editReply(`Perícia \`${updated.key}\` ${isActive ? "ativada" : "desativada"}.`);
    return;
  }

  if (action === "adjust") {
    const targetUserId = parseUserId(interaction.fields.getTextInputValue("target"));
    const periciaKey = normalizeKey(interaction.fields.getTextInputValue("pericia"));
    const values = splitPipeArgs(interaction.fields.getTextInputValue("adjustment"));
    const xpDelta = parseOptionalInteger(values[0]);
    const level = parseOptionalInteger(values[1]);
    const reason = optionalText(interaction.fields.getTextInputValue("reason"));

    if (!targetUserId) {
      await interaction.editReply("Informe uma menção ou ID de usuário válido.");
      return;
    }

    if (!periciaKey) {
      await interaction.editReply("Informe a chave da perícia.");
      return;
    }

    if (xpDelta === undefined || level === undefined) {
      await interaction.editReply("Preencha o ajuste no formato `±XP | nível` com números válidos (deixe em branco o que não quiser alterar).");
      return;
    }

    try {
      const result = await services.pericias.adjustProgress(
        interaction.guild,
        interaction.user.id,
        targetUserId,
        periciaKey,
        {
          xpDelta: xpDelta ?? undefined,
          level: level ?? undefined,
          reason
        }
      );

      await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
        title: "Progresso de perícia ajustado",
        description: [
          `Ficha: **${result.character.name}** (<@${targetUserId}>)`,
          `Perícia: **${result.pericia.name}**`,
          `Progresso: **${result.log.xpBefore} XP / Nv. ${result.log.levelBefore}** -> **${result.log.xpAfter} XP / Nv. ${result.log.levelAfter}**`,
          reason ? `Motivo: ${reason}` : null
        ].filter((line): line is string => Boolean(line)).join("\n")
      });
      await interaction.editReply(
        `Perícia **${result.pericia.name}** de **${result.character.name}** ajustada para **${result.progress.xp}/${result.maxXpPerLevel} XP / Nv. ${result.progress.level}**.`
      );
    } catch (error) {
      if (error instanceof PericiaRuleError) {
        await interaction.editReply(error.errors.join("\n"));
        return;
      }

      throw error;
    }

    return;
  }

  await interaction.editReply("Modal desconhecido.");
}

function buildPericiaConfigModal(config: PericiaConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:config`)
    .setTitle("Configurar XP de perícias")
    .addComponents(
      textInputRow(
        "baseXpPerUse",
        "XP base por uso de jutsu",
        "4",
        TextInputStyle.Short,
        true,
        String(config.baseXpPerUse)
      ),
      textInputRow(
        "rankMultipliers",
        "Multiplicadores por rank (jutsu)",
        "E=0.5 | D=0.75 | C=1 | B=1.5 | A=2 | S=3",
        TextInputStyle.Short,
        true,
        Object.entries(config.rankMultipliers)
          .map(([rank, multiplier]) => `${rank}=${multiplier}`)
          .join(" | ")
      ),
      textInputRow(
        "caps",
        "Cap diário | Ganho após o cap",
        "40 | 1",
        TextInputStyle.Short,
        true,
        `${config.dailyXpCap} | ${config.postCapXpGain}`
      ),
      textInputRow(
        "rankXpRequired",
        "XP total por patente (chave=total)",
        "genin=300 | chunin=1500 | jonin=3000",
        TextInputStyle.Short,
        false,
        Object.entries(config.rankXpRequired)
          .map(([rank, xp]) => `${rank}=${xp}`)
          .join(" | ")
      )
    );
}

function buildCreatePericiaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:create`)
    .setTitle("Criar perícia")
    .addComponents(
      textInputRow("key", "Chave", "shurikenjutsu", TextInputStyle.Short, true),
      textInputRow("name", "Nome", "Shurikenjutsu", TextInputStyle.Short, true),
      textInputRow("sortOrder", "Ordem", "10", TextInputStyle.Short, false),
      textInputRow("description", "Descrição", "Domínio sobre armas de arremesso.", TextInputStyle.Paragraph, false)
    );
}

function buildEditPericiaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:edit`)
    .setTitle("Editar perícia")
    .addComponents(
      textInputRow("key", "Chave", "shurikenjutsu", TextInputStyle.Short, true),
      textInputRow("name", "Novo nome", "Shurikenjutsu", TextInputStyle.Short, false),
      textInputRow("sortOrder", "Ordem", "10", TextInputStyle.Short, false),
      textInputRow("description", "Descrição (- para limpar)", "Nova descrição", TextInputStyle.Paragraph, false)
    );
}

function buildTogglePericiaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:toggle`)
    .setTitle("Ativar ou desativar perícia")
    .addComponents(
      textInputRow("key", "Chave", "shurikenjutsu", TextInputStyle.Short, true),
      textInputRow("status", "Status", "ativar ou desativar", TextInputStyle.Short, true)
    );
}

function buildAdjustPericiaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:adjust`)
    .setTitle("Ajustar XP/Nível")
    .addComponents(
      textInputRow("target", "Jogador", "@jogador ou ID", TextInputStyle.Short, true),
      textInputRow("pericia", "Chave da perícia", "ninjutsu_elemental", TextInputStyle.Short, true),
      textInputRow("adjustment", "±XP | Nível", "+20 | 3", TextInputStyle.Short, true),
      textInputRow("reason", "Motivo", "Recompensa de evento, correção...", TextInputStyle.Paragraph, false)
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

function parseUserId(value: string): string | null {
  const userId = value.replace(/\D/g, "");
  return /^\d{15,25}$/.test(userId) ? userId : null;
}

function parseRankMultipliers(entries: string[]): Record<string, number> | null {
  if (entries.length === 0) {
    return null;
  }

  const multipliers: Record<string, number> = {};

  for (const entry of entries) {
    const [rankRaw, valueRaw] = entry.split("=");
    const rank = rankRaw?.trim().toUpperCase();
    const multiplier = parseDecimal(valueRaw);

    if (!rank || multiplier === null) {
      return null;
    }

    multipliers[rank] = multiplier;
  }

  return multipliers;
}

function parseRankXpRequired(entries: string[]): Record<string, number> | null {
  if (entries.length === 0) {
    return null;
  }

  const result: Record<string, number> = {};

  for (const entry of entries) {
    const eqIdx = entry.indexOf("=");
    if (eqIdx <= 0) return null;
    const rank = entry.slice(0, eqIdx).trim().toLowerCase();
    const xp = parseInteger(entry.slice(eqIdx + 1));

    if (!rank || xp === null || xp <= 0) {
      return null;
    }

    result[rank] = xp;
  }

  return Object.keys(result).length > 0 ? result : null;
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
