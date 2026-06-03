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
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type User
} from "discord.js";

import { JutsuRuleError, type ChakraAdjustMode, type JutsuWithRelations, type LearnedJutsuWithRelations } from "./JutsuService.js";
import { hasConfiguredAdminRole, hasManageGuildPermission } from "../../services/permissions.js";
import { sendStaffLogForGuild } from "../../services/staffLog.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:jutsus";
const PAGE_SIZE = 6;

type JutsuPage = "home" | "catalog" | "known" | "admin";

// ─── State encoding: catalog:PAGE:TYPE:RANK ──────────────────────────────────
// TYPE e RANK usam "_" para "sem filtro"

interface ActionState {
  type: string;
  pageNum: number;
  filterType: string;
  filterRank: string;
}

function parseAction(raw: string): ActionState {
  const parts = raw.split(":");
  const type       = parts[0] ?? "home";
  const pageNum    = parseInt(parts[1] ?? "0", 10) || 0;
  const filterType = parts[2] ?? "_";
  const filterRank = parts[3] ?? "_";
  return { type, pageNum, filterType, filterRank };
}

/** Monta o customId de paginação do catálogo */
function cid(page: number, fType: string, fRank: string): string {
  return `${CUSTOM_ID_PREFIX}:catalog:${page}:${fType}:${fRank}`;
}

const RANK_LABELS: Record<string, string> = {
  e: "Rank E", d: "Rank D", c: "Rank C",
  b: "Rank B", a: "Rank A", s: "Rank S"
};

export async function buildJutsuPanel(
  services: CommandServices,
  guild: Guild,
  user: User,
  canManage: boolean,
  page: JutsuPage = "home",
  pageNum = 0,
  filterType = "_",
  filterRank = "_"
) {
  const { embed, totalPages } = await buildJutsuEmbed(
    services, guild, user, page, pageNum, filterType, filterRank
  );

  // Tipos de jutsu para o dropdown (só precisa no catálogo)
  const jutsuTypes = page === "catalog"
    ? await services.world.listJutsuTypes(guild).catch(() => [])
    : [];

  return {
    embeds: [embed],
    components: buildJutsuComponents(
      canManage, page, pageNum, totalPages,
      filterType, filterRank, jutsuTypes
    )
  };
}

export async function handleJutsuInteraction(
  interaction: Interaction,
  services: CommandServices
): Promise<boolean> {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
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
    if (interaction.isStringSelectMenu()) {
      await handleJutsuSelect(interaction, services);
      return true;
    }

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
  page: JutsuPage,
  pageNum: number,
  filterType = "_",
  filterRank = "_"
): Promise<{ embed: EmbedBuilder; totalPages: number }> {
  const overview = await services.jutsus.getOverview(guild, user);

  const chakraLine =
    overview.currentChakra === undefined || overview.maxChakra === undefined
      ? "Chakra: ficha não encontrada"
      : `Chakra: **${overview.currentChakra}/${overview.maxChakra}**`;

  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle("⚡ Jutsus")
    .setDescription(
      [
        `Catálogo: **${overview.activeCount}** ativos (${overview.totalCount} total)`,
        `Aprendidos: **${overview.learnedCount}** | ${chakraLine}`
      ].join("\n")
    );

  let totalPages = 1;

  if (page === "catalog") {
    const safePage = Math.max(0, pageNum);
    const { items, total } = await services.jutsus.listJutsusPaged(guild, {
      skip: safePage * PAGE_SIZE,
      take: PAGE_SIZE,
      typeKey:   filterType,
      jutsuRank: filterRank
    });
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const realPage = Math.min(safePage, totalPages - 1);

    // Labels dos filtros ativos
    const rankLabel = filterRank !== "_" ? `Rank ${filterRank.toUpperCase()}` : null;
    const filterLabel = [rankLabel].filter(Boolean).join(" · ");
    const pageLabel   = totalPages > 1 ? ` — p. ${realPage + 1}/${totalPages}` : "";
    const totalLabel  = `${total} jutsu${total !== 1 ? "s" : ""}`;
    const fieldName   = filterLabel
      ? `Catálogo — ${filterLabel} (${totalLabel})${pageLabel}`
      : `Catálogo ativo (${totalLabel})${pageLabel}`;

    embed.addFields({
      name:  fieldName,
      value: formatJutsuList(services, items, "Nenhum jutsu encontrado com esses filtros.")
    });
  } else if (page === "known") {
    const safePage = Math.max(0, pageNum);
    const { items, total } = await services.jutsus.listKnownJutsusPaged(guild, user, {
      skip: safePage * PAGE_SIZE,
      take: PAGE_SIZE
    });
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const realPage = Math.min(safePage, totalPages - 1);
    const pageLabel = totalPages > 1 ? ` — p. ${realPage + 1}/${totalPages}` : "";
    embed.addFields({
      name: `Meus jutsus${pageLabel}`,
      value:
        items.length > 0
          ? items.map((e) => services.jutsus.formatJutsu(e.jutsu)).join("\n\n").slice(0, 1024)
          : "Você ainda não aprendeu jutsus neste servidor."
    });
  } else {
    embed.addFields({
      name: "Jogador",
      value:
        "**Catálogo** — veja os jutsus disponíveis\n" +
        "**Meus jutsus** — seus jutsus aprendidos\n" +
        "**Aprender** — selecione um jutsu do catálogo para aprender\n" +
        "**Usar** — selecione um jutsu aprendido para executar",
      inline: false
    });
  }

  return { embed, totalPages };
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = ActionRowBuilder<any>;

function buildJutsuComponents(
  canManage: boolean,
  page: JutsuPage,
  pageNum: number,
  totalPages: number,
  filterType: string,
  filterRank: string,
  jutsuTypes: { key: string; name: string }[]
): AnyRow[] {
  const rows: AnyRow[] = [];
  const P = CUSTOM_ID_PREFIX;

  // ── ADMIN ────────────────────────────────────────────────────────────────────
  if (page === "admin") {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(P + ":home").setLabel("← Voltar").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(P + ":create").setLabel("Criar jutsu").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(P + ":edit").setLabel("Editar").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(P + ":rules").setLabel("Requisitos").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(P + ":sync").setLabel("⬇ Importar").setStyle(ButtonStyle.Success)
      )
    );
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(P + ":chakra").setLabel("Ajustar Chakra de personagem").setStyle(ButtonStyle.Secondary)
      )
    );
    return rows;
  }

  // ── HOME / KNOWN ─────────────────────────────────────────────────────────────
  if (page === "home" || page === "known") {
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(cid(0, "_", "_"))
        .setLabel("Catálogo")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(P + ":known")
        .setLabel("Meus jutsus")
        .setStyle(page === "known" ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // [Configurar] só para admins
    if (canManage) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId(P + ":admin")
          .setLabel("⚙ Configurar")
          .setStyle(ButtonStyle.Secondary)
      );
    }

    rows.push(navRow);

    if (page === "known" && totalPages > 1) {
      rows.push(buildPaginationRow("known", pageNum, totalPages, "_", "_"));
    }
    return rows;
  }

  // ── CATALOG com filtros ──────────────────────────────────────────────────────
  const hasFilter = filterType !== "_" || filterRank !== "_";

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(P + ":home")
        .setLabel("← Voltar").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(P + ":search:" + filterType + ":" + filterRank)
        .setLabel("🔍 Buscar").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID_PREFIX}:clear`)
        .setLabel("✕ Limpar")
        .setStyle(hasFilter ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(!hasFilter),
      new ButtonBuilder()
        .setCustomId(P + ":learn:" + pageNum + ":" + filterType + ":" + filterRank)
        .setLabel("📖 Aprender").setStyle(ButtonStyle.Success)
    )
  );

  // Dropdown de tipos
  const typeOptions = [
    new StringSelectMenuOptionBuilder().setValue("_").setLabel("Todos os tipos").setDefault(filterType === "_")
  ];
  for (const t of jutsuTypes.slice(0, 24)) {
    typeOptions.push(
      new StringSelectMenuOptionBuilder().setValue(t.key).setLabel(t.name).setDefault(filterType === t.key)
    );
  }
  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(P + ":sel:type:" + filterRank)
        .setPlaceholder("🏷 Filtrar por categoria...")
        .addOptions(typeOptions)
    )
  );

  // Dropdown de rank
  const rankOptions = [
    new StringSelectMenuOptionBuilder().setValue("_").setLabel("Todos os ranks").setDefault(filterRank === "_")
  ];
  for (const [key, label] of Object.entries(RANK_LABELS)) {
    rankOptions.push(
      new StringSelectMenuOptionBuilder().setValue(key).setLabel(label).setDefault(filterRank === key)
    );
  }
  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(P + ":sel:rank:" + filterType)
        .setPlaceholder("⭐ Filtrar por rank...")
        .addOptions(rankOptions)
    )
  );

  if (totalPages > 1) rows.push(buildPaginationRow("catalog", pageNum, totalPages, filterType, filterRank));

  return rows;
}

function buildPaginationRow(
  page: JutsuPage, pageNum: number, totalPages: number,
  filterType: string, filterRank: string
): ActionRowBuilder<ButtonBuilder> {
  const P = CUSTOM_ID_PREFIX;
  const prevId = page === "catalog"
    ? cid(Math.max(0, pageNum - 1), filterType, filterRank)
    : P + ":" + page + ":" + (pageNum - 1);
  const nextId = page === "catalog"
    ? cid(Math.min(totalPages - 1, pageNum + 1), filterType, filterRank)
    : P + ":" + page + ":" + (pageNum + 1);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(prevId).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(pageNum <= 0),
    new ButtonBuilder().setCustomId(P + ":_page").setLabel((pageNum + 1) + " / " + totalPages).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(nextId).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(pageNum >= totalPages - 1)
  );
}

async function handleJutsuButton(
  interaction: ButtonInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const rawAction = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);
  const { type: action, pageNum, filterType, filterRank } = parseAction(rawAction);
  const canManage = await canManageJutsus(interaction, services);

  if (action === "_page") {
    await interaction.deferUpdate();
    return;
  }

  // Navegação com filtros preservados
  if (action === "catalog") {
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "catalog", pageNum, filterType, filterRank)
    );
    return;
  }

  if (action === "known") {
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "known", pageNum, "_", "_")
    );
    return;
  }

  if (action === "home") {
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "home", 0, "_", "_")
    );
    return;
  }

  if (action === "clear") {
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "catalog", 0, "_", "_")
    );
    return;
  }

  if (action === "admin") {
    if (!canManage) {
      await interaction.reply({ content: "Você não tem permissão administrativa.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "admin", 0, "_", "_")
    );
    return;
  }

  // Busca — abre modal
  if (action === "search") {
    await interaction.showModal(buildSearchModal(filterType, filterRank));
    return;
  }

  // Aprender — mostra select com jutsus filtrados da página atual
  if (action === "learn") {
    const { items } = await services.jutsus.listJutsusPaged(interaction.guild, {
      skip: pageNum * PAGE_SIZE,
      take: PAGE_SIZE,
      typeKey:   filterType,
      jutsuRank: filterRank
    });
    if (items.length === 0) {
      await interaction.reply({ content: "Nenhum jutsu visível para aprender. Ajuste os filtros.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      content: "Selecione o jutsu para aprender:",
      components: [buildJutsuSelectMenu(items, `${CUSTOM_ID_PREFIX}:select:learn`)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (action === "use") {
    const known = await services.jutsus.listKnownJutsus(interaction.guild, interaction.user);
    if (known.length === 0) {
      await interaction.reply({ content: "Você não tem jutsus aprendidos.", flags: MessageFlags.Ephemeral });
      return;
    }
    const slice = known.slice(0, 25);
    await interaction.reply({
      content: known.length > 25
        ? `Selecione o jutsu para usar (${known.length} aprendidos, mostrando 25):`
        : "Selecione o jutsu para usar:",
      components: [buildJutsuSelectMenu(slice.map(e => e.jutsu), `${CUSTOM_ID_PREFIX}:select:use`)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!canManage) {
    await interaction.reply({
      content: "Você precisa ter Administrador, Gerenciar Servidor ou cargo administrativo para editar jutsus.",
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

  if (action === "chakra") {
    await interaction.showModal(buildChakraAdjustmentModal());
    return;
  }

  if (action === "sync") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await services.guildConfig.syncCanonicalJutsus(interaction.guild, interaction.user.id);
    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Jutsus sincronizados",
      description: `**${result.created}** jutsus importados do catálogo oficial. **${result.skipped}** já existiam.`
    });
    await refreshJutsuMessage(interaction, services, "admin", 0, "_", "_");
    await interaction.editReply(
      result.created > 0
        ? `Sincronização concluída: **${result.created}** jutsus importados, **${result.skipped}** já existiam.`
        : `Catálogo já está sincronizado — **${result.skipped}** jutsus encontrados, nenhum novo.`
    );
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

  // ── Modal de busca ──────────────────────────────────────────────────────────
  if (action.startsWith("search:")) {
    const parts        = action.split(":");
    const filterType   = parts[1] ?? "_";
    const filterRank   = parts[2] ?? "_";
    const query        = interaction.fields.getTextInputValue("query").trim();
    const canManage    = await canManageJutsus(interaction, services);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { items, total } = await services.jutsus.listJutsusPaged(interaction.guild, {
      nameSearch: query, typeKey: filterType, jutsuRank: filterRank, take: PAGE_SIZE
    });

    // Atualiza o painel principal com resultados filtrados
    if (interaction.message) {
      const embed = new EmbedBuilder()
        .setColor(0x2f855a)
        .setTitle("⚡ Jutsus — Resultados da busca")
        .setDescription(`Busca: **"${query}"** — ${total} resultado${total !== 1 ? "s" : ""}`)
        .addFields({
          name: `Resultados (${Math.min(PAGE_SIZE, total)} de ${total})`,
          value: formatJutsuList({ jutsus: { formatJutsu: (j: JutsuWithRelations) => services.jutsus.formatJutsu(j) } } as unknown as CommandServices, items, "Nenhum jutsu encontrado.")
        });

      const learnBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:home`)
          .setLabel("← Voltar ao catálogo")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID_PREFIX}:learn:0:${filterType}:${filterRank}`)
          .setLabel("📖 Aprender")
          .setStyle(ButtonStyle.Success)
          .setDisabled(items.length === 0)
      );

      await interaction.message.edit({ embeds: [embed], components: [learnBtn] }).catch(() => undefined);
    }

    await interaction.editReply(
      total === 0
        ? `Nenhum jutsu encontrado para **"${query}"**.`
        : `Encontrado${total !== 1 ? "s" : ""} **${total}** jutsu${total !== 1 ? "s" : ""}. Veja acima.`
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (action === "learn") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const learned = await services.jutsus.learnJutsu(interaction.guild, interaction.user, identifier);

    await refreshJutsuMessage(interaction, services, "known", 0);
    await interaction.editReply(`**${learned.jutsu.name}** aprendido pela sua ficha ativa.`);
    return;
  }

  if (action === "use") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const result = await services.jutsus.useJutsu(interaction.guild, interaction.user, identifier);

    await refreshJutsuMessage(interaction, services, "known", 0);
    await interaction.editReply(
      [
        `**${result.character.name}** usou **${result.jutsu.name}**.`,
        `Chakra: **${result.chakraBefore}** → **${result.chakraAfter}/${result.chakraMax}**`
      ].join("\n")
    );
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
    const { type, jutsuRank, rank } = parseTypeRankInfo(interaction.fields.getTextInputValue("typeRankInfo"));
    const { chakraCost, duration, usageLimit } = parseCostDurationUsage(interaction.fields.getTextInputValue("costDurUso"));
    const created = await services.jutsus.createJutsu(interaction.guild, interaction.user.id, {
      key,
      name,
      description,
      type,
      jutsuRank,
      requiredRank: rank,
      chakraCost,
      duration,
      usageLimit
    });

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Jutsu criado",
      description: `O jutsu **${created.name}** \`${created.key}\` foi cadastrado.`
    });
    await refreshJutsuMessage(interaction, services, "catalog", 0);
    await interaction.editReply(`Jutsu **${created.name}** criado.`);
    return;
  }

  if (action === "edit") {
    const identifier = parseRequiredText(interaction.fields.getTextInputValue("identifier"), "Jutsu", 120);
    const name = parseOptionalText(interaction.fields.getTextInputValue("name"), 80);
    const { type, jutsuRank, rank, hasInput: hasTypeRankInput } = parseTypeRankInfo(interaction.fields.getTextInputValue("typeRankInfo"));
    const { chakraCost, duration, usageLimit, hasInput: hasCostInput } = parseCostDurationUsage(interaction.fields.getTextInputValue("costDurUso"));
    const isActive = parseOptionalStatus(interaction.fields.getTextInputValue("status"));

    if (name === undefined && !hasTypeRankInput && !hasCostInput && isActive === undefined) {
      await interaction.editReply("Informe ao menos um campo para alterar.");
      return;
    }

    const updated = await services.jutsus.updateJutsu(interaction.guild, interaction.user.id, identifier, {
      name,
      type: hasTypeRankInput ? type : undefined,
      jutsuRank: hasTypeRankInput ? jutsuRank : undefined,
      requiredRank: hasTypeRankInput ? rank : undefined,
      chakraCost,
      duration,
      usageLimit,
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
    await refreshJutsuMessage(interaction, services, "catalog", 0);
    await interaction.editReply(`Jutsu **${updated.name}** atualizado.`);
    return;
  }

  if (action === "chakra") {
    const targetUserId = parseUserId(interaction.fields.getTextInputValue("target"));
    const adjustment = parseChakraAdjustment(interaction.fields.getTextInputValue("adjustment"));
    const reason = parseOptionalText(interaction.fields.getTextInputValue("reason"), 200);

    if (!targetUserId) {
      await interaction.editReply("Informe uma menção ou ID de usuário válido.");
      return;
    }

    const result = await services.jutsus.adjustCharacterChakra(
      interaction.guild,
      interaction.user.id,
      targetUserId,
      {
        ...adjustment,
        reason
      }
    );

    await sendStaffLogForGuild(interaction.guild, interaction.user, services, {
      title: "Chakra ajustado",
      description: [
        `Ficha: **${result.character.name}** (<@${targetUserId}>)`,
        `Chakra: **${result.chakraBefore}** -> **${result.chakraAfter}/${result.chakraMax}**`,
        reason ? `Motivo: ${reason}` : null
      ].filter((line): line is string => Boolean(line)).join("\n")
    });
    await refreshJutsuMessage(interaction, services, "home", 0);
    await interaction.editReply(`Chakra de **${result.character.name}** ajustado para **${result.chakraAfter}/${result.chakraMax}**.`);
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
    await refreshJutsuMessage(interaction, services, "catalog", 0);
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

function buildUseJutsuModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:use`)
    .setTitle("Usar jutsu")
    .addComponents(textInputRow("identifier", "Jutsu aprendido", "chidori ou Chidori", TextInputStyle.Short, true));
}

function buildCreateJutsuModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:create`)
    .setTitle("Criar jutsu")
    .addComponents(
      textInputRow("key", "Chave técnica", "chidori", TextInputStyle.Short, true),
      textInputRow("name", "Nome", "Chidori", TextInputStyle.Short, true),
      textInputRow("typeRankInfo", "Tipo | Rank jutsu | Rank ninja mín.", "ninjutsu | B | jonin", TextInputStyle.Short, false),
      textInputRow("costDurUso", "Chakra | Duração | Usos", "10 | 3 rodadas | 2", TextInputStyle.Short, false),
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
      textInputRow("typeRankInfo", "Tipo | Rank jutsu | Rank ninja mín.", "ninjutsu | B | jonin ou - | - | -", TextInputStyle.Short, false),
      textInputRow("costDurUso", "Chakra | Duração | Usos", "10 | 3 rodadas | 2 ou vazio", TextInputStyle.Short, false),
      textInputRow("status", "Status", "ativo, inativo ou vazio para manter", TextInputStyle.Short, false)
    );
}

function buildChakraAdjustmentModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:chakra`)
    .setTitle("Ajustar Chakra")
    .addComponents(
      textInputRow("target", "Jogador", "@jogador ou ID", TextInputStyle.Short, true),
      textInputRow("adjustment", "Ajuste", "full, +10, -5 ou 30", TextInputStyle.Short, true),
      textInputRow("reason", "Motivo", "Descanso, cena, punição...", TextInputStyle.Paragraph, false)
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

function buildJutsuSelectMenu(
  jutsus: JutsuWithRelations[],
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = jutsus.map((j) => {
    const rankLabel = j.jutsuRank ? ` [${j.jutsuRank}]` : "";
    const typeLabel = j.type ? ` • ${j.type.name}` : "";
    return new StringSelectMenuOptionBuilder()
      .setValue(j.key)
      .setLabel(`${j.name}${rankLabel}`.slice(0, 100))
      .setDescription(`Chakra: ${j.chakraCost}${typeLabel}`.slice(0, 100));
  });

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder("Escolha um jutsu...")
      .addOptions(options)
  );
}

async function handleJutsuSelect(
  interaction: StringSelectMenuInteraction<"cached">,
  services: CommandServices
): Promise<void> {
  const rawAction = interaction.customId.slice(`${CUSTOM_ID_PREFIX}:`.length);
  const canManage = await canManageJutsusSelect(interaction, services);

  // ── Filtro de tipo ──────────────────────────────────────────────────────────
  if (rawAction.startsWith("sel:type:")) {
    const preservedRank = rawAction.slice("sel:type:".length) || "_";
    const newType = interaction.values[0] ?? "_";
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "catalog", 0, newType, preservedRank)
    );
    return;
  }

  // ── Filtro de rank ──────────────────────────────────────────────────────────
  if (rawAction.startsWith("sel:rank:")) {
    const preservedType = rawAction.slice("sel:rank:".length) || "_";
    const newRank = interaction.values[0] ?? "_";
    await interaction.update(
      await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, "catalog", 0, preservedType, newRank)
    );
    return;
  }

  // ── Aprender / Usar ─────────────────────────────────────────────────────────
  const action = rawAction.slice("select:".length);
  const selectedKey = interaction.values[0];

  await interaction.deferUpdate();

  if (action === "learn") {
    const learned = await services.jutsus.learnJutsu(interaction.guild, interaction.user, selectedKey);
    await interaction.editReply({
      content: `**${learned.jutsu.name}** aprendido pela sua ficha ativa.`,
      components: []
    });
    return;
  }

  if (action === "use") {
    const result = await services.jutsus.useJutsu(interaction.guild, interaction.user, selectedKey);
    await interaction.editReply({
      content: [
        `**${result.character.name}** usou **${result.jutsu.name}**.`,
        `Chakra: **${result.chakraBefore}** → **${result.chakraAfter}/${result.chakraMax}**`
      ].join("\n"),
      components: []
    });
    return;
  }

  await interaction.editReply({ content: "Ação desconhecida.", components: [] });
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

async function canManageJutsusSelect(
  interaction: StringSelectMenuInteraction<"cached">,
  services: CommandServices
): Promise<boolean> {
  return (
    hasManageGuildPermission(interaction.memberPermissions) ||
    hasConfiguredAdminRole(interaction.guild, interaction.member.roles.cache.keys(), services.guildConfig)
  );
}

async function refreshJutsuMessage(
  interaction: ModalSubmitInteraction<"cached"> | ButtonInteraction<"cached">,
  services: CommandServices,
  page: JutsuPage,
  pageNum = 0,
  filterType = "_",
  filterRank = "_"
): Promise<void> {
  if (!interaction.message) return;
  const canManage = await canManageJutsus(interaction, services);
  await interaction.message
    .edit(await buildJutsuPanel(services, interaction.guild, interaction.user, canManage, page, pageNum, filterType, filterRank))
    .catch(() => undefined);
}

function buildSearchModal(filterType: string, filterRank: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}:modal:search:${filterType}:${filterRank}`)
    .setTitle("Buscar jutsu")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("query")
          .setLabel("Nome ou chave do jutsu")
          .setPlaceholder("Ex: Chidori, rasengan, amaterasu...")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(60)
      )
    );
}

function formatJutsuList(
  services: CommandServices,
  jutsus: JutsuWithRelations[],
  emptyText: string
): string {
  if (jutsus.length === 0) {
    return emptyText;
  }

  const visible = jutsus.map((jutsu) => services.jutsus.formatJutsu(jutsu));
  const suffix: string[] = [];

  return [...visible, ...suffix].join("\n\n").slice(0, 1024);
}

function parseTypeRankInfo(value: string): {
  type?: string | null;
  jutsuRank?: string | null;
  rank?: string | null;
  hasInput: boolean;
} {
  const trimmed = value.trim();

  if (!trimmed) {
    return { hasInput: false };
  }

  const parts = trimmed.split("|").map((part) => parseClearableOptional(part ?? ""));
  const [typeRaw, jutsuRankRaw, rankRaw] = parts;

  return {
    type: typeRaw,
    jutsuRank: jutsuRankRaw,
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

function parseCostDurationUsage(value: string): {
  chakraCost?: number;
  duration?: string | null;
  usageLimit?: number | null;
  hasInput: boolean;
} {
  const trimmed = value.trim();

  if (!trimmed) {
    return { hasInput: false };
  }

  const parts = trimmed.split("|").map((p) => p.trim());
  const [rawCost, rawDur, rawUso] = parts;
  let chakraCost: number | undefined;
  let duration: string | null | undefined;
  let usageLimit: number | null | undefined;

  if (rawCost) {
    if (rawCost !== "-") {
      if (!/^\d+$/.test(rawCost)) {
        throw new JutsuRuleError(["Custo de Chakra precisa ser um número inteiro não negativo."]);
      }
      chakraCost = Number(rawCost);
    }
  }

  if (rawDur !== undefined) {
    duration = !rawDur || rawDur === "-" ? null : rawDur;
  }

  if (rawUso !== undefined) {
    if (!rawUso || rawUso === "-") {
      usageLimit = null;
    } else {
      if (!/^\d+$/.test(rawUso)) {
        throw new JutsuRuleError(["Usos precisa ser um número inteiro positivo."]);
      }
      usageLimit = Number(rawUso) || null;
    }
  }

  return { chakraCost, duration, usageLimit, hasInput: true };
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

function parseChakraAdjustment(value: string): { mode: ChakraAdjustMode; amount?: number } {
  const trimmed = value.trim().toLocaleLowerCase("pt-BR");

  if (["full", "cheio", "total", "max", "maximo", "máximo"].includes(trimmed)) {
    return { mode: "full" };
  }

  if (/^[+-]\d+$/.test(trimmed)) {
    return {
      mode: "add",
      amount: Number(trimmed)
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      mode: "set",
      amount: Number(trimmed)
    };
  }

  throw new JutsuRuleError(["Ajuste de Chakra inválido. Use `full`, `+10`, `-5` ou `30`."]);
}

function parseClearableOptional(value: string): string | null | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return ["-", "limpar", "null", "nenhum", "nenhuma"].includes(trimmed.toLowerCase()) ? null : trimmed;
}

function parseUserId(value: string): string | null {
  const userId = value.replace(/\D/g, "");
  return /^\d{15,25}$/.test(userId) ? userId : null;
}

async function replyPrivately(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
  content: string
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
