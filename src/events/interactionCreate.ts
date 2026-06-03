import type { Interaction } from "discord.js";

import { handleAttributeInteraction } from "../modules/attributes/AttributePanel.js";
import { handleCharacterInteraction } from "../modules/characters/CharacterPanel.js";
import { handleConfigInteraction } from "../modules/config-panel/ConfigPanel.js";
import { handleHelpInteraction } from "../modules/help/HelpPanel.js";
import { handleJutsuInteraction } from "../modules/jutsus/JutsuPanel.js";
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

  const configHandled = await handleConfigInteraction(interaction, services);

  if (configHandled) {
    return;
  }

  const helpHandled = await handleHelpInteraction(interaction, services);

  if (helpHandled) {
    return;
  }
}
