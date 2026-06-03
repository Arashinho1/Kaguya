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
  { key: "forca",              name: "Força",               sortOrder: 10 },
  { key: "velocidade",         name: "Velocidade",          sortOrder: 20 },
  { key: "resistencia",        name: "Resistência",         sortOrder: 30 },
  { key: "chakra",             name: "Chakra",              sortOrder: 40,
    description: "Valor derivado pela fórmula de chakra do servidor." },
  { key: "ninjutsu",           name: "Ninjutsu",            sortOrder: 50,
    description: "Técnicas ninja comuns — clones, substituição, rasengan e similares." },
  { key: "ninjutsu_elemental", name: "Ninjutsu Elemental",  sortOrder: 55,
    description: "Domínio sobre as liberações elementais — Katon, Suiton, Raiton, Doton, Futon." },
  { key: "taijutsu",           name: "Taijutsu",            sortOrder: 60 },
  { key: "genjutsu",           name: "Genjutsu",            sortOrder: 70 }
] as const;

export const DEFAULT_RANKS = [
  { key: "estudante",      name: "Estudante",      sortOrder: 10, description: "Estudante da Academia Ninja. Ainda não é um ninja oficial." },
  { key: "genin",          name: "Genin",           sortOrder: 20, description: "Ninja de campo iniciante. Realiza missões D e C com supervisão." },
  { key: "chunin",         name: "Chunin",          sortOrder: 30, description: "Ninja experiente. Apto para liderar equipes e missões B." },
  { key: "jonin",          name: "Jonin",           sortOrder: 40, description: "Ninja de elite com alto domínio do chakra e das técnicas." },
  { key: "jonin_especial", name: "Jonin Especial",  sortOrder: 50, description: "Especialista em determinada área. Não tem responsabilidade de liderança." },
  { key: "sannin",         name: "Sannin",          sortOrder: 60, description: "Lendário — poder equivalente a Kage. Extremamente raro." }
] as const;

export const DEFAULT_JUTSU_TYPES = [
  // ─── Categorias base ───────────────────────────────────────────────────────
  { key: "ninjutsu",           name: "Ninjutsu" },
  { key: "taijutsu",           name: "Taijutsu" },
  { key: "genjutsu",           name: "Genjutsu" },
  { key: "kenjutsu",           name: "Kenjutsu" },
  { key: "bukijutsu",          name: "Bukijutsu" },
  { key: "fuinjutsu",          name: "Fuinjutsu" },
  { key: "ijutsu",             name: "Ijutsu" },
  { key: "iryo_ninjutsu",      name: "Iryo Ninjutsu" },
  { key: "senjutsu",           name: "Senjutsu" },
  { key: "hiden",              name: "Hiden" },
  { key: "jujutsu",            name: "Jujutsu" },

  // ─── Ninjutsu elementais ────────────────────────────────────────────────────
  { key: "katon",              name: "Katon" },
  { key: "suiton",             name: "Suiton" },
  { key: "raiton",             name: "Raiton" },
  { key: "doton",              name: "Doton" },
  { key: "futon",              name: "Futon" },

  // ─── Kekkei Genkai e subtypes ───────────────────────────────────────────────
  { key: "kekkei_genkai",      name: "Kekkei Genkai" },
  { key: "hyouton",            name: "Hyouton" },
  { key: "ranton",             name: "Ranton" },
  { key: "youton",             name: "Youton" },
  { key: "bakuton",            name: "Bakuton" },
  { key: "futton",             name: "Futton" },
  { key: "shakuton",           name: "Shakuton" },
  { key: "shouton",            name: "Shouton" },
  { key: "meiton",             name: "Meiton" },
  { key: "kouton",             name: "Kouton" },
  { key: "taiton",             name: "Taiton" },
  { key: "jinton_poeira",      name: "Jinton (Poeira)" },
  { key: "jinton_velocidade",  name: "Jinton (Velocidade)" },
  { key: "jiryoku",            name: "Jiryoku" },
  { key: "satetsu",            name: "Satetsu" },
  { key: "sakin",              name: "Sakin" },
  { key: "douka",              name: "Douka no Jutsu" },

  // ─── Taijutsu especializações ───────────────────────────────────────────────
  { key: "hachimon",           name: "Hachimon Tonkou" },
  { key: "shichi_ten_kohou",   name: "Shichi Ten Kohou" },

  // ─── Exclusivos / Dojutsu ────────────────────────────────────────────────────
  { key: "mangekyougan",       name: "Mangekyougan" },
  { key: "akagan",             name: "Akagan" },
  { key: "rinnegan",           name: "Rinnegan" },
  { key: "hiraishin",          name: "Hiraishin" },
  { key: "jiongu",             name: "Jiongu" },
  { key: "kujaku",             name: "Kujaku" },

  // ─── Kuchiyose (Invocações) ─────────────────────────────────────────────────
  { key: "kuchiyose",                   name: "Kuchiyose" },
  { key: "kuchiyose_sapos",             name: "Kuchiyose — Sapos" },
  { key: "kuchiyose_cobras",            name: "Kuchiyose — Cobras" },
  { key: "kuchiyose_lesmas",            name: "Kuchiyose — Lesmas" },
  { key: "kuchiyose_caes",              name: "Kuchiyose — Cães" },
  { key: "kuchiyose_aves",              name: "Kuchiyose — Aves" },
  { key: "kuchiyose_macacos",           name: "Kuchiyose — Macacos" },
  { key: "kuchiyose_gatos",             name: "Kuchiyose — Gatos" },
  { key: "kuchiyose_aranhas",           name: "Kuchiyose — Aranhas" },
  { key: "kuchiyose_elefantes",         name: "Kuchiyose — Elefantes" },
  { key: "kuchiyose_doninhas",          name: "Kuchiyose — Doninhas" },
  { key: "kuchiyose_tartarugas",        name: "Kuchiyose — Tartarugas" },
  { key: "kuchiyose_rashoumon",         name: "Kuchiyose — Rashoumon" },
  { key: "kuchiyose_animais_marinhos",  name: "Kuchiyose — Animais Marinhos" },
  { key: "kuchiyose_shikon",            name: "Kuchiyose — Shikon" },
  { key: "kuchiyose_rinnegan",          name: "Kuchiyose — Rinnegan" },

  // ─── Técnicas de Clãs ────────────────────────────────────────────────────────
  { key: "cla_uchiha",         name: "Clã Uchiha" },
  { key: "cla_senju",          name: "Clã Senju" },
  { key: "cla_uzumaki",        name: "Clã Uzumaki" },
  { key: "cla_hyuuga",         name: "Clã Hyuuga" },
  { key: "cla_nara",           name: "Clã Nara" },
  { key: "cla_akimichi",       name: "Clã Akimichi" },
  { key: "cla_yamanaka",       name: "Clã Yamanaka" },
  { key: "cla_inuzuka",        name: "Clã Inuzuka" },
  { key: "cla_aburame",        name: "Clã Aburame" },
  { key: "cla_hozuki",         name: "Clã Hozuki" },
  { key: "cla_kaguya",         name: "Clã Kaguya" },
  { key: "cla_juugo",          name: "Clã Juugo" },
  { key: "cla_kurama",         name: "Clã Kurama" },
  { key: "cla_kamizurui",      name: "Clã Kamizurui" },
  { key: "cla_iburi",          name: "Clã Iburi" },
  { key: "cla_origami",        name: "Clã Origami" },
  { key: "cla_otenki",         name: "Clã Otenki" },
  { key: "cla_kihai",          name: "Clã Kihai" },
  { key: "cla_jibakujutsu",    name: "Jibakujutsu" },
  { key: "cla_kugutsu",        name: "Kugutsu no Jutsu" },
  { key: "cla_kibaku_nendo",   name: "Kibaku Nendo" },
  { key: "cla_soma_no_ko",     name: "Soma no Ko" },
  { key: "cla_kazama",         name: "Clã Kazama" },
  { key: "cla_sarutobi",       name: "Clã Sarutobi" },
  { key: "cla_seibutsu",       name: "Clã Seibutsu" },
  { key: "cla_rinnegan",       name: "Clã Rinnegan" }
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Aldeias oficiais do universo Naruto
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_VILLAGES = [
  // Cinco Grandes Nações
  { name: "Konohagakure",  description: "Vila Oculta das Folhas — País do Fogo. Sede dos Hokage." },
  { name: "Sunagakure",    description: "Vila Oculta da Areia — País do Vento. Sede dos Kazekage." },
  { name: "Kirigakure",    description: "Vila Oculta da Névoa — País da Água. Sede dos Mizukage." },
  { name: "Kumogakure",    description: "Vila Oculta das Nuvens — País do Trovão. Sede dos Raikage." },
  { name: "Iwagakure",     description: "Vila Oculta das Pedras — País da Terra. Sede dos Tsuchikage." },
  // Aldeias menores notáveis
  { name: "Otogakure",     description: "Vila do Som — fundada por Orochimaru." },
  { name: "Amegakure",     description: "Vila da Chuva — governada por Nagato (Pain)." },
  { name: "Takigakure",    description: "Vila da Cachoeira — País da Cachoeira." },
  { name: "Kusagakure",    description: "Vila da Grama — País da Grama." },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Clãs oficiais do universo Naruto
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_CLANS = [
  // ── Konoha ──────────────────────────────────────────────────────────────────
  { name: "Uchiha",     description: "Clã do Sharingan. Os mais poderosos usuários de genjutsu e katon. Quase extintos após o massacre de Itachi." },
  { name: "Senju",      description: "Clã dos Mil Braços. Co-fundadores de Konoha. Kekkei Genkai: Mokuton (Liberação de Madeira)." },
  { name: "Uzumaki",    description: "Clã do Redemoinho. Especialistas em fuinjutsu e longevidade excepcional. Aliados históricos do Clã Senju." },
  { name: "Hyuuga",     description: "Clã do Byakugan. Estilo de combate Jūken (Punho Gentil). O maior clã de Konoha." },
  { name: "Nara",       description: "Clã das Técnicas de Sombra. Inteligência estratégica superior. Aliados dos Akimichi e Yamanaka." },
  { name: "Akimichi",   description: "Clã da Expansão Corporal. Usam calorias como fonte de chakra para técnicas poderosas." },
  { name: "Yamanaka",   description: "Clã da Transferência Mental. Especialistas em técnicas de mente e comunicação telepática." },
  { name: "Inuzuka",    description: "Clã dos Ninken. Combatem em duo com seus cães ninja usando técnicas de fusão." },
  { name: "Aburame",    description: "Clã dos Insetos Parasitas. Os kikaichu habitam seus corpos e drenam chakra do oponente." },
  { name: "Sarutobi",   description: "Clã do Terceiro Hokage (Hiruzen). Domínio dos Cinco Elementos e uso do macaco Enma." },
  { name: "Hatake",     description: "Clã de Kakashi Hatake. Famosos pelo domínio do Chidori/Raikiri e cópia de técnicas." },
  { name: "Namikaze",   description: "Clã do Yondaime Hokage, Minato. Criadores do Hiraishin no Jutsu e do Rasengan." },
  // ── Kiri ────────────────────────────────────────────────────────────────────
  { name: "Hōzuki",     description: "Clã da Hidratação Corporal. Transformam o corpo em água para evitar dano físico." },
  { name: "Kaguya",     description: "Clã da Liberação Óssea (Shikotsumyaku). Manipulam seus próprios ossos como armas." },
  { name: "Yuki",       description: "Clã do Hyouton (Liberação de Gelo). Kekkei Genkai: fusão de Suiton e Futon." },
  { name: "Terumi",     description: "Clã da Quinta Mizukage. Kekkei Genkai: Futton (Fervura) e Youton (Lava)." },
  { name: "Momochi",    description: "Clã de Zabuza Momochi, um dos Sete Espadachins da Névoa. Usuários da Kubikiriboutou." },
  // ── Suna ────────────────────────────────────────────────────────────────────
  { name: "Sabaku",     description: "Clã da família Kazekage. Manipulação da areia e selos de chakra magnético." },
  // ── Kumo ────────────────────────────────────────────────────────────────────
  { name: "Yotsuki",    description: "Clã do Raikage A e Killer Bee. Especialistas em Raiton e técnicas de espada dupla." },
  // ── Iwa ─────────────────────────────────────────────────────────────────────
  { name: "Tsuchikage", description: "Linhagem dos Tsuchikage. Kekkei Tota: Jinton (Liberação de Poeira — Futon + Doton + Katon)." },
  // ── Sem aldeia fixa ─────────────────────────────────────────────────────────
  { name: "Ōtsutsuki",  description: "Clã ancestral alienígena. Kaguya e Hagoromo (Rikudou Sennin) são os mais conhecidos." },
  { name: "Jūgo",       description: "Clã da Transformação Sábia (Senninka). Absorvem energia natural passivamente, causando instabilidade mental." },
] as const;
