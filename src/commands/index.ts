import { attributeCommand } from "./admin/attribute.js";
import { configCommand } from "./admin/config.js";
import { setupCommand } from "./admin/setup.js";
import { attributesCommand } from "./info/attributes.js";
import { chakraCommand } from "./info/chakra.js";
import { characterCommand } from "./info/character.js";
import { helpCommand } from "./info/help.js";
import { pingCommand } from "./info/ping.js";
import type { PrefixCommand } from "../types/command.js";

const commandList: PrefixCommand[] = [
  pingCommand,
  helpCommand,
  characterCommand,
  attributesCommand,
  chakraCommand,
  setupCommand,
  configCommand,
  attributeCommand
];

export const commands = new Map<string, PrefixCommand>();

for (const command of commandList) {
  commands.set(command.name, command);

  for (const alias of command.aliases ?? []) {
    commands.set(alias, command);
  }
}
