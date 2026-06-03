import type { Message } from "discord.js";

import type { GuildModuleKey } from "../config/defaults.js";
import type { AttributeService } from "../modules/attributes/AttributeService.js";
import type { CharacterService } from "../modules/characters/CharacterService.js";
import type { CombatService } from "../modules/combat/CombatService.js";
import type { GuildConfigService } from "../modules/guild-config/GuildConfigService.js";
import type { JutsuService } from "../modules/jutsus/JutsuService.js";
import type { TrainingService } from "../modules/training/TrainingService.js";
import type { WorldConfigService } from "../modules/world/WorldConfigService.js";

export interface CommandServices {
  attributes: AttributeService;
  characters: CharacterService;
  combat: CombatService;
  guildConfig: GuildConfigService;
  jutsus: JutsuService;
  training: TrainingService;
  world: WorldConfigService;
}

export interface CommandContext {
  message: Message<true>;
  args: string[];
  commandName: string;
  prefix: string;
  services: CommandServices;
}

export type CommandAccess = "owner" | "admin" | "member";

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  access: CommandAccess;
  module?: GuildModuleKey;
  execute(context: CommandContext): Promise<void>;
}
