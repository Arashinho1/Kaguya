import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { CharacterInventory, CharacterProgress, ItemDefinition, PrismaClient } from "../../generated/prisma/client.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import { normalizeBonuses } from "../world/WorldConfigService.js";

export class EconomyRuleError extends DomainError {}

const CURRENCY_NAME_KEY = "currencyName";
const DUEL_WIN_REWARD_KEY = "economyDuelWinReward";
const PERICIA_LEVEL_UP_REWARD_KEY = "economyPericiaLevelUpReward";
const DEFAULT_CURRENCY_NAME = "Ryo";

export interface ItemInput {
  key: string;
  name: string;
  description?: string;
  price?: number | null;
  bonuses?: Record<string, number>;
  sortOrder?: number;
}

/**
 * Todo método aqui opera só pelo characterId (nunca precisa do CharacterWithWorld inteiro) —
 * mantém EconomyService desacoplado de CharacterService, evitando ciclo de dependência já
 * que CharacterService.getCharacterView chama de volta getEquippedBonuses.
 */
export class EconomyService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService
  ) {}

  // ─── Moeda ───────────────────────────────────────────────────────────────

  public async getCurrencyName(guild: Guild): Promise<string> {
    const value = await this.guildConfig.getSetting(guild, CURRENCY_NAME_KEY);
    return typeof value === "string" && value.length > 0 ? value : DEFAULT_CURRENCY_NAME;
  }

  public async setCurrencyName(guild: Guild, actorId: string, name: string): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: CURRENCY_NAME_KEY,
      label: "Nome da moeda",
      description: "Nome exibido para a moeda do RPG neste servidor.",
      value: name,
      valueType: "STRING",
      isPublic: true
    });
  }

  public async getOrCreateProgress(guild: Guild, characterId: string): Promise<CharacterProgress> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.characterProgress.upsert({
      where: { characterId },
      update: {},
      create: { guildId: rpgGuild.id, characterId }
    });
  }

  public async getBalance(guild: Guild, characterId: string): Promise<number> {
    const progress = await this.getOrCreateProgress(guild, characterId);
    return progress.currency;
  }

  public async grantCurrency(
    guild: Guild,
    actorId: string,
    characterId: string,
    amount: number,
    reason?: string
  ): Promise<number> {
    if (amount === 0) return this.getBalance(guild, characterId);

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const progress = await this.getOrCreateProgress(guild, characterId);
    const balanceBefore = progress.currency;
    const balanceAfter = Math.max(0, balanceBefore + amount);

    await this.prisma.characterProgress.update({
      where: { id: progress.id },
      data: { currency: balanceAfter }
    });

    await this.prisma.currencyLog.create({
      data: {
        guildId: rpgGuild.id,
        characterId,
        actorId,
        amount,
        balanceBefore,
        balanceAfter,
        reason
      }
    });

    return balanceAfter;
  }

  // ─── Itens ───────────────────────────────────────────────────────────────

  public async listItems(guild: Guild, options: { includeInactive?: boolean } = {}): Promise<ItemDefinition[]> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.itemDefinition.findMany({
      where: { guildId: rpgGuild.id, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  public async findItem(guild: Guild, key: string): Promise<ItemDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.itemDefinition.findUnique({ where: { guildId_key: { guildId: rpgGuild.id, key } } });
  }

  public async createItem(guild: Guild, actorId: string, input: ItemInput): Promise<ItemDefinition> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    if (await this.findItem(guild, input.key)) {
      throw new EconomyRuleError(`Já existe um item com a chave \`${input.key}\`.`);
    }

    const created = await this.prisma.itemDefinition.create({
      data: {
        guildId: rpgGuild.id,
        key: input.key,
        name: input.name,
        description: input.description,
        price: input.price ?? null,
        bonuses: normalizeBonuses(input.bonuses),
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "economy.item.create",
      targetType: "ItemDefinition",
      targetId: created.id,
      after: { key: created.key }
    });

    return created;
  }

  public async updateItem(
    guild: Guild,
    actorId: string,
    key: string,
    input: Partial<Omit<ItemInput, "key" | "description">> & { description?: string | null; isActive?: boolean }
  ): Promise<ItemDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findItem(guild, key);
    if (!current) return null;

    const updated = await this.prisma.itemDefinition.update({
      where: { id: current.id },
      data: {
        name: input.name,
        description: input.description,
        price: input.price,
        bonuses: input.bonuses ? normalizeBonuses(input.bonuses) : undefined,
        sortOrder: input.sortOrder,
        isActive: input.isActive
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "economy.item.update",
      targetType: "ItemDefinition",
      targetId: updated.id
    });

    return updated;
  }

  public async deleteItem(guild: Guild, actorId: string, key: string): Promise<ItemDefinition | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const current = await this.findItem(guild, key);
    if (!current) return null;

    await this.prisma.itemDefinition.delete({ where: { id: current.id } });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "economy.item.delete",
      targetType: "ItemDefinition",
      targetId: current.id
    });

    return current;
  }

  // ─── Inventário / Loja ─────────────────────────────────────────────────────

  public async listInventory(characterId: string): Promise<(CharacterInventory & { item: ItemDefinition })[]> {
    return this.prisma.characterInventory.findMany({
      where: { characterId },
      include: { item: true },
      orderBy: { createdAt: "asc" }
    });
  }

  public async buyItem(guild: Guild, actorId: string, characterId: string, itemKey: string): Promise<CharacterInventory> {
    const item = await this.findItem(guild, itemKey);
    if (!item || !item.isActive) {
      throw new EconomyRuleError(`Não encontrei o item \`${itemKey}\` (ou ele está desativado).`);
    }
    if (item.price === null) {
      throw new EconomyRuleError(`**${item.name}** não está à venda.`);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const balance = await this.getBalance(guild, characterId);
    if (balance < item.price) {
      const currencyName = await this.getCurrencyName(guild);
      throw new EconomyRuleError(
        `**${item.name}** custa ${item.price} ${currencyName}, você tem ${balance}.`
      );
    }

    await this.grantCurrency(guild, actorId, characterId, -item.price, `Compra: ${item.name}`);

    const inventory = await this.prisma.characterInventory.upsert({
      where: { characterId_itemId: { characterId, itemId: item.id } },
      update: { quantity: { increment: 1 } },
      create: { guildId: rpgGuild.id, characterId, itemId: item.id, quantity: 1 }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "economy.item.buy",
      targetType: "CharacterInventory",
      targetId: inventory.id,
      after: { item: item.key }
    });

    return inventory;
  }

  public async setEquipped(
    guild: Guild,
    characterId: string,
    itemKey: string,
    equipped: boolean
  ): Promise<CharacterInventory> {
    const item = await this.findItem(guild, itemKey);
    if (!item) {
      throw new EconomyRuleError(`Não encontrei o item \`${itemKey}\`.`);
    }

    const owned = await this.prisma.characterInventory.findUnique({
      where: { characterId_itemId: { characterId, itemId: item.id } }
    });
    if (!owned || owned.quantity <= 0) {
      throw new EconomyRuleError(`Você não tem **${item.name}** no inventário.`);
    }

    return this.prisma.characterInventory.update({
      where: { id: owned.id },
      data: { equipped }
    });
  }

  public async getEquippedBonuses(characterId: string): Promise<Record<string, number>> {
    const equipped = await this.prisma.characterInventory.findMany({
      where: { characterId, equipped: true },
      include: { item: true }
    });

    const combined: Record<string, number> = {};
    for (const entry of equipped) {
      for (const [key, value] of Object.entries(normalizeBonuses(entry.item.bonuses))) {
        combined[key] = (combined[key] ?? 0) + value;
      }
    }
    return combined;
  }

  // ─── Recompensas automáticas (desligadas por padrão) ───────────────────────

  public async getDuelWinReward(guild: Guild): Promise<number> {
    const value = await this.guildConfig.getSetting(guild, DUEL_WIN_REWARD_KEY);
    return typeof value === "number" && value >= 0 ? value : 0;
  }

  public async setDuelWinReward(guild: Guild, actorId: string, amount: number): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: DUEL_WIN_REWARD_KEY,
      label: "Recompensa por vencer duelo",
      description: "Moeda concedida automaticamente ao vencedor quando a staff finaliza um duelo. 0 desativa.",
      value: amount,
      valueType: "NUMBER",
      isPublic: false
    });
  }

  public async getPericiaLevelUpReward(guild: Guild): Promise<number> {
    const value = await this.guildConfig.getSetting(guild, PERICIA_LEVEL_UP_REWARD_KEY);
    return typeof value === "number" && value >= 0 ? value : 0;
  }

  public async setPericiaLevelUpReward(guild: Guild, actorId: string, amount: number): Promise<void> {
    await this.guildConfig.setSetting(guild, actorId, {
      key: PERICIA_LEVEL_UP_REWARD_KEY,
      label: "Recompensa por subir de nível numa perícia",
      description: "Moeda concedida automaticamente quando uma perícia sobe de nível. 0 desativa.",
      value: amount,
      valueType: "NUMBER",
      isPublic: false
    });
  }
}
