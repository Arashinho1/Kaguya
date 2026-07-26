import type { AttributeService } from "../modules/attributes/AttributeService.js";
import type { CharacterService } from "../modules/characters/CharacterService.js";
import type { GuildConfigService } from "../modules/guild-config/GuildConfigService.js";

/**
 * Serviços injetados em todo comando. Cresce a cada módulo reconstruído
 * (jutsus, training, ...) — ver plano de reconstrução.
 */
export interface CommandServices {
  guildConfig: GuildConfigService;
  attributes: AttributeService;
  characters: CharacterService;
}
