import type { AttributeService } from "../modules/attributes/AttributeService.js";
import type { GuildConfigService } from "../modules/guild-config/GuildConfigService.js";

/**
 * Serviços injetados em todo comando. Cresce a cada módulo reconstruído
 * (characters, jutsus, ...) — ver plano de reconstrução.
 */
export interface CommandServices {
  guildConfig: GuildConfigService;
  attributes: AttributeService;
}
