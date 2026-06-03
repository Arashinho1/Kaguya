import { buildTrainingPanel } from "../../modules/training/TrainingPanel.js";
import { canManageGuild, canUseConfiguredAdminRole } from "../../services/permissions.js";
import type { PrefixCommand } from "../../types/command.js";

export const trainingCommand: PrefixCommand = {
  name: "treino",
  aliases: ["treinar", "evoluir", "evolucao", "evolução"],
  access: "member",
  module: "training",
  description: "Abre o painel de treino e evolução de atributos da ficha.",
  usage: ".treino",
  async execute({ message, services }) {
    const canManage =
      canManageGuild(message) ||
      await canUseConfiguredAdminRole(message, services.guildConfig);

    await message.reply(await buildTrainingPanel(services, message.guild, message.author, canManage));
  }
};
