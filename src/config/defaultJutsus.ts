/**
 * Jutsus padrão criados pelo .setup.
 * Rankings seguem a classificação oficial da wiki Naruto (E/D/C/B/A/S).
 * Fonte: narutofasex.forumeiros.com (fan-RPG) — técnicas verificadas contra a wiki oficial.
 */
export interface DefaultJutsuEntry {
  key: string;
  name: string;
  description?: string;
  typeKey: string;
  /** Classificação canônica do jutsu: E, D, C, B, A ou S */
  jutsuRank?: string;
  chakraCost: number;
  duration?: string;
  usageLimit?: number;
}

export const DEFAULT_JUTSU_DATA: DefaultJutsuEntry[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // KATON (Liberação de Fogo)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "katon_ho_shunshin",       name: "Ho Shunshin no Jutsu",          typeKey: "katon",   jutsuRank: "D", chakraCost: 20, duration: "1 rodada",  description: "Técnica de transporte instantâneo através das chamas." },
  { key: "katon_hibashiri",         name: "Katon: Hibashiri",               typeKey: "katon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Libera chakra pelo chão criando barreira circular de fogo ao redor do oponente." },
  { key: "katon_housenka",          name: "Katon: Housenka no Jutsu",       typeKey: "katon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Dispara múltiplas bolas de fogo simultâneas; pode conter ferramentas ninja ocultas." },
  { key: "katon_goukakyuu",         name: "Katon: Goukakyuu no Jutsu",      typeKey: "katon",   jutsuRank: "D", chakraCost: 40, duration: "1 rodada",  description: "Técnica icônica do Clã Uchiha; expele uma grande bola de fogo pela boca." },
  { key: "kumo_ryuu_kaengiri",      name: "Kumo Ryuu: Kaengiri",            typeKey: "katon",   jutsuRank: "D", chakraCost: 50, duration: "1 rodada",  description: "Ataque de lâmina infundida com fogo. Requer arma cortante." },
  // Rank C
  { key: "katon_endan",             name: "Katon: Endan",                   typeKey: "katon",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Técnica à base de óleo; não requer selos manuais." },
  { key: "katon_onidourou",         name: "Katon: Onidourou",               typeKey: "katon",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Bolas de fogo fantasmagóricas que detonam simultaneamente sob comando." },
  { key: "katon_no_tate",           name: "Katon no Tate",                  typeKey: "katon",   jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Barreira protetora frontal de fogo." },
  { key: "katon_gouryuuka",         name: "Katon: Gouryuuka no Jutsu",      typeKey: "katon",   jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2,  description: "Bolas de fogo com cabeça de dragão expelidas pela boca." },
  { key: "katon_haisekishou",       name: "Katon: Haisekishou",             typeKey: "katon",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Explosão de fumaça ao contato causando queimaduras." },
  { key: "katon_ryuuka",            name: "Katon: Ryuuka no Jutsu",         typeKey: "katon",   jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  description: "Fogo que viaja por um condutor metálico em direção ao inimigo. Requer fio de aço." },
  { key: "katon_kaen_senpuu",       name: "Katon: Kaen Senpuu",             typeKey: "katon",   jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Redemoinho de fogo ao redor do corpo; pode ser ofensivo ou defensivo." },
  { key: "katon_zukkoku",           name: "Katon: Zukkoku",                 typeKey: "katon",   jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2,  description: "Onda de chamas massiva capaz de devastar áreas florestais." },
  { key: "tenrou_kaken",            name: "Tenrou Kaken",                   typeKey: "katon",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 3,  description: "Lâmina de fogo formada ao redor do braço; queima instantaneamente ao contato." },
  // Rank B
  { key: "katon_gouen",             name: "Katon: Gouen no Jutsu",          typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Fluxo de chamas em expansão pela boca; calor suficiente para evaporar água." },
  { key: "katon_dai_endan",         name: "Katon: Dai Endan",               typeKey: "katon",   jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Bomba de fogo aprimorada com poder de bomba incendiária." },
  { key: "katon_gouka_ame",         name: "Katon: Gouka Ame no Jutsu",      typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Múltiplas bolas de fogo do tamanho de meteoros caindo sobre o alvo." },
  { key: "katon_karyuu_endan",      name: "Katon: Karyuu Endan",            typeKey: "katon",   jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Explosão de chamas em forma de dragão cobrindo frente e lados." },
  { key: "katon_ryuuen_houka",      name: "Katon: Ryuuen Houka no Jutsu",   typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Múltiplas bolas de fogo com cabeça de dragão controláveis." },
  { key: "katon_gouenka",           name: "Katon: Gouenka",                 typeKey: "katon",   jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Três esferas de fogo do tamanho de meteoros; eficaz a partir de posição elevada." },
  { key: "katon_housenka_tsumabeni",name: "Katon: Housenka Tsumabeni",      typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Versão aprimorada do Housenka que inflama as armas do usuário em projéteis flamejantes." },
  // Rank A
  { key: "katon_haijingakure",      name: "Katon: Haijingakure no Jutsu",   typeKey: "katon",   jutsuRank: "A", chakraCost: 100, usageLimit: 1,        description: "Névoa de chakra incandescente que queima e camuflha o usuário simultaneamente." },
  { key: "katon_bakufuu_ranbu",     name: "Katon: Bakufuu Ranbu",           typeKey: "katon",   jutsuRank: "A", chakraCost: 100, duration: "1 rodada",  description: "Vórtice de chamas em espiral expelido pela boca." },
  { key: "katon_tenrou",            name: "Katon: Tenrou",                  typeKey: "katon",   jutsuRank: "A", chakraCost: 100, usageLimit: 1,        description: "Fórmula sellante que impede a moldagem de chakra e o uso de jutsus." },
  { key: "kanhoudan",               name: "Kanhoudan",                      typeKey: "katon",   jutsuRank: "A", chakraCost: 100, duration: "2 rodadas", usageLimit: 1,  description: "Explosão de fumaça cinza que aumenta calor atmosférico e poder das técnicas de fogo." },
  { key: "katon_gouenkyuu",         name: "Katon: Gouenkyuu",               typeKey: "katon",   jutsuRank: "A", chakraCost: 100, duration: "1 rodada",  description: "Bola de fogo do tamanho de um meteoro que detona ao impacto." },
  { key: "katon_gouen_rasengan",    name: "Katon: Gouen Rasengan",          typeKey: "katon",   jutsuRank: "A", chakraCost: 100, usageLimit: 1,        description: "Rasengan infundido com chakra de fogo. Requer conhecimento do Rasengan." },
  // Rank S
  { key: "katon_gouka_mekkyaku",    name: "Katon: Gouka Mekkyaku",          typeKey: "katon",   jutsuRank: "S", chakraCost: 300, duration: "1 rodada",  description: "Enorme explosão de chamas em área ampla; requer múltiplos usuários de água para neutralizar." },
  { key: "katon_gouka_messhitsu",   name: "Katon: Gouka Messhitsu",         typeKey: "katon",   jutsuRank: "S", chakraCost: 500, duration: "1 rodada",  usageLimit: 1,  description: "A técnica Katon mais poderosa conhecida; cobre amplas áreas laterais." },

  // ═══════════════════════════════════════════════════════════════════════
  // SUITON (Liberação de Água)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "suiton_shunsui",          name: "Shunsui",                        typeKey: "suiton",  jutsuRank: "D", chakraCost: 20, duration: "1 rodada",  description: "Cria água sob os pés para impulsionar velocidade em direção ao oponente." },
  { key: "suiton_shigure",          name: "Suiton: Shigure",                typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Projéteis de água pressurizada golpeiam múltiplas vezes rapidamente." },
  { key: "suiton_tenkyuu",          name: "Tenkyuu",                        typeKey: "suiton",  jutsuRank: "D", chakraCost: 10, duration: "1 rodada",  description: "Agulhas d'água disparadas em alta velocidade." },
  { key: "mizudeppou",              name: "Mizudeppou no Jutsu",            typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Dispara balas d'água com a força de uma arma de fogo." },
  { key: "suiton_mizu_teppou",      name: "Suiton: Mizu Teppou",            typeKey: "suiton",  jutsuRank: "D", chakraCost: 10, duration: "1 rodada",  description: "Fluxo básico de água capaz de destruir rochas médias." },
  { key: "suiton_suiben",           name: "Suiton: Suiben",                 typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Cria um chicote de água que restringe o inimigo; pode ser eletrificado com Raiton." },
  { key: "mizu_bunshin",            name: "Mizu Bunshin no Jutsu",          typeKey: "suiton",  jutsuRank: "D", chakraCost: 30,                        description: "Cria clones de água com 1/10 do poder do usuário; dobra a força dentro d'água." },
  { key: "suiton_kirigakure",       name: "Suiton: Kirigakure no Jutsu",    typeKey: "suiton",  jutsuRank: "D", chakraCost: 80,                        description: "Névoa densa que reduz a visibilidade de todos a zero." },
  { key: "nensuikai",               name: "Nensuikai",                      typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Cria escudo protetor de água." },
  // Rank C
  { key: "suiton_suiryuudan",       name: "Suiton: Suiryuudan no Jutsu",    typeKey: "suiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Um grande dragão de água emerge do chão para atacar." },
  { key: "suiton_suijinheki",       name: "Suiton: Suijinheki",             typeKey: "suiton",  jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Fluxo de água forma barreira protetora." },
  { key: "suirou",                  name: "Suirou no Jutsu",                typeKey: "suiton",  jutsuRank: "C", chakraCost: 20,                        usageLimit: 1,  description: "Bolha resistente a aço aprisiona o alvo." },
  { key: "suiton_suikoudan",        name: "Suiton: Suikoudan no Jutsu",     typeKey: "suiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Tubarão formado de água golpeia com força." },
  { key: "suiton_suigadan",         name: "Suiton: Suigadan",               typeKey: "suiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Colunas de água em forma de broca emergem para perfurar. Requer fonte d'água." },
  { key: "suiton_hahonryu",         name: "Suiton: Hahonryu",               typeKey: "suiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Esfera de água em espiral explode em tornado." },
  { key: "suiton_ja_no_kuchi",      name: "Suiton: Ja no Kuchi",            typeKey: "suiton",  jutsuRank: "C", chakraCost: 40,                        usageLimit: 2,  description: "Coluna de água rotativa em forma de serpente com presas." },
  { key: "mizu_kawarimi",           name: "Mizu Kawarimi",                  typeKey: "suiton",  jutsuRank: "C", chakraCost: 10,                        usageLimit: 1,  description: "Transforma o corpo em líquido para escapar de ataques." },
  { key: "suiton_daibakuryuu",      name: "Suiton: Daibakuryuu",            typeKey: "suiton",  jutsuRank: "C", chakraCost: 20,                        usageLimit: 1,  description: "Redemoinho que aprisiona inimigos." },
  { key: "suiton_mizuame_nabara",   name: "Suiton: Mizuame Nabara",         typeKey: "suiton",  jutsuRank: "C", chakraCost: 70, duration: "1 rodada",  description: "Líquido pegajoso cobre 20 metros quadrados aprisionando quem passar." },
  { key: "hijutsu_kirisame",        name: "Hijutsu: Kirisame",              typeKey: "suiton",  jutsuRank: "C", chakraCost: 30, duration: "2 rodadas", usageLimit: 1,  description: "Névoa que drena chakra e restringe o uso de jutsus." },
  // Rank B
  { key: "suiton_deryuudan",        name: "Suiton: Deryuudan no Jutsu",     typeKey: "suiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Formação de onda massiva golpeia alvos com força." },
  { key: "suiton_suiryuuben",       name: "Suiton: Suiryuuben",             typeKey: "suiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Esfera d'água libera chicotes perfurantes em múltiplas direções." },
  { key: "suishuu_gorugon",         name: "Suishuu Gorugon",                typeKey: "suiton",  jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Dragão de água dez vezes maior que envolve e explode o inimigo." },
  { key: "suiton_bakusui_shouha",   name: "Suiton: Bakusui Shouha",         typeKey: "suiton",  jutsuRank: "B", chakraCost: 50,                        usageLimit: 1,  description: "Usuário cavalga onda massiva que inunda toda a área." },
  { key: "suiton_suidan",           name: "Suiton: Suidan no Jutsu",        typeKey: "suiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Fluxo de água altamente versátil com corrente poderosa." },
  { key: "suiton_mizu_kamikiri",    name: "Suiton: Mizu Kamikiri",          typeKey: "suiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Onda fina de água que fatia pedra sólida." },
  // Rank A
  { key: "suiton_daibakuru",        name: "Suiton: Daibakuru no Jutsu",     typeKey: "suiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Jato de água poderoso que percorre longas distâncias com força esmagadora." },
  { key: "suiton_mugensame",        name: "Suiton: Mugensame",              typeKey: "suiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Milhares de tubarões de água perseguem alvos aquáticos." },
  { key: "suiton_daibaku_suishouha",name: "Suiton: Daibaku Suishouha",      typeKey: "suiton",  jutsuRank: "A", chakraCost: 100, duration: "2 rodadas",usageLimit: 1,  description: "Descarga massiva de água inunda toda a localização." },
  // Rank S
  { key: "suiton_senshokukou",      name: "Suiton: Senshokukou",            typeKey: "suiton",  jutsuRank: "S", chakraCost: 300, duration: "1 rodada", description: "Variante extremamente poderosa com tubarões sólidos, não feitos de água." },
  { key: "suiton_dai_bakusui_shouha",name: "Suiton: Dai Bakusui Shouha",   typeKey: "suiton",  jutsuRank: "S", chakraCost: 300,                        usageLimit: 1,  description: "Descarga gigantesca de água que inunda toda uma região." },

  // ═══════════════════════════════════════════════════════════════════════
  // RAITON (Liberação de Relâmpago)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "raiton_denkou_noroshi",   name: "Raiton: Denkou Noroshi",         typeKey: "raiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Flecha de relâmpago básica de liberação elétrica." },
  { key: "raiton_raishindou",       name: "Raishindou",                     typeKey: "raiton",  jutsuRank: "D", chakraCost: 40, duration: "1 rodada",  description: "Raio oscilante de energia elétrica." },
  { key: "raiton_sanda",            name: "Raiton: Sanda",                  typeKey: "raiton",  jutsuRank: "D", chakraCost: 50, duration: "1 rodada",  description: "Descarga elétrica básica de liberação de relâmpago." },
  // Rank C
  { key: "raiton_sandaaboruto",     name: "Raiton: Sandaaboruto",           typeKey: "raiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Projétil elétrico em forma de parafuso trovejante." },
  { key: "raiton_amigumo",          name: "Raiton: Amigumo",                typeKey: "raiton",  jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Rede elétrica que imobiliza o alvo." },
  { key: "raiton_gian",             name: "Raiton: Gian",                   typeKey: "raiton",  jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2,  description: "Relâmpago de alta voltagem disparado diretamente." },
  { key: "raiton_kaminari_shibari", name: "Raiton: Kaminari Shibari",       typeKey: "raiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 1,  description: "Correntes de relâmpago que imobilizam o oponente." },
  { key: "raiton_inadzumanoken",    name: "Raiton: Inadzumanoken",          typeKey: "raiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 3,  description: "Golpe de lâmina eletrificada na velocidade do relâmpago." },
  { key: "raiton_zankoo",           name: "Zankou",                         typeKey: "raiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 1,  description: "Flash de relâmpago cegante." },
  { key: "raiton_raigingubonba",    name: "Raijingubonbā",                  typeKey: "raiton",  jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2,  description: "Bomba de energia crescente de relâmpago." },
  // Rank B
  { key: "chidori",                 name: "Chidori",                        typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Técnica dos Mil Pássaros — concentração de chakra elétrico na mão para investida perfurante." },
  { key: "chidori_nagashi",         name: "Chidori Nagashi",                typeKey: "raiton",  jutsuRank: "B", chakraCost: 30, duration: "1 rodada",  usageLimit: 1,  description: "Libera correntes de Chidori por todo o corpo como defesa." },
  { key: "chidori_senbon",          name: "Chidori Senbon",                 typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Chidori transformado em múltiplas agulhas de chakra elétrico." },
  { key: "chidori_eisou",           name: "Chidori Eisou",                  typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Chidori estendido em forma de espada longa." },
  { key: "raiton_rairyuu_tatsumaki",name: "Raiton Ninpou: Rairyuu no Tatsumaki", typeKey: "raiton", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Dragão de relâmpago em tornado; pode ser usado ofensiva ou defensivamente." },
  { key: "raiton_raiu",             name: "Raiton: Raiu",                   typeKey: "raiton",  jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  usageLimit: 1,  description: "Tempestade de relâmpagos abrangente." },
  { key: "raijuu_hashiri",          name: "Raijuu Hashiri no Jutsu",        typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Movimento de alta velocidade infundido com chakra de relâmpago." },
  // Rank A
  { key: "raikiri",                 name: "Raikiri",                        typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1,  description: "A Espada Relâmpago — versão suprema do Chidori com poder de cortar raios." },
  { key: "raikiri_issen",           name: "Raikiri Issen",                  typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1,  description: "Corte único de Raikiri executado com precisão máxima." },
  { key: "raiden",                  name: "Raiden",                         typeKey: "raiton",  jutsuRank: "A", chakraCost: 200, duration: "1 rodada", usageLimit: 1,  description: "Transmissão de relâmpago de potência máxima." },
  { key: "raiton_juurokuchuu_shibari",name: "Raiton: Juurokuchuu Shibari", typeKey: "raiton",  jutsuRank: "A", chakraCost: 20,  duration: "1 rodada", usageLimit: 1,  description: "Dezesseis pilares de relâmpago que aprisionam completamente o oponente." },
  { key: "raiton_jibashi",          name: "Raiton: Jibashi",                typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Descarga elétrica de alta potência propagada pelo solo." },
  { key: "raiton_no_yoroi",         name: "Raiton no Yoroi",                typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "3 rodadas",usageLimit: 1,  description: "Armadura de chakra elétrico que aumenta força, velocidade e resistência." },
  { key: "chidori_raimei",          name: "Chidori Raimei",                 typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Versão trovejante máxima do Chidori com área de efeito expandida." },
  // Rank S
  { key: "jigokuzuki_sanbon_nukite",name: "Jigokuzuki - Sanbon Nukite",     typeKey: "raiton",  jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1,  description: "Três dedos infundidos com relâmpago de nível máximo perfuram o oponente." },
  { key: "habateku_chidori",        name: "Habateku Chidori",               typeKey: "raiton",  jutsuRank: "S", chakraCost: 500, duration: "1 rodada", usageLimit: 1,  description: "Chidori em nível máximo expelido em forma de asas de relâmpago." },
  { key: "kirin",                   name: "Kirin",                          typeKey: "raiton",  jutsuRank: "S", chakraCost: 0,   duration: "1 rodada", usageLimit: 1,  description: "Invoca um raio real da nuvem de tempestade guiado pelo usuário. O raio é natural; chakra praticamente zero." },

  // ═══════════════════════════════════════════════════════════════════════
  // DOTON (Liberação de Terra)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "doton_dorojigoku",        name: "Doton: Dorojigoku",              typeKey: "doton",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Manipula a terra para aprisionar membros ou corpo do inimigo." },
  { key: "doton_doryuuha",          name: "Doton: Doryuuha",                typeKey: "doton",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Cria onda de terra para ataque ou defesa." },
  { key: "doton_dochuu_baku",       name: "Doton: Dochuu Baku",             typeKey: "doton",   jutsuRank: "D", chakraCost: 50, duration: "1 rodada",  description: "Envia onda de terra misturada com pedras em direção ao inimigo." },
  { key: "doton_tsuchi_doumu",      name: "Doton: Tsuchi Doumu",            typeKey: "doton",   jutsuRank: "D", chakraCost: 50,                        description: "Domo protetor de pedra." },
  { key: "doton_doroku_gaeshi",     name: "Doton: Doroku Gaeshi",           typeKey: "doton",   jutsuRank: "D", chakraCost: 40, duration: "1 rodada",  description: "Escudo de terra frontal levantado rapidamente." },
  { key: "doton_dochuu_senkou",     name: "Doton: Dochuu Senkou",           typeKey: "doton",   jutsuRank: "D", chakraCost: 40,                        description: "Movimento subterrâneo de alta velocidade." },
  { key: "doton_retsudo_tenshin",   name: "Doton: Retsudo Tenshin",         typeKey: "doton",   jutsuRank: "D", chakraCost: 40,                        description: "Grande projétil de agulha de lama." },
  // Rank C
  { key: "doton_kajuugan",          name: "Doton: Kajuugan",                typeKey: "doton",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 2,  description: "Aumenta o peso e a força do usuário." },
  { key: "doton_kejuugan",          name: "Doton: Kejuugan",                typeKey: "doton",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 2,  description: "Reduz o peso e aumenta a velocidade do usuário." },
  { key: "doton_suijiku_kabe",      name: "Doton: Suijiku Kabe",            typeKey: "doton",   jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Muro de lama defensivo erguido rapidamente." },
  { key: "doton_doryuu_taiga",      name: "Doton: Doryuu Taiga",            typeKey: "doton",   jutsuRank: "C", chakraCost: 60, duration: "1 rodada",  description: "Cria rio de lama que lança o inimigo a 80 metros de distância." },
  { key: "doton_domu",              name: "Doton: Domu",                    typeKey: "doton",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Endurece partes do corpo com resistência de diamante." },
  { key: "doton_arijigoku",         name: "Doton: Arijigoku",               typeKey: "doton",   jutsuRank: "C", chakraCost: 100,                       description: "Vítima é sugada para o solo com risco de sufocamento." },
  // Rank B
  { key: "doton_kiretsu",           name: "Doton: Kiretsu",                 typeKey: "doton",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Grande fissura abre no solo fazendo as vítimas caírem." },
  { key: "doton_yomi_numa",         name: "Doton: Yomi Numa",               typeKey: "doton",   jutsuRank: "B", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Pântano criado no solo imobiliza inimigos que pisarem nele." },
  { key: "doton_iwa_no_yoroi",      name: "Doton: Iwa no Yoroi",            typeKey: "doton",   jutsuRank: "B", chakraCost: 50, duration: "3 rodadas", usageLimit: 1,  description: "Armadura de diamante endurecida que aumenta força e resistência." },
  { key: "doton_iwabashira_hakai",  name: "Doton: Iwabashira Hakai",        typeKey: "doton",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Gigantescos pilares de pedra perfurantes emergem do solo." },
  // Rank S
  { key: "doton_soseijutsu",        name: "Doton Soseijutsu: Shishi Dojou", typeKey: "doton",   jutsuRank: "S", chakraCost: 100, duration: "3 rodadas",usageLimit: 1,  description: "Ressuscita ninjas mortos como zumbis controláveis. Considerado kinjutsu." },

  // ═══════════════════════════════════════════════════════════════════════
  // FUTON (Liberação de Vento)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "futon_shinkuudama",       name: "Futon: Shinkuudama",             typeKey: "futon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Esferas de vácuo capazes de destruir estruturas fortificadas." },
  { key: "futon_ressenpuu",         name: "Ressenpuu",                      typeKey: "futon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Rajada violenta de vento pela boca eficaz contra múltiplos inimigos." },
  { key: "futon_daitoppa",          name: "Futon: Daitoppa no Jutsu",       typeKey: "futon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Explosão de vento que lança todos os oponentes para longe." },
  { key: "futon_toppa",             name: "Futon: Toppa no Jutsu",          typeKey: "futon",   jutsuRank: "D", chakraCost: 20, duration: "1 rodada",  description: "Chakra comprimido formando pequenas esferas de vento cortante." },
  { key: "futon_shinkuujin",        name: "Futon: Shinkuujin",              typeKey: "futon",   jutsuRank: "D", chakraCost: 50, duration: "1 rodada",  description: "Lâmina aprimorada pelo vento com poder de corte aumentado. Requer arma cortante." },
  { key: "futon_reppushou",         name: "Futon: Reppushou",               typeKey: "futon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Onda de vento que aumenta velocidade de projéteis. Requer kunai ou shuriken." },
  { key: "futon_zankuuha",          name: "Zankuuha",                       typeKey: "futon",   jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Ondas de ar cortante em velocidade supersônica." },
  { key: "kaze_shunshin",           name: "Kaze Shunshin no Jutsu",         typeKey: "futon",   jutsuRank: "D", chakraCost: 30,                        description: "Transporte rápido através de um pequeno redemoinho de vento." },
  // Rank C
  { key: "futon_atsugai",           name: "Futon: Atsugai",                 typeKey: "futon",   jutsuRank: "C", chakraCost: 90, duration: "1 rodada",  description: "Onda de vento gigante devastando raio de cinquenta metros." },
  { key: "futon_kamikaze",          name: "Futon: Kamikaze",                typeKey: "futon",   jutsuRank: "C", chakraCost: 90, duration: "1 rodada",  description: "Grande tornado que se divide em menores; combina com liberações de fogo." },
  { key: "juuha_shou",              name: "Juuha Shou",                     typeKey: "futon",   jutsuRank: "C", chakraCost: 70, duration: "1 rodada",  description: "Lâmina de vento cortante em forma de bumerangue." },
  { key: "futon_zankuukyokuha",     name: "Zankuukyokuha",                  typeKey: "futon",   jutsuRank: "C", chakraCost: 70, duration: "1 rodada",  description: "Versão mais potente usando ambas as mãos para devastação em área." },
  // Rank B
  { key: "futon_kazekiri",          name: "Futon: Kazekiri no Jutsu",       typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Grande lâmina de vento que percorre a região cortando inimigos." },
  { key: "futon_senpuuken",         name: "Futon: Senpuuken",               typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Soco que libera chakra de vento acumulado." },
  { key: "futon_shinkuuha",         name: "Futon: Shinkuuha",               typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Liberação giratória criando ondas de vácuo cortante aprimoradas." },
  { key: "kaze_no_yaiba",           name: "Kaze no Yaiba",                  typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Espada de ar invisível formada nos dedos com poder de corte letal." },
  { key: "futon_fuujin",            name: "Futon: Fuujin no Jutsu",         typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  usageLimit: 1,  description: "Corrente de poeira em alta velocidade que esmaga objetos duráveis; quebra defesa absoluta." },
  { key: "juuha_reppuu_shou",       name: "Juuha Reppuu Shou",              typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Versão aprimorada formando mão demoníaca com poder de corte aumentado." },
  { key: "futon_shinkuugyoku",      name: "Futon: Shinkuugyoku",            typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Explosão de vácuo à frente, esquerda e direita atingindo múltiplos ângulos." },
  // Rank A
  { key: "futon_rasengan",          name: "Futon: Rasengan",                typeKey: "futon",   jutsuRank: "A", chakraCost: 100,                       usageLimit: 1,  description: "Rasengan infundido com chakra de vento; coloração azul com quatro pontos em forma de shuriken." },
  { key: "futon_shinkuu_taigyoku",  name: "Futon: Shinkuu Taigyoku",        typeKey: "futon",   jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Grande explosão de vácuo criando uma única esfera de vento cortante." },
  { key: "futon_shinkuu_renpa",     name: "Futon: Shinkuu Renpa",           typeKey: "futon",   jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Múltiplas lâminas de vento de vários ângulos com efeito de sucção." },
  // Rank S
  { key: "futon_rasenshuriken",     name: "Futon: Rasenshuriken",           typeKey: "futon",   jutsuRank: "S", chakraCost: 500, duration: "1 rodada", usageLimit: 1,  description: "A técnica de vento mais poderosa. Rasengan em forma de shuriken gigante; quebra defesa absoluta. Requer contato direto." },

  // ═══════════════════════════════════════════════════════════════════════
  // NINJUTSU (base — técnicas universais)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank E
  { key: "henge_no_jutsu",          name: "Henge no Jutsu",                 typeKey: "ninjutsu", jutsuRank: "E", chakraCost: 5,                        description: "Transforma o usuário na aparência de outra pessoa, objeto ou animal." },
  { key: "kawarimi_no_jutsu",       name: "Kawarimi no Jutsu",              typeKey: "ninjutsu", jutsuRank: "E", chakraCost: 5,  duration: "1 rodada",  usageLimit: 2,  description: "Substitui o usuário por um objeto próximo para escapar de ataques." },
  { key: "bunshin_no_jutsu",        name: "Bunshin no Jutsu",               typeKey: "ninjutsu", jutsuRank: "E", chakraCost: 5,                        description: "Cria cópias ilusórias do usuário sem substância física." },
  // Rank D
  { key: "kage_bunshin",            name: "Kage Bunshin no Jutsu",          typeKey: "ninjutsu", jutsuRank: "D", chakraCost: 50,                       description: "Cria clones sólidos com chakra real. Cada clone possui 1/N do chakra do usuário. Kinjutsu por consumo excessivo." },
  { key: "shunshin_no_jutsu",       name: "Shunshin no Jutsu",              typeKey: "ninjutsu", jutsuRank: "D", chakraCost: 15, duration: "1 rodada",  description: "Técnica de corpo-relâmpago: teleporte de curta distância usando chakra para cobrir espaço em um instante." },
  // Rank C
  { key: "rasengan",                name: "Rasengan",                       typeKey: "ninjutsu", jutsuRank: "C", chakraCost: 50, duration: "1 rodada",  description: "Esfera de chakra rotativo de alta densidade criada na palma da mão. Não requer selos. Criado pelo Yondaime Hokage." },
  { key: "tajuu_kage_bunshin",      name: "Tajuu Kage Bunshin no Jutsu",    typeKey: "ninjutsu", jutsuRank: "C", chakraCost: 100,                       description: "Versão em massa do Kage Bunshin; cria dezenas ou centenas de clones. Kinjutsu." },
  // Rank B
  { key: "shuriken_kage_bunshin",   name: "Shuriken Kage Bunshin no Jutsu", typeKey: "ninjutsu", jutsuRank: "B", chakraCost: 30, duration: "1 rodada",  description: "Multiplica um shuriken em dezenas ou centenas de cópias sólidas de chakra." },

];
