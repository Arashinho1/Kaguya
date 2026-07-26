import { CommandRegistry } from "../core/commands/index.js";
import type { CommandServices } from "../types/command.js";
import { setupCommand } from "./setup.js";

export const commandRegistry = new CommandRegistry<CommandServices>();

for (const command of [setupCommand]) {
  commandRegistry.register(command);
}
