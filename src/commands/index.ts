import { CommandRegistry } from "../core/commands/index.js";
import type { CommandServices } from "../types/command.js";
import { attributeAdminCommand, attributesCommand } from "./attributes.js";
import { characterCommand } from "./characters.js";
import { jutsuAdminCommand, jutsuCommand } from "./jutsus.js";
import { periciaAdminCommand, periciasCommand } from "./pericias.js";
import { setupCommand } from "./setup.js";
import { paCommand, trainingCommand } from "./training.js";
import { worldCommand } from "./world.js";

export const commandRegistry = new CommandRegistry<CommandServices>();

for (const command of [
  setupCommand,
  attributesCommand,
  attributeAdminCommand,
  characterCommand,
  worldCommand,
  trainingCommand,
  paCommand,
  periciasCommand,
  periciaAdminCommand,
  jutsuCommand,
  jutsuAdminCommand
]) {
  commandRegistry.register(command);
}
