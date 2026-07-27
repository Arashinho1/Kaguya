import type { Guild } from "discord.js";

import { DomainError } from "../../core/errors.js";
import type { DuelEncounter, Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  flattenScopeSelection,
  isChannelInScope,
  parseScopeSelection,
  type ScopeSelection
} from "../../services/channelScope.js";
import type { CharacterWithWorld } from "../characters/CharacterService.js";
import type { EconomyService } from "../economy/EconomyService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";

export class CombatRuleError extends DomainError {}

const SCOPE_KEY = "combatScope";

export class CombatService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly economy: EconomyService
  ) {}

  // ─── Onde o duelo funciona (categoria/canal/fórum/thread) ───────────────

  public async getScopeSelection(guild: Guild): Promise<ScopeSelection> {
    const raw = await this.guildConfig.getSetting(guild, SCOPE_KEY);
    return parseScopeSelection(raw);
  }

  /**
   * Vazio = nada liberado (comportamento já existente antes do escopo por local: staff
   * precisa designar pelo menos um lugar antes de duelos funcionarem). Uma categoria ou
   * fórum liberado libera automaticamente tudo dentro (canais, threads/posts).
   */
  public async isChannelAllowed(guild: Guild, channelId: string): Promise<boolean> {
    const allowed = flattenScopeSelection(await this.getScopeSelection(guild));
    if (allowed.length === 0) return false;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    return isChannelInScope(channel, allowed);
  }

  /** Substitui só um grupo (canais, categorias, threads ou fóruns) — usado pelo `.setar`,
   * onde cada select mexe no próprio grupo sem apagar os outros três. */
  public async setScopeGroup(
    guild: Guild,
    actorId: string,
    group: keyof ScopeSelection,
    ids: string[]
  ): Promise<ScopeSelection> {
    const current = await this.getScopeSelection(guild);
    const next: ScopeSelection = { ...current, [group]: ids };

    await this.guildConfig.setSetting(guild, actorId, {
      key: SCOPE_KEY,
      label: "Onde o duelo funciona",
      description: "Categorias, canais, fóruns e threads onde .duelo pode ser iniciado.",
      value: next as unknown as Prisma.InputJsonValue,
      valueType: "JSON",
      isPublic: false
    });

    return next;
  }

  // ─── Duelos ──────────────────────────────────────────────────────────────

  public async getOpenDuelForCharacter(character: CharacterWithWorld): Promise<DuelEncounter | null> {
    return this.prisma.duelEncounter.findFirst({
      where: {
        status: { in: ["PENDING", "ACTIVE"] },
        OR: [{ challengerCharacterId: character.id }, { opponentCharacterId: character.id }]
      }
    });
  }

  public async getActiveDuelInChannel(guild: Guild, channelId: string): Promise<DuelEncounter | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    return this.prisma.duelEncounter.findFirst({
      where: { guildId: rpgGuild.id, channelId, status: "ACTIVE" }
    });
  }

  public async challengeDuel(
    guild: Guild,
    channelId: string,
    challenger: CharacterWithWorld,
    opponent: CharacterWithWorld,
    forced: boolean
  ): Promise<DuelEncounter> {
    if (!(await this.isChannelAllowed(guild, channelId))) {
      throw new CombatRuleError("Duelos não são permitidos neste canal.");
    }

    if (challenger.id === opponent.id) {
      throw new CombatRuleError("Você não pode duelar com você mesmo.");
    }

    if (await this.getOpenDuelForCharacter(challenger)) {
      throw new CombatRuleError("Você já está num duelo pendente ou ativo.");
    }

    if (await this.getOpenDuelForCharacter(opponent)) {
      throw new CombatRuleError(`**${opponent.name}** já está num duelo pendente ou ativo.`);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    const created = await this.prisma.duelEncounter.create({
      data: {
        guildId: rpgGuild.id,
        channelId,
        challengerCharacterId: challenger.id,
        opponentCharacterId: opponent.id,
        isForced: forced,
        status: forced ? "ACTIVE" : "PENDING"
      }
    });

    await this.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: challenger.userId,
      action: forced ? "combat.duel.force" : "combat.duel.challenge",
      targetType: "DuelEncounter",
      targetId: created.id,
      after: { challenger: challenger.name, opponent: opponent.name }
    });

    return created;
  }

  public async acceptDuel(guild: Guild, character: CharacterWithWorld): Promise<DuelEncounter> {
    const duel = await this.findPendingDuelAsOpponent(character);
    if (!duel) {
      throw new CombatRuleError("Você não tem nenhum desafio de duelo pendente.");
    }

    const updated = await this.prisma.duelEncounter.update({
      where: { id: duel.id },
      data: { status: "ACTIVE" }
    });

    await this.guildConfig.writeAuditLog({
      guildId: duel.guildId,
      actorId: character.userId,
      action: "combat.duel.accept",
      targetType: "DuelEncounter",
      targetId: duel.id
    });

    return updated;
  }

  public async declineDuel(guild: Guild, character: CharacterWithWorld): Promise<DuelEncounter> {
    const duel = await this.findPendingDuelAsOpponent(character);
    if (!duel) {
      throw new CombatRuleError("Você não tem nenhum desafio de duelo pendente.");
    }

    const updated = await this.prisma.duelEncounter.update({
      where: { id: duel.id },
      data: { status: "ENDED", endedAt: new Date() }
    });

    await this.guildConfig.writeAuditLog({
      guildId: duel.guildId,
      actorId: character.userId,
      action: "combat.duel.decline",
      targetType: "DuelEncounter",
      targetId: duel.id
    });

    return updated;
  }

  public async finalizeDuel(
    guild: Guild,
    actorId: string,
    channelId: string,
    winnerCharacterId: string
  ): Promise<DuelEncounter> {
    const duel = await this.getActiveDuelInChannel(guild, channelId);
    if (!duel) {
      throw new CombatRuleError("Não há duelo ativo neste canal.");
    }

    if (winnerCharacterId !== duel.challengerCharacterId && winnerCharacterId !== duel.opponentCharacterId) {
      throw new CombatRuleError("O vencedor precisa ser um dos dois participantes do duelo.");
    }

    const updated = await this.prisma.duelEncounter.update({
      where: { id: duel.id },
      data: { status: "ENDED", winnerCharacterId, endedAt: new Date() }
    });

    await this.guildConfig.writeAuditLog({
      guildId: duel.guildId,
      actorId,
      action: "combat.duel.finalize",
      targetType: "DuelEncounter",
      targetId: duel.id,
      after: { winnerCharacterId }
    });

    const reward = await this.economy.getDuelWinReward(guild);
    if (reward > 0) {
      await this.economy.grantCurrency(guild, actorId, winnerCharacterId, reward, "Vitória em duelo");
    }

    return updated;
  }

  private async findPendingDuelAsOpponent(character: CharacterWithWorld): Promise<DuelEncounter | null> {
    return this.prisma.duelEncounter.findFirst({
      where: { opponentCharacterId: character.id, status: "PENDING" }
    });
  }
}
