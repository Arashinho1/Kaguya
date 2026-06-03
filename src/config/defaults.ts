export const DEFAULT_PREFIX = ".";

export const DEFAULT_CHAKRA_FORMULA = {
  sourceAttributeKeys: ["forca", "velocidade", "resistencia"],
  sourceMultiplier: 1,
  isolatedMultiplier: 1,
  directBonus: 0
} as const;

export const DEFAULT_TRAINING_CONFIG = {
  baseCost: 1,
  costPerCurrentValue: 0,
  maxIncreasePerAction: 5
} as const;

export const DEFAULT_MODULE_STATUS = {
  characters: true,
  attributes: true,
  jutsus: true,
  training: true,
  combat: true
} as const;

export type GuildModuleKey = keyof typeof DEFAULT_MODULE_STATUS;

export const DEFAULT_MODULES: Array<{
  key: GuildModuleKey;
  name: string;
  description: string;
}> = [
  {
    key: "characters",
    name: "Fichas",
    description: "Personagens, perfil público e criação/edição de ficha."
  },
  {
    key: "attributes",
    name: "Atributos e Chakra",
    description: "Atributos configuráveis, fórmula de Chakra e painel de atributos."
  },
  {
    key: "jutsus",
    name: "Jutsus",
    description: "Catálogo de jutsus, requisitos e aprendizado por personagem."
  },
  {
    key: "training",
    name: "Treino",
    description: "Pontos de evolução, custo de treino e progressão dos atributos da ficha."
  },
  {
    key: "combat",
    name: "Combate",
    description: "Cenas de combate, participantes, rodadas discretas e ações com jutsus."
  }
];

export function isGuildModuleKey(value: string): value is GuildModuleKey {
  return value in DEFAULT_MODULE_STATUS;
}

export const DEFAULT_GUILD_SETTINGS = [
  {
    key: "logChannelId",
    label: "Log administrativo",
    description: "Canal usado para registrar alterações administrativas.",
    value: "",
    valueType: "CHANNEL",
    isPublic: false
  },
  {
    key: "commandLogChannelId",
    label: "Log de comandos",
    description: "Canal usado para registrar comandos executados neste servidor.",
    value: "",
    valueType: "CHANNEL",
    isPublic: false
  },
  {
    key: "allowMultipleCharacters",
    label: "Múltiplos personagens",
    description: "Define se um jogador pode ter mais de um personagem ativo.",
    value: false,
    valueType: "BOOLEAN",
    isPublic: false
  },
  {
    key: "enabledModules",
    label: "Módulos ativos",
    description: "Define quais módulos do bot estão ativos neste servidor.",
    value: DEFAULT_MODULE_STATUS,
    valueType: "JSON",
    isPublic: false
  },
  {
    key: "chakraFormula",
    label: "Fórmula de Chakra",
    description: "Define como o Chakra derivado é calculado a partir dos atributos base.",
    value: DEFAULT_CHAKRA_FORMULA,
    valueType: "JSON",
    isPublic: true
  },
  {
    key: "trainingConfig",
    label: "Configuração de treino",
    description: "Define custo e limite de evolução de atributos pelo painel de treino.",
    value: DEFAULT_TRAINING_CONFIG,
    valueType: "JSON",
    isPublic: false
  }
] as const;

export const DEFAULT_ATTRIBUTES = [
  { key: "forca", name: "Força", sortOrder: 10 },
  { key: "velocidade", name: "Velocidade", sortOrder: 20 },
  { key: "resistencia", name: "Resistência", sortOrder: 30 },
  {
    key: "chakra",
    name: "Chakra",
    description: "Valor derivado pela fórmula de chakra do servidor.",
    sortOrder: 40
  },
  { key: "ninjutsu", name: "Ninjutsu", sortOrder: 50 },
  { key: "taijutsu", name: "Taijutsu", sortOrder: 60 },
  { key: "genjutsu", name: "Genjutsu", sortOrder: 70 },
  { key: "stamina", name: "Stamina", sortOrder: 80 },
  { key: "inteligencia", name: "Inteligência", sortOrder: 90 }
] as const;

export const DEFAULT_RANKS = [
  { key: "estudante", name: "Estudante", sortOrder: 10 },
  { key: "genin", name: "Genin", sortOrder: 20 },
  { key: "chunin", name: "Chunin", sortOrder: 30 },
  { key: "jonin", name: "Jonin", sortOrder: 40 }
] as const;

export const DEFAULT_JUTSU_TYPES = [
  { key: "ninjutsu", name: "Ninjutsu" },
  { key: "taijutsu", name: "Taijutsu" },
  { key: "genjutsu", name: "Genjutsu" },
  { key: "kekkei_genkai", name: "Kekkei Genkai" }
] as const;
