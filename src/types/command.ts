import type { AttributeService } from "../modules/attributes/AttributeService.js";
import type { CharacterService } from "../modules/characters/CharacterService.js";
import type { CombatService } from "../modules/combat/CombatService.js";
import type { EconomyService } from "../modules/economy/EconomyService.js";
import type { GuildConfigService } from "../modules/guild-config/GuildConfigService.js";
import type { JutsuService } from "../modules/jutsus/JutsuService.js";
import type { PericiaService } from "../modules/pericias/PericiaService.js";
import type { PretensaoService } from "../modules/vagas/PretensaoService.js";
import type { TrainingService } from "../modules/training/TrainingService.js";
import type { VagaService } from "../modules/vagas/VagaService.js";
import type { WorldConfigService } from "../modules/world/WorldConfigService.js";

/** Serviços injetados em todo comando — um por módulo do bot. */
export interface CommandServices {
  guildConfig: GuildConfigService;
  attributes: AttributeService;
  characters: CharacterService;
  world: WorldConfigService;
  training: TrainingService;
  pericias: PericiaService;
  jutsus: JutsuService;
  combat: CombatService;
  economy: EconomyService;
  vagas: VagaService;
  pretensao: PretensaoService;
}
