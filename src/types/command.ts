import type { AttributeService } from "../modules/attributes/AttributeService.js";
import type { CharacterService } from "../modules/characters/CharacterService.js";
import type { GuildConfigService } from "../modules/guild-config/GuildConfigService.js";
import type { JutsuService } from "../modules/jutsus/JutsuService.js";
import type { PericiaService } from "../modules/pericias/PericiaService.js";
import type { TrainingService } from "../modules/training/TrainingService.js";
import type { WorldConfigService } from "../modules/world/WorldConfigService.js";

/**
 * Serviços injetados em todo comando. Cresce a cada módulo reconstruído
 * (combat, economy) — ver plano de reconstrução.
 */
export interface CommandServices {
  guildConfig: GuildConfigService;
  attributes: AttributeService;
  characters: CharacterService;
  world: WorldConfigService;
  training: TrainingService;
  pericias: PericiaService;
  jutsus: JutsuService;
}
