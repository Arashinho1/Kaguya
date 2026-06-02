import type { Interaction } from "discord.js";

import { handleAttributeInteraction } from "../modules/attributes/AttributePanel.js";
import type { CommandServices } from "../types/command.js";

export async function handleInteractionCreate(
  interaction: Interaction,
  services: CommandServices
): Promise<void> {
  const handled = await handleAttributeInteraction(interaction, services);

  if (handled) {
    return;
  }
}
