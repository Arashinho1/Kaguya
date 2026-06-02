import { configCommand } from "./admin/config.js";
import { setupCommand } from "./admin/setup.js";
import { pingCommand } from "./info/ping.js";
import type { PrefixCommand } from "../types/command.js";

const commandList: PrefixCommand[] = [pingCommand, setupCommand, configCommand];

export const commands = new Map<string, PrefixCommand>();

for (const command of commandList) {
  commands.set(command.name, command);

  for (const alias of command.aliases ?? []) {
    commands.set(alias, command);
  }
}
