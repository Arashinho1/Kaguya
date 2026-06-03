import { buildCombatPanel } from "../../modules/combat/CombatPanel.js";
import {
  CombatRuleError,
  formatCombatStatusLines
} from "../../modules/combat/CombatService.js";
import { canManageGuild, canUseConfiguredAdminRole } from "../../services/permissions.js";
import type { PrefixCommand } from "../../types/command.js";

export const combatCommand: PrefixCommand = {
  name: "combate",
  aliases: ["batalha", "turno", "turnos", "entrar"],
  access: "member",
  module: "combat",
  description: "Controla embates discretos por canal, com ações narrativas e status mínimo.",
  usage: ".combate @jogador | .combate | .entrar | .turno",
  async execute({ message, args, commandName, prefix, services }) {
    try {
      if (commandName === "turno" || commandName === "turnos") {
        const result = await services.combat.endParticipantTurn(message.guild, message.author, message.channelId);
        const lines = [
          `Turno de **${result.participant.character.name}** encerrado.`,
          result.allDone
            ? `Rodada finalizada. Nova rodada: **${result.encounter.round}**.`
            : `Aguardando: ${result.pendingParticipants.map((participant) => `**${participant.character.name}**`).join(", ")}.`,
          result.statusLines.join(" | ")
        ];

        await message.reply(lines.join("\n"));
        return;
      }

      const subcommand = args[0]?.toLocaleLowerCase("pt-BR");

      if (commandName === "entrar" || subcommand === "entrar") {
        const encounter = await services.combat.joinEncounter(message.guild, message.channelId, message.author);
        await message.reply(
          [
            "Você entrou no combate.",
            formatCombatStatusLines(encounter, services.characters).join(" | ")
          ].join("\n")
        );
        return;
      }

      if (subcommand === "painel") {
        const canManage =
          canManageGuild(message) ||
          await canUseConfiguredAdminRole(message, services.guildConfig);

        await message.reply(await buildCombatPanel(services, message.guild, message.channelId, message.author, canManage));
        return;
      }

      const target = message.mentions.users.first();

      if (target) {
        const result = await services.combat.createForcedEncounter(
          message.guild,
          message.author,
          target,
          message.channelId
        );

        await message.reply(
          [
            `Combate iniciado: **${result.actor?.name}** vs **${result.target?.name}**.`,
            `Local: **${result.locationLabel}**.`,
            `Ações com jutsu devem usar \`[nome do jutsu]\`. Finalizem com \`${prefix}turno\`.`
          ].join("\n")
        );
        return;
      }

      const overview = await services.combat.getOverview(message.guild, message.channelId);

      if (!overview.encounter) {
        await message.reply(`Nenhum combate ativo neste canal. Use \`${prefix}combate @jogador\`.`);
        return;
      }

      await message.reply(
        [
          `Combate: **${overview.encounter.name}** | Rodada **${overview.encounter.round}**.`,
          formatCombatStatusLines(overview.encounter, services.characters).join(" | "),
          `Use \`${prefix}turno\` para finalizar sua ação.`
        ].join("\n")
      );
    } catch (error) {
      if (error instanceof CombatRuleError) {
        await message.reply(error.message);
        return;
      }

      throw error;
    }
  }
};
