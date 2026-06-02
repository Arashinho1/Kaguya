import type { Message } from "discord.js";

import type { GuildConfigService } from "../modules/guild-config/GuildConfigService.js";

export interface CommandServices {
  guildConfig: GuildConfigService;
}

export interface CommandContext {
  message: Message<true>;
  args: string[];
  commandName: string;
  prefix: string;
  services: CommandServices;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  staffOnly?: boolean;
  execute(context: CommandContext): Promise<void>;
}
