import type { Guild, User } from "discord.js";

import { CombatEncounterStatus } from "../../generated/prisma/enums.js";
import {
  Prisma,
  type CombatActionLog,
  type CombatEncounter,
  type CombatParticipant,
  type Character,
  type JutsuUseLog,
  type PrismaClient
} from "../../generated/prisma/client.js";
import type { CharacterService } from "../characters/CharacterService.js";
import type { GuildConfigService } from "../guild-config/GuildConfigService.js";
import type { JutsuService, JutsuWithRelations } from "../jutsus/JutsuService.js";

const CHARACTER_INCLUDE = {
  clan: true,
  village: true,
  rank: true,
  progress: true
} satisfies Prisma.CharacterInclude;

const PARTICIPANT_INCLUDE = {
  character: {
    include: CHARACTER_INCLUDE
  }
} satisfies Prisma.CombatParticipantInclude;

const ENCOUNTER_INCLUDE = {
  participants: {
    include: PARTICIPANT_INCLUDE,
    orderBy: { joinedAt: "asc" }
  },
  actionLogs: {
    orderBy: { createdAt: "desc" },
    take: 5
  }
} satisfies Prisma.CombatEncounterInclude;

export type CombatEncounterWithRelations = Prisma.CombatEncounterGetPayload<{
  include: typeof ENCOUNTER_INCLUDE;
}>;

export type CombatParticipantWithCharacter = Prisma.CombatParticipantGetPayload<{
  include: typeof PARTICIPANT_INCLUDE;
}>;

export interface CombatOverview {
  encounter: CombatEncounterWithRelations | null;
  activeParticipant: CombatParticipantWithCharacter | null;
}

export interface ForcedCombatResult {
  encounter: CombatEncounterWithRelations;
  actor: CharacterWithLocation;
  target: CharacterWithLocation;
  locationLabel: string;
}

export interface TurnEndResult {
  encounter: CombatEncounterWithRelations;
  participant: CombatParticipantWithCharacter;
  allDone: boolean;
  pendingParticipants: CombatParticipantWithCharacter[];
  statusLines: string[];
}

export interface CombatJutsuResult {
  encounter: CombatEncounterWithRelations;
  actionLog: CombatActionLog;
  character: Character;
  jutsu: JutsuWithRelations;
  jutsuUseLog: JutsuUseLog;
  chakraBefore: number;
  chakraAfter: number;
  chakraMax: number;
}

type CharacterWithLocation = Awaited<ReturnType<CharacterService["findActiveByUser"]>> & {};

interface CombatMetadata {
  locationKey?: string;
  locationLabel?: string;
  endedThisRound?: string[];
}

export class CombatRuleError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "CombatRuleError";
  }
}

export class CombatService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly guildConfig: GuildConfigService,
    private readonly characters: CharacterService,
    private readonly jutsus: JutsuService
  ) {}

  public async getOverview(guild: Guild, channelId: string): Promise<CombatOverview> {
    const encounter = await this.findCurrentEncounter(guild, channelId);

    return {
      encounter,
      activeParticipant: null
    };
  }

  public async createForcedEncounter(
    guild: Guild,
    actor: User,
    target: User,
    channelId: string
  ): Promise<ForcedCombatResult> {
    if (actor.id === target.id) {
      throw new CombatRuleError(["Você precisa mencionar outro jogador para iniciar um combate."]);
    }

    if (target.bot) {
      throw new CombatRuleError(["Não dá para iniciar combate forçado contra bot."]);
    }

    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const existing = await this.findCurrentEncounter(guild, channelId);

    if (existing) {
      throw new CombatRuleError([
        `Já existe um combate **${existing.name}** ${formatStatus(existing.status)} neste canal.`
      ]);
    }

    const [actorCharacter, targetCharacter] = await Promise.all([
      this.characters.findActiveByUser(guild, actor.id),
      this.characters.findActiveByUser(guild, target.id)
    ]);

    if (!actorCharacter) {
      throw new CombatRuleError(["Você precisa ter uma ficha ativa para iniciar combate."]);
    }

    if (!targetCharacter) {
      throw new CombatRuleError(["O jogador mencionado precisa ter uma ficha ativa."]);
    }

    const actorLocation = getCharacterLocation(actorCharacter);
    const targetLocation = getCharacterLocation(targetCharacter);

    if (!actorLocation || !targetLocation || actorLocation.key !== targetLocation.key) {
      throw new CombatRuleError([
        "As duas fichas precisam estar no mesmo local para iniciar combate.",
        "Nesta versão, o local usa a vila da ficha ou `metadata.location/local` quando existir."
      ]);
    }

    const name = `${actorCharacter.name} vs ${targetCharacter.name}`;
    const encounter = await this.prisma.combatEncounter.create({
      data: {
        guildId: rpgGuild.id,
        channelId,
        name,
        status: CombatEncounterStatus.ACTIVE,
        metadata: {
          locationKey: actorLocation.key,
          locationLabel: actorLocation.label,
          endedThisRound: []
        }
      },
      include: ENCOUNTER_INCLUDE
    });

    await this.prisma.combatParticipant.createMany({
      data: [
        {
          guildId: rpgGuild.id,
          encounterId: encounter.id,
          characterId: actorCharacter.id,
          userId: actor.id
        },
        {
          guildId: rpgGuild.id,
          encounterId: encounter.id,
          characterId: targetCharacter.id,
          userId: target.id
        }
      ]
    });

    await this.writeActionLog(
      rpgGuild.id,
      encounter.id,
      actor.id,
      "combat.force.start",
      `Combate iniciado entre **${actorCharacter.name}** e **${targetCharacter.name}**.`
    );
    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: actor.id,
      action: "combat.force.start",
      targetType: "CombatEncounter",
      targetId: encounter.id,
      after: {
        name,
        actorCharacterId: actorCharacter.id,
        targetCharacterId: targetCharacter.id,
        location: actorLocation
      }
    });

    return {
      encounter: await this.requireEncounter(guild, channelId),
      actor: actorCharacter,
      target: targetCharacter,
      locationLabel: actorLocation.label
    };
  }

  public async createEncounter(
    guild: Guild,
    actorId: string,
    channelId: string,
    name: string
  ): Promise<CombatEncounterWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const existing = await this.findCurrentEncounter(guild, channelId);

    if (existing) {
      throw new CombatRuleError([
        `Já existe um combate **${existing.name}** ${formatStatus(existing.status)} neste canal.`
      ]);
    }

    const encounter = await this.prisma.combatEncounter.create({
      data: {
        guildId: rpgGuild.id,
        channelId,
        name,
        status: CombatEncounterStatus.OPEN
      },
      include: ENCOUNTER_INCLUDE
    });

    await this.writeActionLog(rpgGuild.id, encounter.id, actorId, "combat.create", `Combate **${name}** criado.`);
    await this.writeAuditLog({
      guildId: rpgGuild.id,
      actorId,
      action: "combat.create",
      targetType: "CombatEncounter",
      targetId: encounter.id,
      after: serializeEncounter(encounter)
    });

    return this.requireEncounter(guild, channelId);
  }

  public async joinEncounter(guild: Guild, channelId: string, user: User): Promise<CombatEncounterWithRelations> {
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });

    await this.addParticipant(guild, user.id, channelId, user.id, 0, { selfJoin: true, allowActive: true });
    return this.requireEncounter(guild, channelId);
  }

  public async addParticipant(
    guild: Guild,
    actorId: string,
    channelId: string,
    targetUserId: string,
    initiative = 0,
    options: { selfJoin?: boolean; allowActive?: boolean } = {}
  ): Promise<CombatEncounterWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });

    if (encounter.status === CombatEncounterStatus.ACTIVE && !options.allowActive) {
      throw new CombatRuleError(["Não dá para adicionar participante depois que os turnos já começaram."]);
    }

    const character = await this.characters.findActiveByUser(guild, targetUserId);

    if (!character) {
      throw new CombatRuleError(["Esse usuário precisa ter uma ficha ativa para entrar no combate."]);
    }

    this.assertSameEncounterLocation(encounter, character);

    await this.prisma.combatParticipant.upsert({
      where: {
        encounterId_characterId: {
          encounterId: encounter.id,
          characterId: character.id
        }
      },
      update: {
        initiative,
        isActive: true
      },
      create: {
        guildId: rpgGuild.id,
        encounterId: encounter.id,
        characterId: character.id,
        userId: targetUserId,
        initiative
      }
    });

    await this.writeActionLog(
      rpgGuild.id,
      encounter.id,
      actorId,
      options.selfJoin ? "combat.participant.join" : "combat.participant.add",
      `**${character.name}** entrou no combate.`,
      character.id
    );

    return this.requireEncounter(guild, channelId);
  }

  public async startEncounter(guild: Guild, actorId: string, channelId: string): Promise<CombatEncounterWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });
    const activeParticipants = encounter.participants.filter((participant) => participant.isActive);

    if (encounter.status === CombatEncounterStatus.ACTIVE) {
      throw new CombatRuleError(["Esse combate já está em andamento."]);
    }

    if (activeParticipants.length === 0) {
      throw new CombatRuleError(["Adicione ao menos um participante antes de iniciar os turnos."]);
    }

    await this.prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: {
        status: CombatEncounterStatus.ACTIVE,
        round: 1,
        turnIndex: 0
      }
    });
    await this.writeActionLog(rpgGuild.id, encounter.id, actorId, "combat.start", "Turnos iniciados.");

    return this.requireEncounter(guild, channelId);
  }

  public async nextTurn(guild: Guild, actorId: string, channelId: string): Promise<CombatEncounterWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });

    if (encounter.status !== CombatEncounterStatus.ACTIVE) {
      throw new CombatRuleError(["Inicie os turnos antes de avançar."]);
    }

    const activeParticipants = encounter.participants.filter((participant) => participant.isActive);

    if (activeParticipants.length === 0) {
      throw new CombatRuleError(["Não há participantes ativos nesse combate."]);
    }

    const nextIndex = encounter.turnIndex + 1;
    const wrapped = nextIndex >= activeParticipants.length;

    await this.prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: {
        turnIndex: wrapped ? 0 : nextIndex,
        round: wrapped ? encounter.round + 1 : encounter.round
      }
    });
    await this.writeActionLog(rpgGuild.id, encounter.id, actorId, "combat.turn.next", "Turno avançado.");

    return this.requireEncounter(guild, channelId);
  }

  public async endEncounter(guild: Guild, actorId: string, channelId: string): Promise<CombatEncounterWithRelations> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });

    await this.prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: { status: CombatEncounterStatus.ENDED }
    });
    await this.writeActionLog(rpgGuild.id, encounter.id, actorId, "combat.end", "Combate encerrado.");

    return this.findEncounterById(encounter.id);
  }

  public async useJutsuOnTurn(
    guild: Guild,
    user: User,
    channelId: string,
    identifier: string
  ): Promise<CombatJutsuResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });

    if (encounter.status !== CombatEncounterStatus.ACTIVE) {
      throw new CombatRuleError(["Inicie os turnos antes de registrar uma ação de jutsu."]);
    }

    this.requireParticipant(encounter, user.id);

    const result = await this.jutsus.useJutsu(guild, user, identifier);
    const actionLog = await this.writeActionLog(
      rpgGuild.id,
      encounter.id,
      user.id,
      "combat.jutsu.use",
      `**${result.character.name}** usou **${result.jutsu.name}**.`,
      result.character.id,
      result.jutsu.id,
      {
        jutsuUseLogId: result.log.id,
        chakraBefore: result.chakraBefore,
        chakraAfter: result.chakraAfter,
        chakraMax: result.chakraMax,
        chakraCost: result.jutsu.chakraCost
      }
    );

    return {
      encounter: await this.requireEncounter(guild, channelId),
      actionLog,
      character: result.character,
      jutsu: result.jutsu,
      jutsuUseLog: result.log,
      chakraBefore: result.chakraBefore,
      chakraAfter: result.chakraAfter,
      chakraMax: result.chakraMax
    };
  }

  public async recordNarratedJutsuUse(
    guild: Guild,
    user: User,
    channelId: string,
    identifier: string
  ): Promise<CombatJutsuResult | null> {
    const encounter = await this.findCurrentEncounter(guild, channelId);

    if (!encounter || encounter.status !== CombatEncounterStatus.ACTIVE) {
      return null;
    }

    return this.useJutsuOnTurn(guild, user, channelId, identifier);
  }

  public async endParticipantTurn(guild: Guild, user: User, channelId: string): Promise<TurnEndResult> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);
    const encounter = await this.requireEncounter(guild, channelId, { allowEnded: false });

    if (encounter.status !== CombatEncounterStatus.ACTIVE) {
      throw new CombatRuleError(["Não há combate ativo neste canal."]);
    }

    const participant = this.requireParticipant(encounter, user.id);
    const activeParticipants = encounter.participants.filter((entry) => entry.isActive);
    const metadata = getCombatMetadata(encounter.metadata);
    const endedThisRound = new Set(metadata.endedThisRound ?? []);

    endedThisRound.add(participant.id);

    const allDone = activeParticipants.every((entry) => endedThisRound.has(entry.id));
    const nextMetadata: CombatMetadata = {
      ...metadata,
      endedThisRound: allDone ? [] : [...endedThisRound]
    };

    await this.prisma.combatEncounter.update({
      where: { id: encounter.id },
      data: {
        metadata: nextMetadata as Prisma.InputJsonValue,
        round: allDone ? encounter.round + 1 : encounter.round
      }
    });

    await this.writeActionLog(
      rpgGuild.id,
      encounter.id,
      user.id,
      "combat.turn.end",
      `**${participant.character.name}** finalizou o turno.`,
      participant.characterId
    );

    const updated = await this.requireEncounter(guild, channelId);
    const updatedMetadata = getCombatMetadata(updated.metadata);
    const pendingParticipants = updated.participants.filter(
      (entry) => entry.isActive && !(updatedMetadata.endedThisRound ?? []).includes(entry.id)
    );

    return {
      encounter: updated,
      participant,
      allDone,
      pendingParticipants,
      statusLines: formatStatusLines(updated, this.characters)
    };
  }

  private async findCurrentEncounter(guild: Guild, channelId: string): Promise<CombatEncounterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.combatEncounter.findFirst({
      where: {
        guildId: rpgGuild.id,
        channelId,
        status: {
          in: [CombatEncounterStatus.OPEN, CombatEncounterStatus.ACTIVE]
        }
      },
      include: ENCOUNTER_INCLUDE,
      orderBy: { updatedAt: "desc" }
    });
  }

  private async requireEncounter(
    guild: Guild,
    channelId: string,
    options: { allowEnded?: boolean } = {}
  ): Promise<CombatEncounterWithRelations> {
    const encounter = options.allowEnded
      ? await this.findAnyEncounter(guild, channelId)
      : await this.findCurrentEncounter(guild, channelId);

    if (!encounter) {
      throw new CombatRuleError(["Não há combate aberto ou ativo neste canal."]);
    }

    return encounter;
  }

  private async findAnyEncounter(guild: Guild, channelId: string): Promise<CombatEncounterWithRelations | null> {
    const rpgGuild = await this.guildConfig.ensureGuild(guild);

    return this.prisma.combatEncounter.findFirst({
      where: {
        guildId: rpgGuild.id,
        channelId
      },
      include: ENCOUNTER_INCLUDE,
      orderBy: { updatedAt: "desc" }
    });
  }

  private async findEncounterById(id: string): Promise<CombatEncounterWithRelations> {
    return this.prisma.combatEncounter.findUniqueOrThrow({
      where: { id },
      include: ENCOUNTER_INCLUDE
    });
  }

  private requireParticipant(
    encounter: CombatEncounterWithRelations,
    userId: string
  ): CombatParticipantWithCharacter {
    const participant = encounter.participants.find((entry) => entry.userId === userId && entry.isActive);

    if (!participant) {
      throw new CombatRuleError(["Você precisa estar nesse combate para fazer isso."]);
    }

    return participant;
  }

  private assertSameEncounterLocation(
    encounter: CombatEncounterWithRelations,
    character: CharacterWithLocation
  ): void {
    const encounterLocation = getCombatMetadata(encounter.metadata).locationKey;

    if (!encounterLocation) {
      return;
    }

    const characterLocation = getCharacterLocation(character);

    if (!characterLocation || characterLocation.key !== encounterLocation) {
      throw new CombatRuleError(["Sua ficha precisa estar no mesmo local do combate para entrar."]);
    }
  }

  private async writeActionLog(
    guildId: string,
    encounterId: string,
    actorId: string,
    action: string,
    summary: string,
    characterId?: string,
    jutsuId?: string,
    metadata: Prisma.InputJsonObject = {}
  ): Promise<CombatActionLog> {
    return this.prisma.combatActionLog.create({
      data: {
        guildId,
        encounterId,
        actorId,
        action,
        summary,
        characterId,
        jutsuId,
        metadata
      }
    });
  }

  private async writeAuditLog(input: {
    guildId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    reason?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        guildId: input.guildId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before === null ? Prisma.JsonNull : input.before,
        after: input.after === null ? Prisma.JsonNull : input.after,
        reason: input.reason
      }
    });
  }
}

export function getActiveParticipant(
  encounter: CombatEncounterWithRelations
): CombatParticipantWithCharacter | null {
  const activeParticipants = encounter.participants.filter((participant) => participant.isActive);

  if (activeParticipants.length === 0 || encounter.status !== CombatEncounterStatus.ACTIVE) {
    return null;
  }

  return activeParticipants[encounter.turnIndex % activeParticipants.length] ?? null;
}

export function formatCombatStatusLines(
  encounter: CombatEncounterWithRelations,
  characters: CharacterService
): string[] {
  return formatStatusLines(encounter, characters);
}

export function formatCombatStatus(status: CombatEncounter["status"]): string {
  return formatStatus(status);
}

function formatStatus(status: CombatEncounter["status"]): string {
  if (status === CombatEncounterStatus.OPEN) {
    return "(aberto)";
  }

  if (status === CombatEncounterStatus.ACTIVE) {
    return "(em andamento)";
  }

  return "(encerrado)";
}

function serializeEncounter(encounter: CombatEncounterWithRelations): Prisma.InputJsonObject {
  return {
    id: encounter.id,
    channelId: encounter.channelId,
    name: encounter.name,
    status: encounter.status,
    round: encounter.round,
    turnIndex: encounter.turnIndex,
    participants: encounter.participants.length
  };
}

function formatStatusLines(
  encounter: CombatEncounterWithRelations,
  characters: CharacterService
): string[] {
  const activeParticipants = encounter.participants.filter((participant) => participant.isActive);

  if (activeParticipants.length === 0) {
    return ["Sem participantes ativos."];
  }

  return activeParticipants.map((participant) => {
    const attributes = characters.getAttributeValues(participant.character);
    const maxChakra = attributes.chakra ?? 0;
    const currentChakra = participant.character.progress?.currentChakra ?? maxChakra;

    return `${participant.character.name}: Chakra ${currentChakra}/${maxChakra}`;
  });
}

function getCombatMetadata(value: unknown): CombatMetadata {
  const record = asRecord(value);
  const endedThisRound = Array.isArray(record.endedThisRound)
    ? record.endedThisRound.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    locationKey: typeof record.locationKey === "string" ? record.locationKey : undefined,
    locationLabel: typeof record.locationLabel === "string" ? record.locationLabel : undefined,
    endedThisRound
  };
}

function getCharacterLocation(character: CharacterWithLocation): { key: string; label: string } | null {
  if (!character) {
    return null;
  }

  const metadata = asRecord(character.metadata);
  const rawLocation =
    getString(metadata, "locationId") ??
    getString(metadata, "location") ??
    getString(metadata, "local") ??
    getString(metadata, "localizacao") ??
    getString(metadata, "localização");

  if (rawLocation) {
    return {
      key: `meta:${rawLocation.toLocaleLowerCase("pt-BR")}`,
      label: rawLocation
    };
  }

  if (character.villageId) {
    return {
      key: `village:${character.villageId}`,
      label: character.village?.name ?? "Vila definida"
    };
  }

  return null;
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
