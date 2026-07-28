import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Guild,
  type MessageActionRowComponentBuilder,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from "discord.js";

import { buildCustomId, parseCustomId } from "../core/commands/customId.js";
import { DomainError } from "../core/errors.js";
import type { MenuInteraction } from "../core/commands/menuRegistry.js";
import { normalizeBonuses } from "../modules/world/WorldConfigService.js";
import { VagaRuleError, type VagaWithRelations } from "../modules/vagas/VagaService.js";
import { canUseCommandAccess } from "../services/permissions.js";
import type { CommandServices } from "../types/command.js";
import { parseBonuses } from "./world.js";
import { menuRegistry } from "./menus.js";
import { BRAND_COLOR, truncate } from "./uiConstants.js";

/**
 * Menus interativos de `.vagas` (criar/config): mesma filosofia do worldMenu — criar por
 * modal, editar campos extras por botão, navegar por select. Duas coisas novas em relação
 * aos outros menus: um seletor com paginação + busca por texto (pra achar vaga entre muitas)
 * e seleção paginada "por página" pra jutsus/vínculos (cada página é seu próprio conjunto:
 * o que estava marcado antes nela some se desmarcado, o resto do catálogo não é afetado).
 */

const ID_PREFIX = "vagamenu";
const NONE_VALUE = "__none__";
const MAX_OPTIONS = 25;

type ComponentMenuInteraction = StringSelectMenuInteraction<"cached"> | ButtonInteraction<"cached">;

export interface VagaMenuView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

function buildId(action: string, ...parts: string[]): string {
  return buildCustomId(ID_PREFIX, action, ...parts);
}

function row(...components: MessageActionRowComponentBuilder[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(components);
}

function button(action: string, label: string, style: ButtonStyle, ...parts: string[]): ButtonBuilder {
  return new ButtonBuilder().setCustomId(buildId(action, ...parts)).setLabel(label).setStyle(style);
}

function formatBonuses(bonuses: unknown): string {
  return Object.entries(normalizeBonuses(bonuses))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

function occupancyLabel(vaga: VagaWithRelations, officialCount: number): string {
  return vaga.memberLimit > 0 ? `${officialCount}/${vaga.memberLimit}` : `${officialCount}/∞`;
}

// ─── Hub de criação ──────────────────────────────────────────────────────────

export async function buildVagaCreateHubView(guild: Guild, services: CommandServices): Promise<VagaMenuView> {
  const categories = await services.vagas.listCategories(guild);

  if (categories.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle("🎫 Nova Vaga")
          .setDescription("Nenhuma categoria cadastrada ainda. Crie uma primeiro com `.vagas addcat <nome>`.")
      ],
      components: []
    };
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎫 Nova Vaga")
    .setDescription("Escolha a categoria da vaga. Depois de criada, dá pra configurar bônus, jutsus, rank e mais.");

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("createPickCategory"))
    .setPlaceholder("Escolher categoria...")
    .addOptions(
      categories.slice(0, MAX_OPTIONS).map((category) =>
        new StringSelectMenuOptionBuilder().setLabel(truncate(category.name, 100)).setValue(category.id)
      )
    );

  return { embeds: [embed], components: [row(select)] };
}

function buildCreateModal(categoryId: string): ModalBuilder {
  const idInput = new TextInputBuilder()
    .setCustomId("id")
    .setLabel("ID técnico da vaga")
    .setPlaceholder("Ex: prodigio")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(40)
    .setRequired(true);

  const nomeInput = new TextInputBuilder()
    .setCustomId("nome")
    .setLabel("Nome de exibição")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true);

  const descricaoInput = new TextInputBuilder()
    .setCustomId("descricao")
    .setLabel("Descrição (opcional)")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(300)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(buildId("createModal", categoryId))
    .setTitle("Criar Vaga")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(idInput),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nomeInput),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descricaoInput)
    );
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function buildVagaConfigView(guild: Guild, services: CommandServices): Promise<VagaMenuView> {
  const categories = await services.vagas.listCategories(guild);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("⚙️ Configuração de Vagas")
    .setDescription(
      categories.length > 0
        ? categories
            .map((c) => `**${c.name}** — máx. por pessoa: ${c.maxPerPerson ?? "sem limite"}`)
            .join("\n")
        : "Nenhuma categoria cadastrada ainda. Use `.vagas addcat <nome>`."
    );

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  for (let i = 0; i < categories.length; i += 5) {
    const chunk = categories.slice(i, i + 5);
    components.push(
      row(...chunk.map((c) => button("configCategoryLimit", `⚙️ ${truncate(c.name, 60)}`, ButtonStyle.Secondary, c.id)))
    );
    if (components.length >= 4) break;
  }

  components.push(row(button("openEditor", "📚 Editar vagas cadastradas", ButtonStyle.Primary)));

  return { embeds: [embed], components };
}

function buildCategoryLimitModal(category: { id: string; name: string; maxPerPerson: number | null }): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("limite")
    .setLabel("Máximo de vagas por pessoa (vazio = sem limite)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(false);
  if (category.maxPerPerson !== null) input.setValue(String(category.maxPerPerson));

  return new ModalBuilder()
    .setCustomId(buildId("categoryLimitModal", category.id))
    .setTitle(`Limite — ${category.name}`.slice(0, 45))
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
}

// ─── Seletor (paginação + busca) ─────────────────────────────────────────────

async function buildVagaSelectorView(
  guild: Guild,
  services: CommandServices,
  page: number,
  query: string
): Promise<VagaMenuView> {
  const vagas = await services.vagas.listVagas(guild, { includeInactive: true, query: query || undefined });
  const totalPages = Math.max(1, Math.ceil(vagas.length / MAX_OPTIONS));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const shown = vagas.slice(currentPage * MAX_OPTIONS, (currentPage + 1) * MAX_OPTIONS);
  const encodedQuery = encodeURIComponent(query);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("📚 Vagas cadastradas")
    .setDescription(
      (query ? `Busca: \`${query}\` — ${vagas.length} resultado(s)\n` : `${vagas.length} vaga(s) cadastrada(s)\n`) +
        "Escolha uma abaixo pra ver detalhes e editar."
    );

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (shown.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(buildId("pickVaga", String(currentPage), encodedQuery))
      .setPlaceholder("Escolher vaga...")
      .addOptions(
        shown.map((vaga) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${vaga.isActive ? "🟢" : "🔴"} ${truncate(`${vaga.name} [${vaga.key}]`, 98)}`.slice(0, 100))
            .setValue(vaga.id)
            .setDescription(truncate(vaga.description || "Sem descrição.", 100))
        )
      );
    components.push(row(select));
  }

  components.push(
    row(
      button("prevPage", "◀️ Anterior", ButtonStyle.Secondary, String(currentPage), encodedQuery).setDisabled(currentPage === 0),
      button("pageIndicator", `Página ${currentPage + 1}/${totalPages}`, ButtonStyle.Secondary).setDisabled(true),
      button("nextPage", "▶️ Próxima", ButtonStyle.Secondary, String(currentPage), encodedQuery).setDisabled(
        currentPage >= totalPages - 1
      )
    )
  );

  const searchRow = [button("openSearch", "🔍 Buscar", ButtonStyle.Secondary, String(currentPage), encodedQuery)];
  if (query) searchRow.push(button("clearSearch", "❌ Limpar busca", ButtonStyle.Secondary));
  searchRow.push(button("backToConfig", "⬅️ Voltar", ButtonStyle.Secondary));
  components.push(row(...searchRow));

  return { embeds: [embed], components };
}

function buildSearchModal(page: number, query: string): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("busca")
    .setLabel("Buscar por nome ou ID")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(60)
    .setValue(query)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(buildId("searchModal", String(page)))
    .setTitle("Buscar vaga")
    .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
}

// ─── Detalhe / edição ─────────────────────────────────────────────────────────

/** Chaves aceitas no campo de bônus (de vaga, clã, vila, rank...): os atributos ativos do
 * servidor + "chakra" (bônus especial somado direto ao chakra calculado, sem ser um atributo). */
export async function listAvailableBonusKeys(guild: Guild, services: CommandServices): Promise<string[]> {
  const attributes = await services.attributes.listAttributes(guild);
  return [...attributes.map((attr) => attr.key), "chakra"];
}

async function buildVagaDetailView(
  guild: Guild,
  services: CommandServices,
  vaga: VagaWithRelations,
  officialCount: number
): Promise<VagaMenuView> {
  const bonusKeys = await listAvailableBonusKeys(guild, services);

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🎫 ${vaga.name} \`[${vaga.key}]\``)
    .setDescription(vaga.description || "Sem descrição.")
    .addFields(
      { name: "Categoria", value: vaga.category.name, inline: true },
      { name: "Status", value: vaga.isActive ? "🟢 Ativa" : "🔴 Inativa", inline: true },
      { name: "Ocupação", value: occupancyLabel(vaga, officialCount), inline: true },
      { name: "Pretensão", value: vaga.pretensaoEnabled ? "✅ Disponível" : "❌ Não disponível", inline: true },
      { name: "Bônus", value: formatBonuses(vaga.bonuses) || "Nenhum" },
      { name: "Chaves de bônus disponíveis", value: bonusKeys.length ? bonusKeys.join(", ") : "Nenhuma (cadastre atributos em `.atributo config`)." },
      { name: "Rank inicial", value: vaga.initialRank?.name ?? "Nenhum", inline: true },
      { name: "Restrição de vila", value: vaga.villageRestriction?.name ?? "Nenhuma", inline: true },
      { name: "Jutsus iniciais", value: vaga.initialJutsus.length ? vaga.initialJutsus.map((j) => j.name).join(", ") : "Nenhum" }
    );

  const components = [
    row(
      button("openBasicEditModal", "✏️ Editar", ButtonStyle.Primary, vaga.id),
      button("toggleActive", vaga.isActive ? "🔴 Desativar" : "🟢 Ativar", ButtonStyle.Secondary, vaga.id),
      button("togglePretensao", vaga.pretensaoEnabled ? "❌ Tirar da pretensão" : "✅ Habilitar pretensão", ButtonStyle.Secondary, vaga.id),
      button("removeVaga", "🗑️ Remover", ButtonStyle.Danger, vaga.id)
    ),
    row(
      button("openRankPick", "🎖️ Rank inicial", ButtonStyle.Secondary, vaga.id),
      button("openVillagePick", "🗾 Restrição de vila", ButtonStyle.Secondary, vaga.id)
    ),
    row(
      button("openJutsuPick", "🥷 Jutsus iniciais", ButtonStyle.Secondary, vaga.id, "0"),
      button("openLinkPick", "🔗 Vínculos", ButtonStyle.Secondary, vaga.id, "0")
    ),
    row(button("backToSelector", "⬅️ Voltar", ButtonStyle.Secondary))
  ];

  return { embeds: [embed], components };
}

function buildBasicEditModal(vaga: VagaWithRelations): ModalBuilder {
  const nome = new TextInputBuilder()
    .setCustomId("nome")
    .setLabel("Nome de exibição")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(80)
    .setValue(vaga.name)
    .setRequired(true);

  const descricao = new TextInputBuilder()
    .setCustomId("descricao")
    .setLabel("Descrição")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(300)
    .setValue(vaga.description ?? "")
    .setRequired(false);

  const bonus = new TextInputBuilder()
    .setCustomId("bonus")
    .setLabel("Bônus (ex: forca:2,chakra:10)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setValue(formatBonuses(vaga.bonuses))
    .setRequired(false);

  const limite = new TextInputBuilder()
    .setCustomId("limite")
    .setLabel("Limite de ocupantes oficiais (0 = infinito)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setValue(String(vaga.memberLimit))
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(buildId("basicEditModal", vaga.id))
    .setTitle(`Editar ${vaga.name}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nome),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(descricao),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(bonus),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(limite)
    );
}

// ─── Rank / vila (seleção simples) ────────────────────────────────────────────

async function buildRankPickView(guild: Guild, services: CommandServices, vaga: VagaWithRelations): Promise<VagaMenuView> {
  const ranks = await services.world.listRanks(guild, { includeInactive: true });

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("pickRank", vaga.id))
    .setPlaceholder("Escolher rank inicial...")
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("— Nenhum —").setValue(NONE_VALUE).setDefault(!vaga.initialRankId),
      ...ranks.slice(0, MAX_OPTIONS - 1).map((rank) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(`${rank.name} [${rank.key}]`, 100))
          .setValue(rank.id)
          .setDefault(rank.id === vaga.initialRankId)
      )
    );

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🎖️ Rank inicial — ${vaga.name}`)
    .setDescription(
      "Quem receber essa vaga sobe automaticamente pra esse rank, **se** ele for mais avançado que o rank atual da ficha " +
        "(nunca rebaixa ninguém)."
    );

  return { embeds: [embed], components: [row(select), row(button("backToDetail", "⬅️ Voltar", ButtonStyle.Secondary, vaga.id))] };
}

async function buildVillagePickView(guild: Guild, services: CommandServices, vaga: VagaWithRelations): Promise<VagaMenuView> {
  const villages = await services.world.listVillages(guild, { includeInactive: true });

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId("pickVillage", vaga.id))
    .setPlaceholder("Escolher restrição de vila...")
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("— Nenhuma —").setValue(NONE_VALUE).setDefault(!vaga.villageRestrictionId),
      ...villages.slice(0, MAX_OPTIONS - 1).map((village) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncate(village.name, 100))
          .setValue(village.id)
          .setDefault(village.id === vaga.villageRestrictionId)
      )
    );

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🗾 Restrição de vila — ${vaga.name}`)
    .setDescription("Só personagens dessa vila podem receber essa vaga. Escolha \"— Nenhuma —\" pra liberar geral.");

  return { embeds: [embed], components: [row(select), row(button("backToDetail", "⬅️ Voltar", ButtonStyle.Secondary, vaga.id))] };
}

// ─── Jutsus iniciais / vínculos (seleção paginada, por página) ───────────────

async function buildJutsuPickView(guild: Guild, services: CommandServices, vaga: VagaWithRelations, page: number): Promise<VagaMenuView> {
  const jutsus = await services.jutsus.listJutsus(guild, { includeInactive: true });
  const totalPages = Math.max(1, Math.ceil(jutsus.length / MAX_OPTIONS));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const shown = jutsus.slice(currentPage * MAX_OPTIONS, (currentPage + 1) * MAX_OPTIONS);
  const selectedIds = new Set(vaga.initialJutsus.map((j) => j.id));

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🥷 Jutsus iniciais — ${vaga.name}`)
    .setDescription(
      `Selecionados: **${selectedIds.size}**\n` +
        "Marcar/desmarcar aqui só afeta os jutsus desta página — o resto do catálogo continua como estava."
    );

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (shown.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(buildId("pickJutsuPage", vaga.id, String(currentPage)))
      .setPlaceholder("Selecionar jutsus desta página...")
      .setMinValues(0)
      .setMaxValues(shown.length)
      .addOptions(
        shown.map((jutsu) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(truncate(jutsu.name, 100))
            .setValue(jutsu.id)
            .setDefault(selectedIds.has(jutsu.id))
        )
      );
    components.push(row(select));
  }

  components.push(
    row(
      button("jutsuPrevPage", "◀️ Anterior", ButtonStyle.Secondary, vaga.id, String(currentPage)).setDisabled(currentPage === 0),
      button("pageIndicator", `Página ${currentPage + 1}/${totalPages}`, ButtonStyle.Secondary).setDisabled(true),
      button("jutsuNextPage", "▶️ Próxima", ButtonStyle.Secondary, vaga.id, String(currentPage)).setDisabled(
        currentPage >= totalPages - 1
      )
    ),
    row(button("jutsuDone", "✅ Concluir", ButtonStyle.Success, vaga.id))
  );

  return { embeds: [embed], components };
}

async function buildLinkPickView(guild: Guild, services: CommandServices, vaga: VagaWithRelations, page: number): Promise<VagaMenuView> {
  const allVagas = (await services.vagas.listVagas(guild, { includeInactive: true })).filter((v) => v.id !== vaga.id);
  const totalPages = Math.max(1, Math.ceil(allVagas.length / MAX_OPTIONS));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const shown = allVagas.slice(currentPage * MAX_OPTIONS, (currentPage + 1) * MAX_OPTIONS);
  const linkedKeys = new Set(services.vagas.getLinkedVagaKeys(vaga));

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🔗 Vínculos — ${vaga.name}`)
    .setDescription(
      `Vinculadas: **${linkedKeys.size}**\n` +
        "É só referência/organização entre vagas. Marcar/desmarcar aqui só afeta as vagas desta página."
    );

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  if (shown.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(buildId("pickLinkPage", vaga.id, String(currentPage)))
      .setPlaceholder("Selecionar vagas desta página...")
      .setMinValues(0)
      .setMaxValues(shown.length)
      .addOptions(
        shown.map((other) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(truncate(`${other.name} [${other.key}]`, 100))
            .setValue(other.key)
            .setDefault(linkedKeys.has(other.key))
        )
      );
    components.push(row(select));
  }

  components.push(
    row(
      button("linkPrevPage", "◀️ Anterior", ButtonStyle.Secondary, vaga.id, String(currentPage)).setDisabled(currentPage === 0),
      button("pageIndicator", `Página ${currentPage + 1}/${totalPages}`, ButtonStyle.Secondary).setDisabled(true),
      button("linkNextPage", "▶️ Próxima", ButtonStyle.Secondary, vaga.id, String(currentPage)).setDisabled(
        currentPage >= totalPages - 1
      )
    ),
    row(button("linkDone", "✅ Concluir", ButtonStyle.Success, vaga.id))
  );

  return { embeds: [embed], components };
}

// ─── Roteamento de interações ─────────────────────────────────────────────────

async function requireAdminInteraction(interaction: MenuInteraction, services: CommandServices): Promise<boolean> {
  const isAdmin = await canUseCommandAccess("admin", interaction.member, interaction.client, services.guildConfig);
  if (!isAdmin) {
    await interaction.reply({
      content: "Você precisa ter Administrador ou Gerenciar Servidor para configurar vagas.",
      ephemeral: true
    });
  }
  return isAdmin;
}

async function updateOrFallback(interaction: ComponentMenuInteraction, view: VagaMenuView | null): Promise<void> {
  if (!view) {
    await interaction.reply({ content: "Não encontrei mais isso — pode ter sido removido.", ephemeral: true });
    return;
  }
  await interaction.update(view);
}

async function getDetailView(guild: Guild, services: CommandServices, vagaId: string): Promise<VagaMenuView | null> {
  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) return null;
  const officialCount = await services.vagas.countOfficialOccupants(vaga.id);
  return buildVagaDetailView(guild, services, vaga, officialCount);
}

export async function handleVagaMenuInteraction(interaction: MenuInteraction, services: CommandServices): Promise<void> {
  if (!(await requireAdminInteraction(interaction, services))) {
    return;
  }

  if (interaction.isChannelSelectMenu()) {
    return;
  }

  const { action, parts } = parseCustomId(interaction.customId);

  if (interaction.isModalSubmit()) {
    await routeModalSubmit(interaction, services, action, parts);
    return;
  }

  await routeComponent(interaction, services, action, parts);
}

async function routeModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  action: string,
  parts: string[]
): Promise<void> {
  try {
    switch (action) {
      case "createModal": {
        const [categoryId] = parts;
        if (!categoryId) return;
        await handleCreateModalSubmit(interaction, services, categoryId);
        return;
      }
      case "categoryLimitModal": {
        const [categoryId] = parts;
        if (!categoryId) return;
        await handleCategoryLimitModalSubmit(interaction, services, categoryId);
        return;
      }
      case "searchModal": {
        const page = Number(parts[0]) || 0;
        await handleSearchModalSubmit(interaction, services, page);
        return;
      }
      case "basicEditModal": {
        const [vagaId] = parts;
        if (!vagaId) return;
        await handleBasicEditModalSubmit(interaction, services, vagaId);
        return;
      }
    }
  } catch (error) {
    if (error instanceof DomainError) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: error.message, ephemeral: true });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
      return;
    }
    throw error;
  }
}

async function routeComponent(
  interaction: ComponentMenuInteraction,
  services: CommandServices,
  action: string,
  parts: string[]
): Promise<void> {
  const guild = interaction.guild;

  switch (action) {
    case "createPickCategory": {
      if (!interaction.isStringSelectMenu()) return;
      const categoryId = interaction.values[0];
      if (!categoryId) return;
      await interaction.showModal(buildCreateModal(categoryId));
      return;
    }

    case "configCategoryLimit": {
      if (!interaction.isButton()) return;
      const [categoryId] = parts;
      const category = categoryId ? await services.vagas.getCategoryById(categoryId) : null;
      if (!category) {
        await interaction.reply({ content: "Não encontrei mais essa categoria.", ephemeral: true });
        return;
      }
      await interaction.showModal(buildCategoryLimitModal(category));
      return;
    }

    case "openEditor": {
      if (!interaction.isButton()) return;
      await interaction.update(await buildVagaSelectorView(guild, services, 0, ""));
      return;
    }

    case "backToConfig": {
      if (!interaction.isButton()) return;
      await interaction.update(await buildVagaConfigView(guild, services));
      return;
    }

    case "backToSelector": {
      if (!interaction.isButton()) return;
      await interaction.update(await buildVagaSelectorView(guild, services, 0, ""));
      return;
    }

    case "pickVaga": {
      if (!interaction.isStringSelectMenu()) return;
      const vagaId = interaction.values[0];
      if (!vagaId) return;
      await updateOrFallback(interaction, await getDetailView(guild, services, vagaId));
      return;
    }

    case "prevPage":
    case "nextPage": {
      if (!interaction.isButton()) return;
      const [pageStr, encodedQuery] = parts;
      const page = (Number(pageStr) || 0) + (action === "nextPage" ? 1 : -1);
      await interaction.update(await buildVagaSelectorView(guild, services, page, decodeURIComponent(encodedQuery ?? "")));
      return;
    }

    case "openSearch": {
      if (!interaction.isButton()) return;
      const [pageStr, encodedQuery] = parts;
      await interaction.showModal(buildSearchModal(Number(pageStr) || 0, decodeURIComponent(encodedQuery ?? "")));
      return;
    }

    case "clearSearch": {
      if (!interaction.isButton()) return;
      await interaction.update(await buildVagaSelectorView(guild, services, 0, ""));
      return;
    }

    case "toggleActive": {
      if (!interaction.isButton()) return;
      await handleToggleActive(interaction, services, parts[0]);
      return;
    }

    case "togglePretensao": {
      if (!interaction.isButton()) return;
      await handleTogglePretensao(interaction, services, parts[0]);
      return;
    }

    case "removeVaga": {
      if (!interaction.isButton()) return;
      await handleRemoveVaga(interaction, services, parts[0]);
      return;
    }

    case "backToDetail": {
      if (!interaction.isButton()) return;
      await updateOrFallback(interaction, await getDetailView(guild, services, parts[0] ?? ""));
      return;
    }

    case "openRankPick": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      await interaction.update(await buildRankPickView(guild, services, vaga));
      return;
    }

    case "pickRank": {
      if (!interaction.isStringSelectMenu()) return;
      await handlePickRank(interaction, services, parts[0]);
      return;
    }

    case "openVillagePick": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      await interaction.update(await buildVillagePickView(guild, services, vaga));
      return;
    }

    case "pickVillage": {
      if (!interaction.isStringSelectMenu()) return;
      await handlePickVillage(interaction, services, parts[0]);
      return;
    }

    case "openJutsuPick": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      await interaction.update(await buildJutsuPickView(guild, services, vaga, Number(parts[1]) || 0));
      return;
    }

    case "pickJutsuPage": {
      if (!interaction.isStringSelectMenu()) return;
      await handlePickJutsuPage(interaction, services, parts[0], Number(parts[1]) || 0);
      return;
    }

    case "jutsuPrevPage":
    case "jutsuNextPage": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      const page = (Number(parts[1]) || 0) + (action === "jutsuNextPage" ? 1 : -1);
      await interaction.update(await buildJutsuPickView(guild, services, vaga, page));
      return;
    }

    case "jutsuDone": {
      if (!interaction.isButton()) return;
      await updateOrFallback(interaction, await getDetailView(guild, services, parts[0] ?? ""));
      return;
    }

    case "openLinkPick": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      await interaction.update(await buildLinkPickView(guild, services, vaga, Number(parts[1]) || 0));
      return;
    }

    case "pickLinkPage": {
      if (!interaction.isStringSelectMenu()) return;
      await handlePickLinkPage(interaction, services, parts[0], Number(parts[1]) || 0);
      return;
    }

    case "linkPrevPage":
    case "linkNextPage": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      const page = (Number(parts[1]) || 0) + (action === "linkNextPage" ? 1 : -1);
      await interaction.update(await buildLinkPickView(guild, services, vaga, page));
      return;
    }

    case "linkDone": {
      if (!interaction.isButton()) return;
      await updateOrFallback(interaction, await getDetailView(guild, services, parts[0] ?? ""));
      return;
    }

    case "openBasicEditModal": {
      if (!interaction.isButton()) return;
      const vaga = await services.vagas.getVagaById(parts[0] ?? "");
      if (!vaga) return void (await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true }));
      await interaction.showModal(buildBasicEditModal(vaga));
      return;
    }

    default:
      return;
  }
}

async function handleCreateModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  categoryId: string
): Promise<void> {
  const category = await services.vagas.getCategoryById(categoryId);
  if (!category) {
    await interaction.reply({ content: "Não encontrei mais essa categoria.", ephemeral: true });
    return;
  }

  const key = interaction.fields.getTextInputValue("id").trim();
  const nome = interaction.fields.getTextInputValue("nome").trim();
  const descricaoRaw = interaction.fields.getTextInputValue("descricao").trim();

  await interaction.deferUpdate();

  const created = await services.vagas.createVaga(interaction.guild, interaction.user.id, {
    key,
    name: nome,
    categoryName: category.name,
    description: descricaoRaw.length > 0 ? descricaoRaw : undefined
  });

  await interaction.editReply(await buildVagaDetailView(interaction.guild, services, created, 0));
}

async function handleCategoryLimitModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  categoryId: string
): Promise<void> {
  const raw = interaction.fields.getTextInputValue("limite").trim();
  const maxPerPerson = raw.length > 0 ? parseStrictInt(raw, "limite") : null;

  await interaction.deferUpdate();

  await services.vagas.setCategoryMaxPerPerson(interaction.guild, interaction.user.id, categoryId, maxPerPerson);
  await interaction.editReply(await buildVagaConfigView(interaction.guild, services));
}

async function handleSearchModalSubmit(interaction: ModalSubmitInteraction<"cached">, services: CommandServices, page: number): Promise<void> {
  const query = interaction.fields.getTextInputValue("busca").trim();
  await interaction.deferUpdate();
  await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, query ? 0 : page, query));
}

async function handleBasicEditModalSubmit(
  interaction: ModalSubmitInteraction<"cached">,
  services: CommandServices,
  vagaId: string
): Promise<void> {
  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.reply({ content: "Não encontrei mais essa vaga.", ephemeral: true });
    return;
  }

  const nome = interaction.fields.getTextInputValue("nome").trim();
  const descricaoRaw = interaction.fields.getTextInputValue("descricao").trim();
  const bonuses = parseBonuses(interaction.fields.getTextInputValue("bonus").trim());
  const limiteRaw = interaction.fields.getTextInputValue("limite").trim();
  const memberLimit = limiteRaw.length > 0 ? parseStrictInt(limiteRaw, "limite") : 0;

  await interaction.deferUpdate();

  const updated = await services.vagas.updateVaga(interaction.guild, interaction.user.id, vaga.key, {
    name: nome,
    description: descricaoRaw.length > 0 ? descricaoRaw : undefined,
    bonuses,
    memberLimit
  });

  if (!updated) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const officialCount = await services.vagas.countOfficialOccupants(updated.id);
  await interaction.editReply(await buildVagaDetailView(interaction.guild, services, updated, officialCount));
}

async function handleToggleActive(interaction: ComponentMenuInteraction, services: CommandServices, vagaId?: string): Promise<void> {
  if (!vagaId) return;
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const updated = await services.vagas.updateVaga(interaction.guild, interaction.user.id, vaga.key, { isActive: !vaga.isActive });
  const officialCount = updated ? await services.vagas.countOfficialOccupants(updated.id) : 0;
  await interaction.editReply(
    updated ? await buildVagaDetailView(interaction.guild, services, updated, officialCount) : await buildVagaSelectorView(interaction.guild, services, 0, "")
  );
}

async function handleTogglePretensao(interaction: ComponentMenuInteraction, services: CommandServices, vagaId?: string): Promise<void> {
  if (!vagaId) return;
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const updated = await services.vagas.updateVaga(interaction.guild, interaction.user.id, vaga.key, {
    pretensaoEnabled: !vaga.pretensaoEnabled
  });
  const officialCount = updated ? await services.vagas.countOfficialOccupants(updated.id) : 0;
  await interaction.editReply(
    updated ? await buildVagaDetailView(interaction.guild, services, updated, officialCount) : await buildVagaSelectorView(interaction.guild, services, 0, "")
  );
}

async function handleRemoveVaga(interaction: ComponentMenuInteraction, services: CommandServices, vagaId?: string): Promise<void> {
  if (!vagaId) return;
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (vaga) {
    await services.vagas.deleteVaga(interaction.guild, interaction.user.id, vaga.key);
  }

  await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
}

async function handlePickRank(interaction: StringSelectMenuInteraction<"cached">, services: CommandServices, vagaId?: string): Promise<void> {
  if (!vagaId) return;
  const value = interaction.values[0];
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const updated = await services.vagas.setInitialRank(interaction.guild, interaction.user.id, vaga.key, value === NONE_VALUE ? null : value ?? null);
  const officialCount = updated ? await services.vagas.countOfficialOccupants(updated.id) : 0;
  await interaction.editReply(
    updated ? await buildVagaDetailView(interaction.guild, services, updated, officialCount) : await buildVagaSelectorView(interaction.guild, services, 0, "")
  );
}

async function handlePickVillage(interaction: StringSelectMenuInteraction<"cached">, services: CommandServices, vagaId?: string): Promise<void> {
  if (!vagaId) return;
  const value = interaction.values[0];
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const updated = await services.vagas.setVillageRestriction(
    interaction.guild,
    interaction.user.id,
    vaga.key,
    value === NONE_VALUE ? null : value ?? null
  );
  const officialCount = updated ? await services.vagas.countOfficialOccupants(updated.id) : 0;
  await interaction.editReply(
    updated ? await buildVagaDetailView(interaction.guild, services, updated, officialCount) : await buildVagaSelectorView(interaction.guild, services, 0, "")
  );
}

async function handlePickJutsuPage(
  interaction: StringSelectMenuInteraction<"cached">,
  services: CommandServices,
  vagaId: string | undefined,
  page: number
): Promise<void> {
  if (!vagaId) return;
  const selectedValues = interaction.values;
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const jutsus = await services.jutsus.listJutsus(interaction.guild, { includeInactive: true });
  const totalPages = Math.max(1, Math.ceil(jutsus.length / MAX_OPTIONS));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageItemIds = jutsus.slice(currentPage * MAX_OPTIONS, (currentPage + 1) * MAX_OPTIONS).map((j) => j.id);

  const currentIds = new Set(vaga.initialJutsus.map((j) => j.id));
  for (const id of pageItemIds) currentIds.delete(id);
  for (const id of selectedValues) currentIds.add(id);

  await services.vagas.setInitialJutsus(interaction.guild, interaction.user.id, vaga.key, [...currentIds]);

  const refreshed = await services.vagas.getVagaById(vagaId);
  await interaction.editReply(refreshed ? await buildJutsuPickView(interaction.guild, services, refreshed, currentPage) : await buildVagaSelectorView(interaction.guild, services, 0, ""));
}

async function handlePickLinkPage(
  interaction: StringSelectMenuInteraction<"cached">,
  services: CommandServices,
  vagaId: string | undefined,
  page: number
): Promise<void> {
  if (!vagaId) return;
  const selectedValues = interaction.values;
  await interaction.deferUpdate();

  const vaga = await services.vagas.getVagaById(vagaId);
  if (!vaga) {
    await interaction.editReply(await buildVagaSelectorView(interaction.guild, services, 0, ""));
    return;
  }

  const allVagas = (await services.vagas.listVagas(interaction.guild, { includeInactive: true })).filter((v) => v.id !== vaga.id);
  const totalPages = Math.max(1, Math.ceil(allVagas.length / MAX_OPTIONS));
  const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
  const pageItemKeys = allVagas.slice(currentPage * MAX_OPTIONS, (currentPage + 1) * MAX_OPTIONS).map((v) => v.key);

  const currentKeys = new Set(services.vagas.getLinkedVagaKeys(vaga));
  for (const key of pageItemKeys) currentKeys.delete(key);
  for (const key of selectedValues) currentKeys.add(key);

  await services.vagas.setLinkedVagas(interaction.guild, interaction.user.id, vaga.key, [...currentKeys]);

  const refreshed = await services.vagas.getVagaById(vagaId);
  await interaction.editReply(refreshed ? await buildLinkPickView(interaction.guild, services, refreshed, currentPage) : await buildVagaSelectorView(interaction.guild, services, 0, ""));
}

function parseStrictInt(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new VagaRuleError(`Valor inválido para **${field}**: precisa ser um número inteiro.`);
  }
  return parsed;
}

menuRegistry.register({ prefix: ID_PREFIX, handle: handleVagaMenuInteraction });
