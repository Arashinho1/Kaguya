export const DEFAULT_PREFIX = ".";

export const DEFAULT_GUILD_SETTINGS = [
  {
    key: "logChannelId",
    label: "Canal de logs",
    description: "Canal usado para registrar alteracoes administrativas.",
    value: "",
    valueType: "CHANNEL",
    isPublic: false
  },
  {
    key: "allowMultipleCharacters",
    label: "Multiplos personagens",
    description: "Define se um jogador pode ter mais de um personagem ativo.",
    value: false,
    valueType: "BOOLEAN",
    isPublic: false
  }
] as const;

export const DEFAULT_ATTRIBUTES = [
  { key: "ninjutsu", name: "Ninjutsu", sortOrder: 10 },
  { key: "taijutsu", name: "Taijutsu", sortOrder: 20 },
  { key: "genjutsu", name: "Genjutsu", sortOrder: 30 },
  { key: "chakra", name: "Chakra", sortOrder: 40 },
  { key: "stamina", name: "Stamina", sortOrder: 50 },
  { key: "velocidade", name: "Velocidade", sortOrder: 60 },
  { key: "inteligencia", name: "Inteligencia", sortOrder: 70 }
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
