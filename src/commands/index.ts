import { CommandRegistry } from "../core/commands/index.js";
import type { CommandServices } from "../types/command.js";
import { attributeAdminCommand } from "./attributes.js";
import { characterCommand } from "./characters.js";
import { combatAdminCommand, duelCommand } from "./combat.js";
import { economyAdminCommand, economyCommand } from "./economy.js";
import { helpCommand } from "./help.js";
import { jutsuAdminCommand, jutsuCommand } from "./jutsus.js";
import { meditateCommand } from "./meditation.js";
import { periciaAdminCommand, periciasCommand } from "./pericias.js";
import { setarCommand } from "./setar.js";
import { setupCommand } from "./setup.js";
import { paCommand, trainingCommand } from "./training.js";
import { worldCommand } from "./world.js";

export const commandRegistry = new CommandRegistry<CommandServices>();

for (const command of [
  setupCommand,
  helpCommand,
  setarCommand,
  attributeAdminCommand,
  characterCommand,
  worldCommand,
  trainingCommand,
  paCommand,
  periciasCommand,
  periciaAdminCommand,
  jutsuCommand,
  jutsuAdminCommand,
  meditateCommand,
  duelCommand,
  combatAdminCommand,
  economyCommand,
  economyAdminCommand
]) {
  commandRegistry.register(command);
}
