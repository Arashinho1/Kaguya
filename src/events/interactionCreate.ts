import type { Interaction } from "discord.js";

import { handleAttributeInteraction } from "../modules/attributes/AttributePanel.js";
import { handleCharacterInteraction } from "../modules/characters/CharacterPanel.js";
import { handleCombatInteraction } from "../modules/combat/CombatPanel.js";
import { handleConfigInteraction } from "../modules/config-panel/ConfigPanel.js";
import { handleHelpInteraction } from "../modules/help/HelpPanel.js";
import { handleJutsuInteraction } from "../modules/jutsus/JutsuPanel.js";
import { handlePericiaInteraction } from "../modules/pericias/PericiaPanel.js";
import { handleTrainingInteraction } from "../modules/training/TrainingPanel.js";
import type { CommandServices } from "../types/command.js";

export async function handleInteractionCreate(
  interaction: Interaction,
  services: CommandServices
): Promise<void> {
  const handled = await handleAttributeInteraction(interaction, services);

  if (handled) {
    return;
  }

  const characterHandled = await handleCharacterInteraction(interaction, services);

  if (characterHandled) {
    return;
  }

  const jutsuHandled = await handleJutsuInteraction(interaction, services);

  if (jutsuHandled) {
    return;
  }

  const trainingHandled = await handleTrainingInteraction(interaction, services);

  if (trainingHandled) {
    return;
  }

  const periciaHandled = await handlePericiaInteraction(interaction, services);

  if (periciaHandled) {
    return;
  }

  const combatHandled = await handleCombatInteraction(interaction, services);

  if (combatHandled) {
    return;
  }

  const configHandled = await handleConfigInteraction(interaction, services);

  if (configHandled) {
    return;
  }

  const helpHandled = await handleHelpInteraction(interaction, services);

  if (helpHandled) {
    return;
  }
}
