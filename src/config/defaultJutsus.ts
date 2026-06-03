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
  { key: "katon_zukkoku",           name: "Katon: Zukkoku",                 typeKey: "katon",   jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2,  description: "Onda de chamas massiva capaz de devastar áreas florestais." },
  // Rank B
  { key: "katon_gouen",             name: "Katon: Gouen no Jutsu",          typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Fluxo de chamas em expansão pela boca; calor suficiente para evaporar água." },
  { key: "katon_dai_endan",         name: "Katon: Dai Endan",               typeKey: "katon",   jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Bomba de fogo aprimorada com poder de bomba incendiária." },
  { key: "katon_karyuu_endan",      name: "Katon: Karyuu Endan",            typeKey: "katon",   jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Explosão de chamas em forma de dragão cobrindo frente e lados." },
  { key: "katon_ryuuen_houka",      name: "Katon: Ryuuen Houka no Jutsu",   typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Múltiplas bolas de fogo com cabeça de dragão controláveis." },
  { key: "katon_housenka_tsumabeni",name: "Katon: Housenka Tsumabeni",      typeKey: "katon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Versão aprimorada do Housenka que inflama as armas do usuário em projéteis flamejantes." },
  // Rank A
  { key: "katon_haijingakure",      name: "Katon: Haijingakure no Jutsu",   typeKey: "katon",   jutsuRank: "A", chakraCost: 100, usageLimit: 1,        description: "Névoa de chakra incandescente que queima e camuflha o usuário simultaneamente." },
  // Rank S
  { key: "katon_gouka_mekkyaku",    name: "Katon: Gouka Mekkyaku",          typeKey: "katon",   jutsuRank: "S", chakraCost: 300, duration: "1 rodada",  description: "Enorme explosão de chamas em área ampla; requer múltiplos usuários de água para neutralizar." },
  { key: "katon_gouka_messhitsu",   name: "Katon: Gouka Messhitsu",         typeKey: "katon",   jutsuRank: "S", chakraCost: 500, duration: "1 rodada",  usageLimit: 1,  description: "A técnica Katon mais poderosa conhecida; cobre amplas áreas laterais." },

  // ═══════════════════════════════════════════════════════════════════════
  // SUITON (Liberação de Água)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "suiton_shigure",          name: "Suiton: Shigure",                typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Projéteis de água pressurizada golpeiam múltiplas vezes rapidamente." },
  { key: "mizudeppou",              name: "Mizudeppou no Jutsu",            typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Dispara balas d'água com a força de uma arma de fogo." },
  { key: "suiton_mizu_teppou",      name: "Suiton: Mizu Teppou",            typeKey: "suiton",  jutsuRank: "D", chakraCost: 10, duration: "1 rodada",  description: "Fluxo básico de água capaz de destruir rochas médias." },
  { key: "suiton_suiben",           name: "Suiton: Suiben",                 typeKey: "suiton",  jutsuRank: "D", chakraCost: 30, duration: "1 rodada",  description: "Cria um chicote de água que restringe o inimigo; pode ser eletrificado com Raiton." },
  { key: "mizu_bunshin",            name: "Mizu Bunshin no Jutsu",          typeKey: "suiton",  jutsuRank: "D", chakraCost: 30,                        description: "Cria clones de água com 1/10 do poder do usuário; dobra a força dentro d'água." },
  { key: "suiton_kirigakure",       name: "Suiton: Kirigakure no Jutsu",    typeKey: "suiton",  jutsuRank: "D", chakraCost: 80,                        description: "Névoa densa que reduz a visibilidade de todos a zero." },
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
  // Rank C
  { key: "raiton_gian",             name: "Raiton: Gian",                   typeKey: "raiton",  jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2,  description: "Relâmpago de alta voltagem disparado diretamente." },
  { key: "raiton_kaminari_shibari", name: "Raiton: Kaminari Shibari",       typeKey: "raiton",  jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  usageLimit: 1,  description: "Correntes de relâmpago que imobilizam o oponente." },
  // Rank B
  { key: "chidori",                 name: "Chidori",                        typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Técnica dos Mil Pássaros — concentração de chakra elétrico na mão para investida perfurante." },
  { key: "chidori_nagashi",         name: "Chidori Nagashi",                typeKey: "raiton",  jutsuRank: "B", chakraCost: 30, duration: "1 rodada",  usageLimit: 1,  description: "Libera correntes de Chidori por todo o corpo como defesa." },
  { key: "chidori_senbon",          name: "Chidori Senbon",                 typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Chidori transformado em múltiplas agulhas de chakra elétrico." },
  { key: "chidori_eisou",           name: "Chidori Eisou",                  typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Chidori estendido em forma de espada longa." },
  { key: "raiton_rairyuu_tatsumaki",name: "Raiton Ninpou: Rairyuu no Tatsumaki", typeKey: "raiton", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Dragão de relâmpago em tornado; pode ser usado ofensiva ou defensivamente." },
  { key: "raijuu_hashiri",          name: "Raijuu Hashiri no Jutsu",        typeKey: "raiton",  jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Movimento de alta velocidade infundido com chakra de relâmpago." },
  // Rank A
  { key: "raikiri",                 name: "Raikiri",                        typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1,  description: "A Espada Relâmpago — versão suprema do Chidori com poder de cortar raios." },
  { key: "raikiri_issen",           name: "Raikiri Issen",                  typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1,  description: "Corte único de Raikiri executado com precisão máxima." },
  { key: "raiton_juurokuchuu_shibari",name: "Raiton: Juurokuchuu Shibari", typeKey: "raiton",  jutsuRank: "A", chakraCost: 20,  duration: "1 rodada", usageLimit: 1,  description: "Dezesseis pilares de relâmpago que aprisionam completamente o oponente." },
  { key: "raiton_jibashi",          name: "Raiton: Jibashi",                typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Descarga elétrica de alta potência propagada pelo solo." },
  { key: "raiton_no_yoroi",         name: "Raiton no Yoroi",                typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "3 rodadas",usageLimit: 1,  description: "Armadura de chakra elétrico que aumenta força, velocidade e resistência." },
  { key: "chidori_raimei",          name: "Chidori Raimei",                 typeKey: "raiton",  jutsuRank: "A", chakraCost: 100, duration: "1 rodada", description: "Versão trovejante máxima do Chidori com área de efeito expandida." },
  // Rank S
  { key: "jigokuzuki_sanbon_nukite",name: "Jigokuzuki - Sanbon Nukite",     typeKey: "raiton",  jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1,  description: "Três dedos infundidos com relâmpago de nível máximo perfuram o oponente." },
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
  { key: "doton_doryuu_taiga",      name: "Doton: Doryuu Taiga",            typeKey: "doton",   jutsuRank: "C", chakraCost: 60, duration: "1 rodada",  description: "Cria rio de lama que lança o inimigo a 80 metros de distância." },
  { key: "doton_domu",              name: "Doton: Domu",                    typeKey: "doton",   jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Endurece partes do corpo com resistência de diamante." },
  // Rank B
  { key: "doton_kiretsu",           name: "Doton: Kiretsu",                 typeKey: "doton",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Grande fissura abre no solo fazendo as vítimas caírem." },
  { key: "doton_yomi_numa",         name: "Doton: Yomi Numa",               typeKey: "doton",   jutsuRank: "B", chakraCost: 20, duration: "1 rodada",  usageLimit: 1,  description: "Pântano criado no solo imobiliza inimigos que pisarem nele." },
  { key: "doton_iwa_no_yoroi",      name: "Doton: Iwa no Yoroi",            typeKey: "doton",   jutsuRank: "B", chakraCost: 50, duration: "3 rodadas", usageLimit: 1,  description: "Armadura de diamante endurecida que aumenta força e resistência." },
  { key: "doton_iwabashira_hakai",  name: "Doton: Iwabashira Hakai",        typeKey: "doton",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Gigantescos pilares de pedra perfurantes emergem do solo." },
  // Rank S

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
  { key: "juuha_shou",              name: "Juuha Shou",                     typeKey: "futon",   jutsuRank: "C", chakraCost: 70, duration: "1 rodada",  description: "Lâmina de vento cortante em forma de bumerangue." },
  { key: "futon_zankuukyokuha",     name: "Zankuukyokuha",                  typeKey: "futon",   jutsuRank: "C", chakraCost: 70, duration: "1 rodada",  description: "Versão mais potente usando ambas as mãos para devastação em área." },
  // Rank B
  { key: "futon_kazekiri",          name: "Futon: Kazekiri no Jutsu",       typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Grande lâmina de vento que percorre a região cortando inimigos." },
  { key: "futon_shinkuuha",         name: "Futon: Shinkuuha",               typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Liberação giratória criando ondas de vácuo cortante aprimoradas." },
  { key: "kaze_no_yaiba",           name: "Kaze no Yaiba",                  typeKey: "futon",   jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Espada de ar invisível formada nos dedos com poder de corte letal." },
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

  // ═══════════════════════════════════════════════════════════════════════
  // NINJUTSU — técnicas adicionais (utilitário, movimento, barreiras)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank E
  { key: "kai",                      name: "Kai",                            typeKey: "ninjutsu", jutsuRank: "E", chakraCost: 10,                        description: "Cancela genjutsus ou interrompe fluxo de chakra externo." },
  { key: "kinobori",                 name: "Kinobori / Kabenobori no Jutsu", typeKey: "ninjutsu", jutsuRank: "E", chakraCost: 2,                         description: "Caminhar em superfícies verticais concentrando chakra nas plantas dos pés." },
  { key: "mizu_no_kinobori",         name: "Mizu no Kinobori no Jutsu",     typeKey: "ninjutsu", jutsuRank: "E", chakraCost: 2,                         description: "Caminhar sobre a água concentrando chakra sob os pés." },
  // Rank D
  { key: "meisai_no_jutsu",          name: "Meisai no Jutsu",               typeKey: "ninjutsu", jutsuRank: "D", chakraCost: 1,                         description: "Camuflagem usando capa sensível ao chakra." },
  { key: "kanashibari_no_jutsu_nin", name: "Kanashibari no Jutsu",          typeKey: "ninjutsu", jutsuRank: "D", chakraCost: 100, duration: "1 rodada",  usageLimit: 1, description: "Paralisa o oponente com fios invisíveis de chakra. Requer concentração contínua." },
  // Rank C
  { key: "konbi_henge",              name: "Konbi Henge",                   typeKey: "ninjutsu", jutsuRank: "C", chakraCost: 100,                       description: "Transformação combinada entre dois usuários em uma forma poderosa. Requer dois ninjas." },
  { key: "touton_no_jutsu",          name: "Touton no Jutsu",               typeKey: "ninjutsu", jutsuRank: "C", chakraCost: 40,                        description: "Assume exatamente a cor do ambiente ao redor, tornando-se praticamente invisível." },
  { key: "chakra_sensing",           name: "Chakra Sensing",                typeKey: "ninjutsu", jutsuRank: "C", chakraCost: 20, duration: "1 rodada",  description: "Detecta assinaturas de chakra de oponentes próximos." },
  { key: "chakra_suppression",       name: "Chakra Suppression",            typeKey: "ninjutsu", jutsuRank: "C", chakraCost: 20,                        description: "Esconde a própria assinatura de chakra de sensores." },
  // Rank B
  { key: "voo_no_jutsu",             name: "Técnica do Voo",                typeKey: "ninjutsu", jutsuRank: "B", chakraCost: 10,                        description: "Levitação e voo usando controle de chakra. Dominado por poucos ninjas." },
  { key: "chakra_absorption",        name: "Chakra Absorption Jutsu",       typeKey: "ninjutsu", jutsuRank: "B", chakraCost: 0,  duration: "1 rodada",  usageLimit: 1, description: "Absorve 50% do chakra do oponente ao toque." },
  // Rank A
  { key: "killing_intent",           name: "Killing Intent",                typeKey: "ninjutsu", jutsuRank: "A", chakraCost: 20, duration: "1 rodada",  usageLimit: 1, description: "Paralisa o oponente pela pura intensidade da vontade de matar. Não usa chakra elemental." },
  { key: "grande_rasengan",          name: "Grande Bola Rasengan",          typeKey: "ninjutsu", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Versão ampliada do Rasengan; quebra defesas absolutas." },
  // Rank S

  // ═══════════════════════════════════════════════════════════════════════
  // TAIJUTSU — estilos de luta e técnicas individuais
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D — técnicas individuais
  { key: "kage_buyou",               name: "Kage Buyou",                    typeKey: "taijutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Segue a sombra do oponente durante um salto para iniciar sequência aérea. Pré-requisito para Renge." },
  { key: "konoha_senpuu",            name: "Konoha Senpuu",                 typeKey: "taijutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Chute giratório poderoso — técnica básica do Estilo Punho Forte." },
  { key: "konoha_dai_shoufuu",       name: "Konoha Dai Shoufuu",            typeKey: "taijutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Chute de amplitude larga que dispersa névoa e gera rajada de vento." },
  // Rank C — estilos e combos
  { key: "gouken_ryuu",              name: "Gouken Ryuu (Estilo Punho Forte)", typeKey: "taijutsu", jutsuRank: "C", chakraCost: 0, duration: "até fim do combate", description: "Estilo de Rock Lee e Maito Guy. +10 Força/+20 dano; abre acesso a técnicas do estilo. Chutes e socos diretos, sem chakra em jutsus." },
  { key: "shishi_rendan",            name: "Shishi Rendan",                 typeKey: "taijutsu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  description: "Combinação de lançamento com série de chutes aéreos e golpe final. Requer Gouken ativo." },
  { key: "konoha_senshuu",           name: "Konoha Senshuu",                typeKey: "taijutsu", jutsuRank: "C", chakraCost: 0,  duration: "1 rodada",  description: "Chute de calcanhar forte o suficiente para partir pedras. Requer Gouken ativo." },
  // Rank B — técnicas avançadas
  { key: "omote_renge",              name: "Omote Renge",                   typeKey: "taijutsu", jutsuRank: "B", chakraCost: 130, duration: "1 rodada", description: "Lotus Frontal — lança o oponente ao ar com o Kage Buyou e desce sobre ele em alta velocidade. Requer abertura de portão." },
  { key: "rariatto",                 name: "Rariatto",                      typeKey: "taijutsu", jutsuRank: "B", chakraCost: 100, duration: "1 rodada", description: "Golpe no pescoço com força esmagadora. Quebra defesas absolutas." },
  { key: "yoruhouo",                 name: "Yoruhou'o",                     typeKey: "taijutsu", jutsuRank: "B", chakraCost: 100, duration: "1 rodada", description: "Velocidade de movimento tão alta que cria imagem de chamas em forma de fênix. Requer +40 Taijutsu e Gouken ativo." },
  { key: "suiken_ryuu",              name: "Suiken Ryuu (Punho Bêbado)",    typeKey: "taijutsu", jutsuRank: "B", chakraCost: 0,  duration: "até fim do combate", description: "Estilo de Rock Lee em estado de embriaguez. Requer ingestão de álcool. +80 Agi/Força/dano; movimentos imprevisíveis." },
  { key: "muon_no_ken",              name: "Muon no Ken",                   typeKey: "taijutsu", jutsuRank: "B", chakraCost: 50,                        description: "Golpes silenciosos e imprevisíveis. +50 dano; impossível de ouvir. Requer +40 Taijutsu." },
  // Rank A
  { key: "ura_renge",                name: "Ura Renge",                     typeKey: "hachimon", jutsuRank: "A", chakraCost: 180, duration: "1 rodada",  description: "Lotus Reverso — versão proibida do Omote Renge usando os oito portões. Causa dano ao próprio usuário. Requer abertura de múltiplos portões." },

  // ═══════════════════════════════════════════════════════════════════════
  // HACHIMON TONKOU — Oito Portões
  // ═══════════════════════════════════════════════════════════════════════

  // Portões 1-2 (Rank D/C)
  // Portão 3 (Rank C/B)
  // Portões 4-5 (Rank B)
  // Portões 6-7 (Rank A)
  { key: "hachimon_asa_kujaku",      name: "Asa Kujaku",                    typeKey: "hachimon", jutsuRank: "A", chakraCost: 200, duration: "1 rodada",  description: "Portões 6: série de golpes que cria uma estrutura em forma de pavão com o suor do usuário evaporado em chamas de chakra." },
  { key: "hachimon_hirudora",        name: "Hirudora",                      typeKey: "hachimon", jutsuRank: "A", chakraCost: 1000, duration: "1 rodada", usageLimit: 1, description: "Portões 7: soco tão veloz que cria um tigre de ar comprimido. Sem necessidade de contato físico. Quebra toda defesa." },
  // Portão 8 (Rank S)
  { key: "hachimon_yoru_guy",        name: "Yoru-Guy (Night Guy)",          typeKey: "hachimon", jutsuRank: "S", chakraCost: 1500, duration: "1 rodada", usageLimit: 1, description: "Portão da Morte — chute de velocidade tão extrema que cria um dragão de vapor azul. Maito Guy contra Madara Uchiha. Fatal para o usuário sem tratamento médico imediato." },
  // Portão 8 (Rank S)

  // ═══════════════════════════════════════════════════════════════════════
  // GENJUTSU
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "kanashibari_no_genjutsu",  name: "Kanashibari no Genjutsu",       typeKey: "genjutsu", jutsuRank: "D", chakraCost: 50,  duration: "1 rodada",  description: "Paralisa o oponente com ilusão de imobilização." },
  { key: "kasumi_juuha_no_jutsu",    name: "Kasumi Juuha no Jutsu",         typeKey: "genjutsu", jutsuRank: "D", chakraCost: 10,  duration: "2 rodadas", description: "Cria clones ilusórios para confundir o oponente." },
  { key: "kori_shinchuu_no_jutsu",   name: "Kori Shinchuu no Jutsu",        typeKey: "genjutsu", jutsuRank: "D", chakraCost: 30,  duration: "2 rodadas", description: "Causa desorientação e perturbação sensorial no oponente." },
  { key: "shikumi_no_jutsu",         name: "Shikumi no Jutsu",              typeKey: "genjutsu", jutsuRank: "D", chakraCost: 100, duration: "1 rodada",  description: "Paralisa através de visões de morte ao toque." },
  // Rank C
  { key: "magen_jubaku_satsu",       name: "Magen: Jubaku Satsu",           typeKey: "genjutsu", jutsuRank: "C", chakraCost: 20,  duration: "1 rodada",  description: "Raízes de árvore ilusórias imobilizam o oponente." },
  { key: "magen_kokuni_arazu",       name: "Magen: Kokuni Arazu no Jutsu",  typeKey: "genjutsu", jutsuRank: "C", chakraCost: 20,  duration: "1 rodada",  description: "Ilusão que disfarça o ambiente ao redor." },
  { key: "magen_souran",             name: "Magen: Souran no Jutsu",        typeKey: "genjutsu", jutsuRank: "C", chakraCost: 20,  duration: "1 rodada",  description: "Confusão dos sentidos reduzindo a resistência do oponente." },
  // Rank B
  { key: "magen_narakumi",           name: "Magen: Narakumi no Jutsu",      typeKey: "genjutsu", jutsuRank: "B", chakraCost: 200, duration: "1 rodada",  description: "Imobiliza com visões horríveis — um dos genjutsus mais poderosos de Kakashi." },
  { key: "raigen_raikouchuu",        name: "Raigen Raikouchuu",             typeKey: "genjutsu", jutsuRank: "B", chakraCost: 80,  duration: "1 rodada",  description: "Flash de luz que cega temporariamente o oponente." },
  { key: "kokuangyou_no_jutsu",      name: "Kokuangyou no Jutsu",           typeKey: "genjutsu", jutsuRank: "B", chakraCost: 100, duration: "1 rodada",  description: "Escuridão total — remove completamente a visão do oponente. Não pode ser cancelado por Kai comum." },
  { key: "nehan_shouja_no_jutsu",    name: "Nehan Shouja no Jutsu",         typeKey: "genjutsu", jutsuRank: "B", chakraCost: 150, duration: "1 rodada",  description: "Força múltiplos oponentes a perderem a consciência simultaneamente." },
  { key: "magen_jigoku_kouka",       name: "Magen: Jigoku Kouka no Jutsu",  typeKey: "genjutsu", jutsuRank: "B", chakraCost: 120, duration: "1 rodada",  description: "Ilusão de terror e asfixia causando dano psicossomático grave." },
  // Rank S

  // ═══════════════════════════════════════════════════════════════════════
  // FUINJUTSU — técnicas de selamento
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "fuinyuu_no_jutsu",         name: "Fūnyū no Jutsu",                typeKey: "fuinjutsu", jutsuRank: "D", chakraCost: 10, description: "Sela itens ou jutsus em pergaminhos para liberação posterior." },
  // Rank C
  // Rank B
  { key: "fuuka_houin",              name: "Fuuka Houin",                   typeKey: "fuinjutsu", jutsuRank: "B", chakraCost: 120, description: "Sela variados tipos de chamas, incluindo o Amaterasu." },
  { key: "shishi_enjin",             name: "Shishi Enjin",                  typeKey: "fuinjutsu", jutsuRank: "B", chakraCost: 100, description: "Formação quadrada de quatro ninjas criando barreira letal de energia púrpura." },
  { key: "fuuda_kekkai_fuuin",       name: "Fuuda Kekkai Fuuin",            typeKey: "fuinjutsu", jutsuRank: "B", chakraCost: 80,  duration: "1 rodada",  description: "Múltiplos selos ocultos aprisionam alvos. Pode selar um Edo Tensei." },
  { key: "gogyou_fuuin",             name: "Gogyou Fuuin",                  typeKey: "fuinjutsu", jutsuRank: "B", chakraCost: 1000, duration: "3 rodadas", description: "Selo dos Cinco Elementos que bloqueia tipos específicos de jutsu e suspende poderes de bijuu." },
  { key: "gogyou_kaiin",             name: "Gogyou Kaiin",                  typeKey: "fuinjutsu", jutsuRank: "B", chakraCost: 1500, description: "Remove selos de cinco elementos; libera chakra de bijuu." },
  { key: "fuuja_houin",              name: "Fuuja Houin",                   typeKey: "fuinjutsu", jutsuRank: "B", chakraCost: 300, duration: "3 rodadas", description: "Suprime efeitos de jutsus malignos ou sela fragmentos de alma." },
  // Rank A
  { key: "shishi_fuuinjutsu",        name: "Shishi Fuuinjutsu",             typeKey: "fuinjutsu", jutsuRank: "A", chakraCost: 600, description: "Formações circulares com correntes que selam animais de invocação." },
  { key: "bijuu_fuuin",              name: "Bijuu Fuuin",                   typeKey: "fuinjutsu", jutsuRank: "A", chakraCost: 800, description: "Colar/selo no pescoço que restringe as transformações com cauda do jinchuuriki." },
  { key: "shishou_fuuin",            name: "Shishou Fuuin",                 typeKey: "fuinjutsu", jutsuRank: "A", chakraCost: 1000, duration: "3 rodadas", description: "Fornece ao jinchuuriki acesso controlado ao chakra do bijuu." },
  // Rank S
  { key: "shiki_fuujin",             name: "Shiki Fuujin",                  typeKey: "fuinjutsu", jutsuRank: "S", chakraCost: 2000, usageLimit: 1, description: "Selo do Deus da Morte — extrai almas aprisionando-as no deus. Mata o usuário após três rodadas. A técnica do Sandaime e Yondaime Hokage." },
  { key: "shiki_fuujin_kai",         name: "Shiki Fuujin - Kai",            typeKey: "fuinjutsu", jutsuRank: "S", chakraCost: 0,   usageLimit: 1, description: "Libera as almas seladas pelo Shiki Fuujin. O dano reflete no invocador." },
  { key: "shisekiyoujin",            name: "Shisekiyoujin",                 typeKey: "fuinjutsu", jutsuRank: "S", chakraCost: 600,  description: "Barreira vermelha nível Kage de quatro ninjas. Letal ao toque." },
  { key: "ura_shishou_fuuinjutsu",   name: "Ura Shishou Fuuinjutsu",        typeKey: "fuinjutsu", jutsuRank: "S", chakraCost: 2000, usageLimit: 1, description: "Selo de quatro símbolos ativado na morte do usuário, selando todos ao redor." },
  { key: "hakke_no_fuuin_shiki",     name: "Hakke no Fuuin Shiki",          typeKey: "fuinjutsu", jutsuRank: "S", chakraCost: 1800, description: "Selo das Oito Divindades — permite acesso controlado ao chakra do bijuu." },

  // ═══════════════════════════════════════════════════════════════════════
  // SENJUTSU — técnicas de chakra natural
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "sennin_mode",              name: "Modo Eremita (Sennin Mode)",    typeKey: "senjutsu", jutsuRank: "D", chakraCost: 50,  duration: "3 rodadas", usageLimit: 3, description: "Transformação sábia inicial. +30 em todos atributos e dano. Permite sentir chakra à distância." },
  { key: "sennin_sentou_sutairu",    name: "Sennin Sentou Sutairu",         typeKey: "senjutsu", jutsuRank: "D", chakraCost: 20,                        description: "Estilo de combate sábio. +20 Força/Agi/Res e dano de taijutsu. Requer Modo Eremita ativo." },
  // Rank B
  { key: "sennin_mode_kansei",       name: "Modo Eremita Completo",         typeKey: "senjutsu", jutsuRank: "B", chakraCost: 60,  duration: "3 rodadas", usageLimit: 3, description: "Forma sábia completa com enhancements superiores. +60 em todos atributos e dano. Permite detectar todo ser vivo próximo." },
  { key: "senpou_muki_tensei",       name: "Senpou: Muki Tensei",           typeKey: "senjutsu", jutsuRank: "B", chakraCost: 50,  duration: "1 rodada",  description: "Dá vida e controle a objetos inanimados, manipulando o ambiente para ataque. Requer Modo Eremita Completo." },
  { key: "senpou_kawazu_naki",       name: "Senpou: Kawazu Naki",           typeKey: "senjutsu", jutsuRank: "B", chakraCost: 30,  duration: "1 rodada",  usageLimit: 1, description: "Onda sonora do coaxar dos sapos que quebra defesas absolutas. Requer Modo Eremita Completo." },
  { key: "senpou_zessenbaku",        name: "Senpou: Zessenbaku",            typeKey: "senjutsu", jutsuRank: "B", chakraCost: 30,  duration: "1 rodada",  usageLimit: 1, description: "Língua serpentina que detecta chakra e temperatura, localizando inimigos ocultos." },
  // Rank A
  { key: "senpou_hakugeki",          name: "Senpou: Hakugeki no Jutsu",     typeKey: "senjutsu", jutsuRank: "A", chakraCost: 150, duration: "1 rodada",  usageLimit: 1, description: "Dragão branco de chakra natural que cega, ensurdece e paralisa. Requer Modo Eremita Completo." },
  { key: "arte_sabia_ultra_grande_bola", name: "Arte Sábia: Ultra-Grande Bola Rasengan", typeKey: "senjutsu", jutsuRank: "A", chakraCost: 300, usageLimit: 1, description: "Rasengan gigante infundido com chakra natural. Quebra defesas absolutas." },
  { key: "senpou_kekkai_tengai_houjin", name: "Senpou: Kekkai no Jutsu - Tengai Houjin", typeKey: "senjutsu", jutsuRank: "A", chakraCost: 120, usageLimit: 1, description: "Barreira que mata instantaneamente qualquer intruso detectado. Defesa perfeita absoluta." },
  // Rank S
  { key: "senpou_myoujinmon",        name: "Senpou: Myoujinmon",            typeKey: "senjutsu", jutsuRank: "S", chakraCost: 500, duration: "3 rodadas", usageLimit: 1, description: "Múltiplos portões torii que imobilizam qualquer alvo, incluindo bijuu e Susanoo. Requer Modo Eremita Completo." },

  // ═══════════════════════════════════════════════════════════════════════
  // KENJUTSU — técnicas com espada
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "iaigiri",                  name: "Iaigiri",                       typeKey: "kenjutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Golpe rápido e poderoso de iai — saca e embainhe em um único movimento." },
  { key: "iaidou",                   name: "Iaidou",                        typeKey: "kenjutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Técnica de iai que impede o oponente de fazer selos manuais; bloqueia 1 jutsu." },
  { key: "kumo_ryuu_mikazukigiri",   name: "Kumo Ryuu: Mikazukigiri",       typeKey: "kenjutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Amplo arco de corte em crescente em velocidade feroz." },
  // Rank C
  { key: "mikazuki_no_mai",          name: "Mikazuki no Mai",               typeKey: "kenjutsu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  description: "Cria clones de sombra que atacam pela esquerda, direita e centro simultaneamente." },
  { key: "kumo_ryuu_damashigiri",    name: "Kumo Ryuu: Damashigiri",        typeKey: "kenjutsu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  description: "Usa substituição para fingir ataque e golpear de lado." },
  // Rank B
  { key: "samurai_kenjutsu",         name: "Samurai Kenjutsu",              typeKey: "kenjutsu", jutsuRank: "B", chakraCost: 50, duration: "até fim do combate", description: "Canaliza chakra pela espada, aumentando alcance e capacidade de corte. Base dos técnicos samurai." },
  { key: "kirai_ken",                name: "Kirai",                         typeKey: "kenjutsu", jutsuRank: "B", chakraCost: 0,  duration: "1 rodada",  usageLimit: 1, description: "Ataque da Kubikiriboutou com aura demoníaca. A espada absorve sangue aumentando tamanho." },

  // ═══════════════════════════════════════════════════════════════════════
  // BUKIJUTSU — técnicas com armas (shuriken, leques, agulhas, etc.)
  // ═══════════════════════════════════════════════════════════════════════

  // Rank D
  { key: "kage_senbon",              name: "Kage Senbon",                   typeKey: "bukijutsu", jutsuRank: "D", chakraCost: 0,  duration: "1 rodada",  description: "Agulha silenciosa misturada com sinos para confundir os reflexos do oponente." },
  { key: "jouro_senbon",             name: "Ninpou: Jouro Senbon",          typeKey: "bukijutsu", jutsuRank: "D", chakraCost: 20, duration: "1 rodada",  description: "Guarda-chuva libera centenas de agulhas guiadas por chakra." },
  { key: "kamaitachi_no_jutsu",      name: "Kamaitachi no Jutsu",           typeKey: "bukijutsu", jutsuRank: "D", chakraCost: 20, duration: "1 rodada",  description: "Giro de leque cria tornado cortante que lança o oponente para o alto." },
  { key: "fuuton_kakeami",           name: "Fuuton: Kakeami",               typeKey: "bukijutsu", jutsuRank: "D", chakraCost: 20, duration: "1 rodada",  description: "Leque cria grade de linhas de vento que corta oponentes frontais." },
  { key: "hien_espada",              name: "Hien (Andorinha Voadora)",      typeKey: "bukijutsu", jutsuRank: "C", chakraCost: 30, duration: "3 rodadas", description: "Chakra flui pela lâmina criando fio cortante estendido. Difícil de aparar. Técnica de Sasuke em Shippuden." },
  // Rank C
  { key: "dai_kamaitachi",           name: "Dai Kamaitachi no Jutsu",       typeKey: "bukijutsu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada",  usageLimit: 2, description: "Versão aprimorada do Kamaitachi que corta florestas inteiras." },
  { key: "ayametori",                name: "Ayametori",                     typeKey: "bukijutsu", jutsuRank: "C", chakraCost: 30, duration: "1 rodada",  description: "Corda de fio reforçada com chakra capaz de cortar aço facilmente." },
  // Rank B
  { key: "kusanagi_kuu_no_tachi",    name: "Kusanagi no Tsurugi: Kuu no Tachi", typeKey: "bukijutsu", jutsuRank: "B", chakraCost: 10, description: "Ativa a Espada Kusanagi remotamente com selo de mão. Espada levita e ataca por conta própria." },
  { key: "ikazuchi_no_kiba",         name: "Ikazuchi no Kiba",              typeKey: "bukijutsu", jutsuRank: "B", chakraCost: 20, duration: "1 rodada",  description: "As duas espadas unidas enviam essência elétrica às nuvens criando relâmpagos. Espadas dos Sete Espadachins." },
  { key: "hiramekarei_kaihou",       name: "Hiramekarei Kaihou",            typeKey: "bukijutsu", jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  description: "Molda chakra ao redor da Hiramekarei formando um martelo gigante." },
  { key: "mateki_genreiha",          name: "Mateki: Genreiha",              typeKey: "bukijutsu", jutsuRank: "B", chakraCost: 50, duration: "1 rodada",  usageLimit: 1, description: "Flauta demoníaca materializa espíritos que perseguem e paralisam o oponente, consumindo chakra." },
  { key: "ookamaitachi",             name: "Ookamaitachi",                  typeKey: "bukijutsu", jutsuRank: "B", chakraCost: 60, duration: "1 rodada",  description: "Versão mais poderosa do Kamaitachi — correntes de ar pesadas criam enorme onda de vácuo." },
  // Rank A
  { key: "shoten_chakura_hiramekarei", name: "Hiramekarei - Foco de Chakra", typeKey: "bukijutsu", jutsuRank: "A", chakraCost: 100, duration: "3 rodadas", usageLimit: 1, description: "Lâmina de chakra enorme projetada ao redor da estrutura óssea do usuário; a lâmina cresce com os movimentos." },
  // Rank S
  { key: "suiton_same_henge",        name: "Suiton Ninpou: Same Henge no Jutsu", typeKey: "bukijutsu", jutsuRank: "S", chakraCost: 300, duration: "3 rodadas", usageLimit: 1, description: "Fusão humano-Samehada — forma híbrida tubarão-humano. +300 Força/Agi/Res, rastreia e absorve chakra. Técnica de Kisame." },
  { key: "suiton_daikoudan",         name: "Suiton: Daikoudan no Jutsu",    typeKey: "bukijutsu", jutsuRank: "S", chakraCost: 300, duration: "1 rodada",  usageLimit: 1, description: "Tubarão de água gigante que absorve chakra dos jutsus oponentes, crescendo conforme absorve. Técnica de Kisame." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Cobras / Orochimaru  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_manda",          name: "Kuchiyose: Manda",              typeKey: "kuchiyose_cobras", jutsuRank: "S", chakraCost: 100, description: "Invoca Manda, a cobra gigante líder dos répteis. Técnica de Orochimaru." },
  { key: "seneijashu",               name: "Sen'eijashu",                   typeKey: "kuchiyose_cobras", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", description: "Lança cobras de sombra dos braços ou boca para atacar. Técnica fundamental de Orochimaru." },
  { key: "jagei_jubaku",             name: "Jagei Jubaku",                  typeKey: "kuchiyose_cobras", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Grandes serpentes emergem para imobilizar ou estrangular o alvo." },
  { key: "senei_ta_jashu",           name: "Senei Ta Jashu",                typeKey: "kuchiyose_cobras", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", usageLimit: 2, description: "Múltiplas cobras de sombra atacam simultaneamente. Versão intensificada do Sen'eijashu." },
  { key: "mandara_no_jin",           name: "Mandara no Jin",                typeKey: "kuchiyose_cobras", jutsuRank: "B", chakraCost: 40, duration: "1 rodada", usageLimit: 1, description: "Formação das Mil Cobras: muralha de incontáveis serpentes que soterra o inimigo. Técnica de Orochimaru." },
  { key: "shoushagan_no_jutsu",      name: "Shoushagan no Jutsu",           typeKey: "kuchiyose_cobras", jutsuRank: "B", chakraCost: 30, description: "Rouba o rosto e a voz da vítima para imitação perfeita. Técnica de Orochimaru." },
  { key: "orochimaru_kawarimi",      name: "Orochimaru-ryuu Kawarimi no Jutsu", typeKey: "kuchiyose_cobras", jutsuRank: "A", chakraCost: 50, usageLimit: 1, description: "Orochimaru regurgita um novo corpo, se regenerando de ferimentos graves." },
  { key: "yamata_no_jutsu",          name: "Yamata no Jutsu",               typeKey: "kuchiyose_cobras", jutsuRank: "S", chakraCost: 300, duration: "3 rodadas", usageLimit: 1, description: "Transformação na serpente de oito cabeças. A técnica máxima de Orochimaru." },
  { key: "fushi_tensei",             name: "Fushi Tensei",                  typeKey: "kuchiyose_cobras", jutsuRank: "S", chakraCost: 300, usageLimit: 1, description: "Transferência corporal que absorve a essência da vítima concedendo imortalidade. Kinjutsu de Orochimaru." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Sapos / Jiraiya e Naruto  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_gamabunta",      name: "Kuchiyose: Gamabunta",          typeKey: "kuchiyose_sapos", jutsuRank: "S", chakraCost: 100, description: "Invoca Gamabunta, o chefe-sapo. Exige contrato de sangue. Técnica de Jiraiya e Naruto." },
  { key: "gamayudan",                name: "Gamayudan",                     typeKey: "kuchiyose_sapos", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", description: "Expele óleo inflamável pelos sapos invocados. Combinado com fogo causa devastação em área." },
  { key: "gamagakure_no_jutsu",      name: "Gamagakure no Jutsu",           typeKey: "kuchiyose_sapos", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Esconde-se no estômago de um sapo submerso, bloqueando detecção de chakra." },
  { key: "yatai_kuzushi",            name: "Yatai Kuzushi no Jutsu",        typeKey: "kuchiyose_sapos", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Sapo gigante invocado esmaga e imobiliza o alvo com seu peso." },
  { key: "kekkai_gama_hyouro",       name: "Kekkai: Gama Hyōrō",           typeKey: "kuchiyose_sapos", jutsuRank: "B", chakraCost: 50, duration: "3 rodadas", usageLimit: 1, description: "Isola o oponente na câmara estomacal ácida de um sapo gigante. Dano contínuo se cair no ácido." },
  { key: "magen_gama_rinshou",       name: "Magen: Gama Rinshou",           typeKey: "kuchiyose_sapos", jutsuRank: "A", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Dueto sonoro de Fukasaku e Shima — genjutsu que paralisa múltiplos oponentes via paralisia nervosa." },
  { key: "senpou_ryousei",           name: "Senpou: Ryousei no Jutsu",      typeKey: "kuchiyose_sapos", jutsuRank: "A", chakraCost: 300, duration: "3 rodadas", usageLimit: 1, description: "Fusão anfíbia — Fukasaku e Shima se fundem ao usuário, concedendo Modo Sábio sem necessidade de ficar parado para absorver chakra natural." },

  // ═══════════════════════════════════════════════════════════════════════
  // RINNEGAN — Seis Caminhos de Pain  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "shinra_tensei",            name: "Shinra Tensei",                 typeKey: "rinnegan", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Força repulsiva do Caminho Deva. Na escala máxima destrói cidades inteiras. Cooldown de 5 segundos entre usos." },
  { key: "bansho_tenin",             name: "Banshō Ten'in",                 typeKey: "rinnegan", jutsuRank: "A", chakraCost: 50, duration: "2 rodadas", description: "Força atrativa do Caminho Deva — puxa objetos e seres em direção ao usuário." },
  { key: "chibaku_tensei",           name: "Chibaku Tensei",                typeKey: "rinnegan", jutsuRank: "S", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Esfera gravitacional que atrai terra e pedras aprisionando o alvo em uma lua artificial." },
  { key: "caminho_animal",           name: "Caminho Animal (Animal Path)",  typeKey: "rinnegan", jutsuRank: "B", chakraCost: 100, duration: "3 rodadas", usageLimit: 1, description: "Invoca múltiplas criaturas sem selos manuais. Uma das seis habilidades do Rinnegan." },
  { key: "caminho_preta",            name: "Caminho Preta (Preta Path)",    typeKey: "rinnegan", jutsuRank: "B", chakraCost: 100, usageLimit: 1, description: "Absorve qualquer forma de chakra por contato físico. Serve como defesa absoluta contra jutsus." },
  { key: "caminho_humano",           name: "Caminho Humano (Human Path)",   typeKey: "rinnegan", jutsuRank: "B", chakraCost: 70, usageLimit: 1, description: "Extrai alma e lê a mente pelo toque. A extração mata o alvo instantaneamente." },
  { key: "caminho_naraka",           name: "Caminho Naraka (Naraka Path)",  typeKey: "rinnegan", jutsuRank: "B", chakraCost: 100, usageLimit: 1, description: "Julga alvos pelo Rei do Inferno. Mata mentirosos ou repara os corpos dos outros Caminhos." },
  { key: "caminho_asura",            name: "Caminho Asura (Asura Path)",    typeKey: "rinnegan", jutsuRank: "B", chakraCost: 70, description: "Transforma o usuário em forma mecanizada com membros e armamentos adicionais." },
  { key: "gedo_rinne_tensei",        name: "Gedō: Rinne Tensei no Jutsu",   typeKey: "rinnegan", jutsuRank: "S", chakraCost: 1000, usageLimit: 1, description: "Ressuscita todos os mortos ao custo da vida do usuário. Técnica do Caminho Externo do Rinnegan." },
  { key: "amenotejikara",            name: "Amenotejikara",                 typeKey: "rinnegan", jutsuRank: "A", chakraCost: 500, description: "Troca instantânea de posição com objetos ou pessoas. Rinnegan de Madara e Sasuke." },

  // ═══════════════════════════════════════════════════════════════════════
  // HIRAISHIN — Deus do Trovão Voador / Minato Namikaze  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "hiraishin_no_jutsu",       name: "Hiraishin no Jutsu",            typeKey: "hiraishin", jutsuRank: "A", chakraCost: 10, description: "Teleporte instantâneo para local marcado com Selo do Trovão. Técnica do Yondaime Hokage, Minato Namikaze." },
  { key: "hiraishin_selo",           name: "Selo do Deus do Trovão",        typeKey: "hiraishin", jutsuRank: "B", chakraCost: 10, description: "Marca permanente em objetos/pessoas que serve de alvo para o Hiraishin." },
  { key: "hiraishin_goshun_mawashi", name: "Hiraishin Goshun Mawashi",      typeKey: "hiraishin", jutsuRank: "A", chakraCost: 10, duration: "1 rodada", usageLimit: 1, description: "Dois usuários trocam posições via marcas para defesa ou ataque coordenado." },
  { key: "hiraishin_ni_no_dan",      name: "Hiraishin — Ni no Dan",         typeKey: "hiraishin", jutsuRank: "A", chakraCost: 10, duration: "1 rodada", usageLimit: 1, description: "Lança kunai marcada e teleporta para cima do oponente para ataque surpresa." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ HYUUGA — Byakugan e Jūken  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "byakugan",                 name: "Byakugan",                      typeKey: "cla_hyuuga", jutsuRank: "D", chakraCost: 20, description: "Olho Branco — visão 360° quase completa, vê chakra e tenketsu, penetra objetos sólidos até 800m." },
  { key: "juuken_ryuu",              name: "Juuken Ryuu (Punho Gentil)",    typeKey: "cla_hyuuga", jutsuRank: "D", chakraCost: 20, description: "Estilo do Clã Hyuuga: golpes nos tenketsu interrompem o fluxo de chakra do oponente por dentro." },
  { key: "hakkeshou_kaiten",         name: "Hakkeshou Kaiten",              typeKey: "cla_hyuuga", jutsuRank: "C", chakraCost: 10, duration: "1 rodada", usageLimit: 1, description: "Rotação de Oito Trigramas — giro em alta velocidade expelindo chakra em barreira esférica impenetrável. Defesa absoluta." },
  { key: "hakke_sanjuunii_shou",     name: "Hakke Sanjuunii Shou",          typeKey: "cla_hyuuga", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 2, description: "32 Palmas — série de 32 golpes em tenketsu que interrompem chakra e causam dano." },
  { key: "hakke_rokujuuyon_shou",    name: "Hakke Rokujuuyon Shou",         typeKey: "cla_hyuuga", jutsuRank: "C", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "64 Palmas — técnica icônica de Neji Hyuuga; 64 golpes em tenketsu selam o fluxo de chakra do oponente." },
  { key: "hakke_kusho",              name: "Hakke Kusho",                   typeKey: "cla_hyuuga", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", usageLimit: 2, description: "Palma do Vácuo — projeta onda de chakra à distância atingindo órgãos vitais sem contato." },
  { key: "hakkeshou_dai_kaiten",     name: "Hakkeshou Dai Kaiten",          typeKey: "cla_hyuuga", jutsuRank: "B", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Grande Rotação — versão ampliada do Kaiten com intensidade maior. Defesa absoluta." },
  { key: "hakke_hasangeki",          name: "Hakke Hasangeki",               typeKey: "cla_hyuuga", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Absorve chakra do jutsu do oponente e devolve como dano de palma." },
  { key: "juho_soshiken",            name: "Juho Soshiken",                 typeKey: "cla_hyuuga", jutsuRank: "A", chakraCost: 400, duration: "1 rodada", usageLimit: 2, description: "Punho das Garras Gêmeas — chakra leonino em ambas as mãos destrói órgãos internos. Técnica de Hinata Hyuuga." },
  { key: "hakkeshou_zettai_kaiten",  name: "Hakkeshou Zettai Kaiten",       typeKey: "cla_hyuuga", jutsuRank: "A", chakraCost: 90, duration: "1 rodada", usageLimit: 1, description: "Rotação Absoluta — versão suprema do Kaiten. Defesa absoluta perfeita." },
  { key: "hakke_361_tenketsu",       name: "Hakke 361 Tenketsu",            typeKey: "cla_hyuuga", jutsuRank: "S", chakraCost: 500, duration: "1 rodada", usageLimit: 1, description: "Fecha os 361 tenketsu do corpo do oponente simultaneamente. A técnica definitiva do Clã Hyuuga." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ NARA — Técnicas de Sombra  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kage_mane_no_jutsu",       name: "Kage Mane no Jutsu",            typeKey: "cla_nara", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Imitação de Sombra — captura a sombra do oponente, forçando-o a imitar os movimentos do usuário. Técnica de Shikamaru." },
  { key: "kage_mane_shuriken",       name: "Kage Mane Shuriken no Jutsu",   typeKey: "cla_nara", jutsuRank: "C", chakraCost: 15, duration: "1 rodada", description: "Conduz chakra de sombra por armas metálicas, estendendo o alcance do Kage Mane." },
  { key: "kage_nui",                 name: "Kage Nui",                      typeKey: "cla_nara", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Costura de Sombra — fios de sombra perfuram e imobilizam o alvo. Usado por Shikamaru contra Hidan." },
  { key: "kage_no_tate",             name: "Kage no Tate",                  typeKey: "cla_nara", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Escudo de sombra materializado. Apenas jutsus de rank A ou superior penetram." },
  { key: "kageyose_no_jutsu",        name: "Kageyose no Jutsu",             typeKey: "cla_nara", jutsuRank: "B", chakraCost: 50, description: "Cordas de sombra para amarrar e restringir; aumenta o poder das técnicas Nara no combate." },
  { key: "kage_kubishibari",         name: "Kage Kubishibari no Jutsu",     typeKey: "cla_nara", jutsuRank: "B", chakraCost: 50, duration: "2 rodadas", usageLimit: 1, description: "Estrangulamento de Sombra — mãos de sombra formam e estrangulam o oponente. Pode ser letal." },
  { key: "kage_oni_shibari",         name: "Kage Oni Shibari no Jutsu",     typeKey: "cla_nara", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Tentáculos de sombra enredam completamente todos os alvos ao redor." },
  { key: "kuro_higanbana",           name: "Kuro Higanbana",                typeKey: "cla_nara", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Ramos de sombra aprisionam todos os inimigos ao redor simultaneamente." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ UCHIHA — Sharingan, Mangekyou e Susano'o  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "sharingan_1",              name: "Sharingan Nível 1",             typeKey: "cla_uchiha", jutsuRank: "D", chakraCost: 15, description: "Tomoe 1: previsão parcial de movimentos e cópia de técnicas simples." },
  { key: "sharingan_2",              name: "Sharingan Nível 2",             typeKey: "cla_uchiha", jutsuRank: "C", chakraCost: 30, description: "Tomoe 2: cópia de taijutsu e técnicas básicas, previsão aprimorada." },
  { key: "sharingan_3",              name: "Sharingan Nível 3",             typeKey: "cla_uchiha", jutsuRank: "B", chakraCost: 50, description: "Sharingan Completo: cópia de qualquer jutsu exceto Kekkei Genkai, visão perfeita do chakra." },
  { key: "sharingan_paralysis",      name: "Sharingan: Paralisia",          typeKey: "cla_uchiha", jutsuRank: "B", chakraCost: 80, duration: "1 rodada", description: "Genjutsu de contato visual que paralisa o oponente completamente por uma rodada." },
  { key: "magen_kyouten_chiten",     name: "Magen: Kyōten Chiten",          typeKey: "cla_uchiha", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 2, description: "Reverte o genjutsu do oponente, usando-o contra ele mesmo. Técnica de Itachi." },
  { key: "uchiha_kaenjin",           name: "Uchiha Kaenjin",                typeKey: "cla_uchiha", jutsuRank: "B", chakraCost: 70, duration: "1 rodada", usageLimit: 1, description: "Barreira cilíndrica de chamas ao redor do usuário. Defesa absoluta." },
  { key: "uchihagaeshi",             name: "Uchihagaeshi",                  typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 200, duration: "1 rodada", usageLimit: 1, description: "Reflete um jutsu do oponente de volta com o leque Gunbai. Técnica de Madara Uchiha." },
  { key: "izanagi",                  name: "Izanagi",                       typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 300, usageLimit: 1, description: "Torna ferimentos do usuário ilusórios. Pode prevenir a morte. O olho usado fica cego permanentemente." },
  { key: "izanami",                  name: "Izanami",                       typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 300, usageLimit: 1, description: "Prende o oponente em loop de genjutsu eterno baseado em sensações físicas. O olho usado fica cego." },
  { key: "mangekyou_sharingan",      name: "Mangekyou Sharingan",           typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 100, description: "Forma evoluída do Sharingan. Concede Amaterasu, Tsukuyomi ou Kamui dependendo do usuário. Degrada a visão." },
  { key: "mangekyou_eterno",         name: "Mangekyou Sharingan Eterno",    typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 150, description: "Implanta olhos de outro Uchiha; restaura visão e combina habilidades de ambos. Usado por Madara e Sasuke." },
  { key: "amaterasu",                name: "Amaterasu",                     typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 300, duration: "3 rodadas", usageLimit: 1, description: "Chamas negras eternas invocadas pelo olho esquerdo de Itachi/Sasuke. Não se extinguem por meios normais." },
  { key: "enton_kagutsuchi",         name: "Enton: Kagutsuchi",             typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 100, description: "Manipula as chamas do Amaterasu em qualquer forma. Requer Amaterasu ativo. Exclusiva de Sasuke." },
  { key: "enton_yasaka_no_magatama", name: "Enton: Yasaka no Magatama",     typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 150, duration: "1 rodada", usageLimit: 3, description: "Projéteis de joias de chamas negras do Susano'o. O ataque ranged mais poderoso do Mangekyou." },
  { key: "tsukuyomi",                name: "Tsukuyomi",                     typeKey: "cla_uchiha", jutsuRank: "S", chakraCost: 500, duration: "3 rodadas", usageLimit: 1, description: "Dimensão ilusória onde o usuário controla espaço e tempo. Causa tortura psicológica intensa. Técnica de Itachi." },
  { key: "kamui",                    name: "Kamui",                         typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 150, description: "Técnica espaço-temporal que teletransporta partes do corpo ou objetos para a dimensão Kamui. Técnica de Obito/Kakashi." },
  { key: "kamui_intangibilidade",    name: "Kamui: Intangibilidade",        typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Torna o usuário intangível ao teletransportar partes do corpo para o espaço Kamui." },
  { key: "kotoamatsukami",           name: "Kotoamatsukami",                typeKey: "cla_uchiha", jutsuRank: "S", chakraCost: 500, usageLimit: 1, description: "O genjutsu mais poderoso: controla o alvo completamente sem que ele perceba. Técnica exclusiva de Shisui Uchiha. Recarga: uma vez por mês." },
  { key: "susanoo_costelas",         name: "Susano'o: Costelas",            typeKey: "cla_uchiha", jutsuRank: "B", chakraCost: 100, duration: "3 rodadas", usageLimit: 1, description: "Primeira forma do Susano'o — armadura de costelas de chakra. Defesa absoluta." },
  { key: "susanoo_incompleto",       name: "Susano'o Incompleto",           typeKey: "cla_uchiha", jutsuRank: "A", chakraCost: 200, duration: "3 rodadas", usageLimit: 1, description: "Segunda forma — estrutura esquelética completa. Defesa absoluta com força aumentada." },
  { key: "susanoo_completo",         name: "Susano'o Completo",             typeKey: "cla_uchiha", jutsuRank: "S", chakraCost: 500, duration: "3 rodadas", usageLimit: 1, description: "Forma final com musculatura e armadura. Defesa perfeita absoluta. Técnica definitiva do Clã Uchiha." },
  { key: "totsuka_no_tsurugi",       name: "Totsuka no Tsurugi",            typeKey: "cla_uchiha", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", description: "Espada etérea do Susano'o de Itachi. Sela qualquer ser que toca em genjutsu eterno. Usado com o Yata no Kagami." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ AKIMICHI — Expansão Corporal  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "baika_no_jutsu",           name: "Baika no Jutsu",                typeKey: "cla_akimichi", jutsuRank: "D", chakraCost: 15, description: "Técnica de Expansão — aumenta o corpo para incrementar força e dano. Base de todas as técnicas Akimichi." },
  { key: "nikudan_sensha",           name: "Nikudan Sensha",                typeKey: "cla_akimichi", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 3, description: "Tanque de Carne Humana — o corpo expandido rola em alta velocidade como projétil esférico. Técnica de Choji." },
  { key: "horengan_verde",           name: "Hōrengan — Pílula Verde",       typeKey: "cla_akimichi", jutsuRank: "C", chakraCost: 0, duration: "3 rodadas", usageLimit: 1, description: "Primeira pílula secreta Akimichi. Aumenta força ao custo de HP. Causa dores estomacais." },
  { key: "bubun_baika",              name: "Bubun Baika no Jutsu",          typeKey: "cla_akimichi", jutsuRank: "C", chakraCost: 50, description: "Expansão Parcial — expande apenas partes do corpo a 10 vezes o tamanho. Requer Baika ativo." },
  { key: "nikudan_hari_sensha",      name: "Nikudan Hari Sensha",           typeKey: "cla_akimichi", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 3, description: "Tanque com Espinhos — variante do Nikudan Sensha com kunais nos espinhos para dano letal." },
  { key: "kareegan_amarela",         name: "Karēgan — Pílula Amarela",      typeKey: "cla_akimichi", jutsuRank: "B", chakraCost: 0, duration: "3 rodadas", usageLimit: 1, description: "Segunda pílula secreta. Grande aumento de força ao custo de HP grave. Requer pílula verde antes." },
  { key: "chou_baika",               name: "Chou Baika no Jutsu",           typeKey: "cla_akimichi", jutsuRank: "A", chakraCost: 70, duration: "3 rodadas", usageLimit: 1, description: "Super Expansão — corpo cresce ao tamanho de um prédio inteiro. Requer Bubun Baika ativo." },
  { key: "tongarashigan_vermelha",   name: "Tongarashigan — Pílula Vermelha", typeKey: "cla_akimichi", jutsuRank: "S", chakraCost: 0, duration: "3 rodadas", usageLimit: 1, description: "Terceira pílula secreta. Converte gordura em chakra formando asas de borboleta. Poder imenso mas quase certamente fatal após o uso." },
  { key: "choudan_bakugeki",         name: "Choudan Bakugeki",              typeKey: "cla_akimichi", jutsuRank: "S", chakraCost: 500, duration: "1 rodada", usageLimit: 1, description: "Soco Bomba de Borboleta — todo o chakra concentrado em um soco. Cria crateras. Quebra defesas absolutas." },
  { key: "choukaihou",               name: "Choukaihou",                    typeKey: "cla_akimichi", jutsuRank: "S", chakraCost: 0, duration: "3 rodadas", usageLimit: 1, description: "Modo de Borboleta Voluntário — converte calorias em chakra sem pílula. Choji adulto em Shippuden." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ KAGUYA — Shikotsumyaku (Liberação Óssea / Kimimaro)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "shikotsumyaku",            name: "Shikotsumyaku",                 typeKey: "cla_kaguya", jutsuRank: "D", chakraCost: 15, description: "Liberação Óssea — Kekkei Genkai do Clã Kaguya: controle total sobre os próprios ossos como armas. Base de todas as danças." },
  { key: "yanagi_no_mai",            name: "Yanagi no Mai",                 typeKey: "cla_kaguya", jutsuRank: "D", chakraCost: 15, duration: "3 rodadas", description: "Dança do Salgueiro — 1ª forma: projeta ossos das palmas, joelhos e cotovelos para ataque frontal em espiral." },
  { key: "tsubaki_no_mai",           name: "Tsubaki no Mai",                typeKey: "cla_kaguya", jutsuRank: "C", chakraCost: 30, description: "Dança da Camélia — 2ª forma: transforma osso do braço em espada para uso em kenjutsu." },
  { key: "teshi_sendan",             name: "Teshi Sendan",                  typeKey: "cla_kaguya", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Dez Balas dos Dedos — dispara as falanges dos dez dedos como projéteis perfurantes de alta velocidade." },
  { key: "karamatsu_no_mai",         name: "Karamatsu no Mai",              typeKey: "cla_kaguya", jutsuRank: "B", chakraCost: 50, duration: "3 rodadas", usageLimit: 1, description: "Dança da Árvore — 3ª forma: projeta ossos do torso como pontas afiadas para defesa e ataque. Defesa absoluta contra taijutsu." },
  { key: "tessenka_no_mai_tsuru",    name: "Tessenka no Mai: Tsuru",        typeKey: "cla_kaguya", jutsuRank: "B", chakraCost: 45, duration: "1 rodada", usageLimit: 1, description: "Dança da Clematite: Vinha — 4ª forma (1ª parte): remove e modifica a coluna como chicote para imobilizar o oponente." },
  { key: "tessenka_no_mai_hana",     name: "Tessenka no Mai: Hana",         typeKey: "cla_kaguya", jutsuRank: "A", chakraCost: 90, duration: "1 rodada", usageLimit: 1, description: "Dança da Clematite: Flor — 4ª forma (2ª parte): broca de osso do antebraço. Requer Tsuru aplicada. Quebra defesas absolutas." },
  { key: "sawarabi_no_mai",          name: "Sawarabi no Mai",               typeKey: "cla_kaguya", jutsuRank: "S", chakraCost: 500, duration: "3 rodadas", usageLimit: 1, description: "Dança da Samambaia — 5ª e última forma: floresta de lanças de osso emergindo do solo em todas as direções. Técnica definitiva de Kimimaro." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ INUZUKA — Técnicas com Ninken  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "dynamic_marking",          name: "Dynamic Marking",               typeKey: "cla_inuzuka", jutsuRank: "D", chakraCost: 0, description: "Akamaru marca o alvo com urina para rastreamento por olfato. Pode também cegar temporariamente." },
  { key: "shikyaku_no_jutsu",        name: "Shikyaku no Jutsu",             typeKey: "cla_inuzuka", jutsuRank: "D", chakraCost: 0, description: "Técnica das Quatro Patas — postura animal que aumenta instintos, garras e reflexos de combate." },
  { key: "juujin_bunshin",           name: "Juujin Bunshin",                typeKey: "cla_inuzuka", jutsuRank: "D", chakraCost: 15, duration: "3 rodadas", description: "O cão parceiro se transforma para parecer idêntico ao usuário, possibilitando ataques coordenados." },
  { key: "tsuga",                    name: "Tsuga",                         typeKey: "cla_inuzuka", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", description: "Presa sobre Presa — rotação furiosa em alta velocidade para ataque perfurante. Quebra paredes de terra com chakra." },
  { key: "gatsuga",                  name: "Gatsuga",                       typeKey: "cla_inuzuka", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Presa Dupla — usuário e Akamaru rodam em furacão simultâneo. Quebra defesas absolutas. Técnica de Kiba." },
  { key: "soutourou",                name: "Juujin Konbi Henge: Soutourou", typeKey: "cla_inuzuka", jutsuRank: "B", chakraCost: 50, duration: "2 rodadas", usageLimit: 1, description: "Lobo de Duas Cabeças — fusão de Kiba e Akamaru em lobo albino gigante com duas cabeças." },
  { key: "tensouga",                 name: "Tensouga",                      typeKey: "cla_inuzuka", jutsuRank: "B", chakraCost: 40, duration: "1 rodada", usageLimit: 1, description: "Presa Gêmea Celeste — versão ampliada do Gatsuga; usuário e cão se fundem para ataque maior. Quebra defesas absolutas." },
  { key: "santourou",                name: "Jinjuu Kongou Henge: Santourou",typeKey: "cla_inuzuka", jutsuRank: "A", chakraCost: 150, duration: "3 rodadas", usageLimit: 1, description: "Lobo de Três Cabeças — fusão do usuário, clone e Akamaru em lobo gigante de três cabeças." },
  { key: "garouga",                  name: "Garouga",                       typeKey: "cla_inuzuka", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Destruidor do Lobo Duplo — rotação devastadora em forma de Soutourou. O ataque mais violento da forma." },

  // ═══════════════════════════════════════════════════════════════════════
  // KEKKEI GENKAI — Liberações elementais combinadas  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════

  // Hyouton (Suiton + Futon) — Haku
  { key: "hyouton_base",             name: "Hyouton",                       typeKey: "hyouton", jutsuRank: "D", chakraCost: 30, description: "Liberação de Gelo — Kekkei Genkai de Haku: combina Suiton e Futon para criar e controlar gelo. Única do Clã da Neve." },
  { key: "hyouton_makyou_hyoushou",  name: "Hyouton: Makyou Hyoushou",      typeKey: "hyouton", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Espelhos de Gelo do Diabo — cria dezenas de espelhos de gelo ao redor do inimigo. O usuário se move entre os espelhos à velocidade imperceptível. Técnica icônica de Haku." },
  { key: "hyouton_sensatsu_suishou", name: "Hyouton: Sensatsu Suishou",     typeKey: "hyouton", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Mil Agulhas de Gelo Voadores — cria centenas de agulhas de gelo que dispara contra o oponente." },
  { key: "hyouton_kokuyou_no_hoko",  name: "Hyouton: Tsubame Fubuki",       typeKey: "hyouton", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Tempestade de Neve de Andorinha — lança agulhas de gelo em rajadas de todos os ângulos." },

  // Ranton (Raiton + Suiton) — Darui
  { key: "ranton_base",              name: "Ranton",                        typeKey: "ranton", jutsuRank: "D", chakraCost: 30, description: "Liberação de Tempestade — Kekkei Genkai de Darui: combina Raiton e Suiton para criar energia elétrica em forma de feixes de luz." },
  { key: "ranton_laser_circus",      name: "Ranton: Laser Circus",          typeKey: "ranton", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Circo de Laser — dispara múltiplos feixes de energia de relâmpago e água que se curvam para perseguir o alvo. Técnica de Darui." },
  { key: "ranton_gian_raiton",       name: "Ranton: Gian",                  typeKey: "ranton", jutsuRank: "B", chakraCost: 60, duration: "1 rodada", description: "Variante Ranton do Gian — feixe de alta voltagem combinado com água que paralisa e causa dano massivo." },

  // Youton (Doton + Katon) — Roshi, Kurotsuchi, Mei Terumi
  { key: "youton_base",              name: "Youton",                        typeKey: "youton", jutsuRank: "D", chakraCost: 30, description: "Liberação de Lava — Kekkei Genkai: combina Doton e Katon para criar e controlar lava. Usada por Roshi, Kurotsuchi e Mei Terumi." },
  { key: "youton_youkai_no_jutsu",   name: "Youton: Youkai no Jutsu",       typeKey: "youton", jutsuRank: "C", chakraCost: 50, duration: "1 rodada", description: "Técnica de Dissolução de Lava — expele lava que dissolve praticamente qualquer material." },
  { key: "youton_shouha",            name: "Youton: Shouyou no Ken",        typeKey: "youton", jutsuRank: "B", chakraCost: 60, duration: "1 rodada", description: "Punho de Lava — reveste o braço em lava que esmaga e queima simultaneamente." },

  // Futton (Suiton + Katon) — Mei Terumi
  { key: "futton_base",              name: "Futton",                        typeKey: "futton", jutsuRank: "D", chakraCost: 30, description: "Liberação de Fervura — Kekkei Genkai de Mei Terumi (Quinta Mizukage): dissolve quase qualquer material com vapor ácido fervente." },
  { key: "futton_komu_no_jutsu",     name: "Futton: Komu no Jutsu",         typeKey: "futton", jutsuRank: "A", chakraCost: 80, duration: "1 rodada", description: "Névoa de Ebulição — expele névoa de vapor ácido que dissolve chakra sólido (incluindo Susano'o) e queima tudo ao redor. Técnica de Mei Terumi." },

  // Shakuton (Futon + Katon) — Pakura
  { key: "shakuton_base",            name: "Shakuton",                      typeKey: "shakuton", jutsuRank: "D", chakraCost: 30, description: "Liberação de Chamuscamento — Kekkei Genkai de Pakura: combina Futon e Katon criando esferas de calor intenso que evaporam a umidade dos corpos." },
  { key: "shakuton_kaen_no_tate",    name: "Shakuton: Kaen no Tate",        typeKey: "shakuton", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Escudo de Chama — barreira de calor intenso que incendeia ataques físicos." },
  { key: "shakuton_cho_kaen",        name: "Shakuton: Cho Kaen no Jutsu",   typeKey: "shakuton", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Esferas de calor absoluto que evaporam a umidade corporal do alvo, incapacitando-o. Técnica definitiva de Pakura." },

  // Jinton (Futon + Doton + Katon) — Onoki, Terceiro Tsuchikage
  { key: "jinton_base",              name: "Jinton",                        typeKey: "jinton_poeira", jutsuRank: "A", chakraCost: 100, description: "Liberação de Poeira — Kekkei Tōta (três naturezas): combina Futon, Doton e Katon. Decompõe qualquer matéria em partículas subatômicas. Técnica de Onoki (Terceiro Tsuchikage)." },
  { key: "jinton_genkai_hakuri",     name: "Jinton: Genkai Hakuri no Jutsu",typeKey: "jinton_poeira", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Técnica de Extração de Componentes — cria cubo/cilindro/esfera de partículas que decompõem tudo dentro. Não pode ser defendido por meios normais. Técnica definitiva de Onoki." },

  // Jiryoku/Satetsu — Terceiro Kazekage, Toroi
  { key: "jiryoku_base",             name: "Jiryoku (Magnetismo)",          typeKey: "jiryoku", jutsuRank: "D", chakraCost: 30, description: "Kekkei Genkai de magnetismo: controla metais com chakra magnético. Usada pelo Terceiro Kazekage e Toroi." },
  { key: "satetsu_kaihou",           name: "Satetsu Kaihou",                typeKey: "jiryoku", jutsuRank: "C", chakraCost: 40, description: "Libera areia de ferro magnética que pode ser moldada em armaduras ou projéteis. Técnica do Terceiro Kazekage." },
  { key: "satetsu_kigusuri",         name: "Satetsu: Kugutsu no Jutsu",     typeKey: "jiryoku", jutsuRank: "A", chakraCost: 100, usageLimit: 1, description: "Controla oponentes revestidos de areia de ferro como marionetes usando o magnetismo. Técnica do Terceiro Kazekage." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Lesmas + Iryo Ninjutsu (Tsunade/Sakura)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_katsuyu",        name: "Kuchiyose: Katsuyu",            typeKey: "kuchiyose_lesmas", jutsuRank: "S", chakraCost: 100, description: "Invoca Katsuyu, a grande lesma. Se divide em partes menores e cura aliados remotamente. Técnica de Tsunade." },
  { key: "enkaku_chiyu",             name: "Enkaku Chiyu",                  typeKey: "iryo_ninjutsu", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Cura remota através da divisão de Katsuyu, distribuindo chakra medicinal por toda uma área de batalha." },
  { key: "shousen_no_jutsu",         name: "Shousen no Jutsu",              typeKey: "iryo_ninjutsu", jutsuRank: "B", chakraCost: 20, description: "Palma Mística — chakra medicinal nas mãos acelera regeneração celular para curar ferimentos ou realizar incisões cirúrgicas precisas. Técnica de Tsunade e Sakura." },
  { key: "chakra_no_mesu",           name: "Chakra no Mesu",                typeKey: "iryo_ninjutsu", jutsuRank: "B", chakraCost: 50, description: "Bisturi de Chakra — incisões cirúrgicas precisas sem criar feridas abertas, reduzindo risco de infecção. Técnica médica fundamental." },
  { key: "saikan_chuushutsu",        name: "Saikan Chuushutsu no Jutsu",    typeKey: "iryo_ninjutsu", jutsuRank: "C", chakraCost: 20, description: "Extração de Veneno — chakra nas pontas dos dedos extrai venenos e toxinas do corpo do paciente." },
  { key: "ranshinshou",              name: "Ranshinshou",                   typeKey: "iryo_ninjutsu", jutsuRank: "B", chakraCost: 100, duration: "3 rodadas", description: "Pulsos elétricos de chakra confundem o sistema nervoso — os membros do oponente se movem na direção oposta à intenção. Técnica de Tsunade." },
  { key: "chikatsu_saisei",          name: "Chikatsu Saisei no Jutsu",      typeKey: "iryo_ninjutsu", jutsuRank: "A", chakraCost: 500, duration: "1 rodada", usageLimit: 1, description: "Regeneração Total — ritual de cura para ferimentos gravíssimos com grande perda de sangue. Requer vários ninjas médicos." },
  { key: "dokugiri",                 name: "Dokugiri",                      typeKey: "iryo_ninjutsu", jutsuRank: "A", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Névoa de Veneno — chakra transformado em substâncias venenosas letais expelidas como névoa. Inalação mínima causa morte em 3 rodadas sem tratamento." },
  { key: "ninpou_byakugou",          name: "Ninpou: Byakugou no Jutsu",     typeKey: "iryo_ninjutsu", jutsuRank: "S", chakraCost: 550, duration: "4 rodadas", usageLimit: 1, description: "Arte Ninja: Cem Forças — o Selo do Diamante libera reserva de chakra acumulada. Cura automática de ferimentos instantaneamente, mesmo inconsciente. Técnica de Tsunade (o losango na testa)." },
  { key: "ninpou_souzou_saisei",     name: "Ninpou: Souzou Saisei",         typeKey: "iryo_ninjutsu", jutsuRank: "S", chakraCost: 500, duration: "1 rodada", usageLimit: 1, description: "Regeneração Mitótica — força criação de proteínas e fragmentação celular para reconstruir todos os tecidos e órgãos instantaneamente. A técnica médica máxima de Tsunade." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Cães / Kakashi  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_caes_kakashi",   name: "Kuchiyose: Ninken (8 Cães)",    typeKey: "kuchiyose_caes", jutsuRank: "B", chakraCost: 50, description: "Invoca os oito ninken de Kakashi: Pakkun, Bull, Uhei e outros. Podem rastrear por cheiro, imobilizar e coordenar ataques." },
  { key: "ninken_sajin_no_mai",      name: "Ninken Ninpou: Sajin no Mai",   typeKey: "kuchiyose_caes", jutsuRank: "C", chakraCost: 0, duration: "1 rodada", usageLimit: 1, description: "Dança da Nuvem de Poeira — oito cães escavam rapidamente criando nuvem de poeira que cega temporariamente o oponente." },
  { key: "ninken_kakuyoku_no_jin",   name: "Kakuyoku no Jin",               typeKey: "kuchiyose_caes", jutsuRank: "C", chakraCost: 0, duration: "1 rodada", usageLimit: 1, description: "Formação do Grou — os cães saltam e cercam o oponente por cima, mordendo membros para imobilizá-lo." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Macacos / Hiruzen (Enma)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_enma",           name: "Kuchiyose: Enma",               typeKey: "kuchiyose_macacos", jutsuRank: "S", chakraCost: 100, description: "Invoca Enma, o Rei dos Macacos e companheiro do Terceiro Hokage. Pode se transformar no Cajado de Adamante." },
  { key: "henge_kongounyoi",         name: "Henge: Kongounyoi",             typeKey: "kuchiyose_macacos", jutsuRank: "A", chakraCost: 10, description: "Enma se transforma em um cajado tão duro quanto diamante que pode se estender. Técnica de Hiruzen Sarutobi." },
  { key: "kongou_rouheki",           name: "Kongou Rouheki",                typeKey: "kuchiyose_macacos", jutsuRank: "A", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Jaula de Diamante Inquebrável — cria prisão de resistência máxima para contenção ou proteção." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ UZUMAKI — Correntes e Selamentos  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kongo_fusa",               name: "Kongo Fusa",                    typeKey: "cla_uzumaki", jutsuRank: "C", chakraCost: 30, description: "Correntes de Adamante — materializa chakra em correntes para restrição, combate ou transporte. Técnica de Kushina Uzumaki." },
  { key: "chakura_kusari",           name: "Chakura Kusari",                typeKey: "cla_uzumaki", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Correntes de Chakra subterrâneas que imobilizam o oponente. Técnica Uzumaki." },
  { key: "kongo_fusa_aprimorado",    name: "Kongo Fusa (Aprimorado)",       typeKey: "cla_uzumaki", jutsuRank: "A", chakraCost: 90, description: "Correntes de Adamante Aprimoradas — prende até Bijuu e impede movimentação de Susano'o. Técnica de Kushina no modo de nascimento de Naruto." },
  { key: "shisho_fuin_uzumaki",      name: "Shisho Fuin",                   typeKey: "cla_uzumaki", jutsuRank: "B", chakraCost: 100, description: "Selo dos Quatro Símbolos — sela entidades incluindo Bijuu em objetos ou corpos. Técnica fundamental Uzumaki." },
  { key: "hakke_fuin_shiki_uzumaki", name: "Hakke no Fuin Shiki",           typeKey: "cla_uzumaki", jutsuRank: "S", chakraCost: 300, usageLimit: 1, description: "Estilo Selamento dos Oito Trigramas — dois Selos dos Quatro Símbolos combinados para selar Bijuu. O selo usado para selar o Kyuubi em Naruto." },
  { key: "sensing_negative_emotions", name: "Sensing Negative Emotions",   typeKey: "cla_uzumaki", jutsuRank: "B", chakraCost: 10, description: "Detecta intenções malignas independente de ocultamento de chakra. Desenvolvido por Naruto com o chakra do Kyuubi." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ YAMANAKA — Transferência Mental  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "shintenshin_no_jutsu",     name: "Shintenshin no Jutsu",          typeKey: "cla_yamanaka", jutsuRank: "C", chakraCost: 50, duration: "1 rodada", usageLimit: 3, description: "Transferência Mental — transfere a consciência do usuário para o alvo, assumindo controle total do corpo. Técnica de Ino Yamanaka." },
  { key: "shinten_bunshin",          name: "Shinten Bunshin no Jutsu",      typeKey: "cla_yamanaka", jutsuRank: "C", chakraCost: 50, duration: "1 rodada", usageLimit: 3, description: "Transferência Mental Múltipla — controla vários alvos simultaneamente com acesso às suas técnicas." },
  { key: "hikenshin_no_jutsu",       name: "Hikenshin no Jutsu",            typeKey: "cla_yamanaka", jutsuRank: "C", chakraCost: 15, duration: "1 rodada", description: "Leitura da Mente — penetra a mente do alvo para extrair informações sem assumir controle." },
  { key: "shinranshin_no_jutsu",     name: "Shinranshin no Jutsu",          typeKey: "cla_yamanaka", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 3, description: "Técnica de Confusão Mental — força o oponente a atacar seus próprios aliados contra a própria vontade." },
  { key: "yamanaka_telepatia",       name: "Yamanaka Telepathy",            typeKey: "cla_yamanaka", jutsuRank: "B", chakraCost: 50, description: "Comunicação telepática com múltiplos alvos simultâneos. Usado durante a Quarta Grande Guerra." },
  { key: "shinten_ishoku",           name: "Shinten Ishoku no Jutsu",       typeKey: "cla_yamanaka", jutsuRank: "B", chakraCost: 30, description: "Implanta memórias falsas ou sela memórias existentes na mente do alvo." },
  { key: "shinran_enbu",             name: "Shinran Enbu no Jutsu",         typeKey: "cla_yamanaka", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Técnica de Destruição Mental — força múltiplos oponentes a atacarem uns aos outros de forma autônoma." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ ABURAME — Técnicas de Insetos  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kikaichu_no_jutsu",        name: "Kikaichu no Jutsu",             typeKey: "cla_aburame", jutsuRank: "D", chakraCost: 30, description: "Técnica dos Insetos Parasitas Destruidores — base do Clã Aburame: os kikaichu vivem no corpo do usuário e obedecem seus comandos, consumindo chakra do oponente." },
  { key: "mushi_bunshin",            name: "Mushi Bunshin no Jutsu",        typeKey: "cla_aburame", jutsuRank: "D", chakraCost: 10, duration: "1 rodada", usageLimit: 2, description: "Clone de Insetos — cria clone de insetos que pode evadir técnicas inimigas." },
  { key: "mushi_kame_no_jutsu",      name: "Mushi Kame no Jutsu",           typeKey: "cla_aburame", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Escudo de Insetos em forma de domo que provê defesa absoluta contra golpes físicos." },
  { key: "senro",                    name: "Senro",                         typeKey: "cla_aburame", jutsuRank: "D", chakraCost: 0, description: "Rastreamento passivo via insetos implantados — localiza alvos até 10 km de distância." },
  { key: "kikai_sabaki_1",           name: "Kikai Sabaki no Jutsu",         typeKey: "cla_aburame", jutsuRank: "C", chakraCost: 0, duration: "1 rodada", usageLimit: 3, description: "Enxame de insetos drena o chakra do oponente. Técnica fundamental de Shino Aburame." },
  { key: "kikaichuu_tsumoji",        name: "Kikaichuu Tsumoji no Jutsu",    typeKey: "cla_aburame", jutsuRank: "C", chakraCost: 0, duration: "1 rodada", usageLimit: 3, description: "Mini-tornado de insetos que drenam chakra enquanto giram ao redor do oponente." },
  { key: "hijutsu_nushin_maya",      name: "Hijutsu: Nushin Maya",          typeKey: "cla_aburame", jutsuRank: "B", chakraCost: 50, duration: "3 rodadas", usageLimit: 1, description: "Acelera a evolução e reprodução dos insetos, aumentando o poder das técnicas do clã." },
  { key: "kikaichuu_arare",          name: "Kikaichuu Arare no Jutsu",      typeKey: "cla_aburame", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Esfera comprimida de insetos — causa dano e drena chakra do oponente no impacto." },
  { key: "kikaichuu_yajiri",         name: "Kikaichuu Yajiri no Jutsu",     typeKey: "cla_aburame", jutsuRank: "A", chakraCost: 120, duration: "1 rodada", usageLimit: 1, description: "Cilindro de insetos prende o oponente, imobilizando-o e drenando 30% de seu chakra." },
  { key: "kikaichuu_shijain",        name: "Kikaichuu Shijain",             typeKey: "cla_aburame", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Nuvem de insetos em ataque aéreo massivo — causa dano elevado e drena grande quantidade de chakra." },
  { key: "hijutsu_mushidama_shi",    name: "Hijutsu: Mushidama Shi no Jutsu", typeKey: "cla_aburame", jutsuRank: "S", chakraCost: 250, duration: "3 rodadas", usageLimit: 1, description: "Esfera Mortal de Insetos — envolve o oponente e drena metade do chakra inicial, depois 10% por rodada até morte por inanição." },

  // ═══════════════════════════════════════════════════════════════════════
  // EXCLUSIVO — Jiongu / Kakuzu  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "jiongu",                   name: "Jiongu",                        typeKey: "jiongu", jutsuRank: "B", chakraCost: 20, description: "Rancor Terreno — implanta corações roubados no corpo para imortalidade. Cada coração concede acesso aos jutsus do original. Máximo de 5 corações (+ o próprio). Técnica de Kakuzu." },
  { key: "jiongu_moji_retsu",        name: "Jiongu Moji Retsu",             typeKey: "jiongu", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", description: "Controle dos fios negros do Jiongu para ataques ou reparos; cada fio causa dano adicional." },
  { key: "jiongu_harishigoto",       name: "Jiongu Harishigoto",            typeKey: "jiongu", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Usa os fios para costurar e reparar objetos ou o próprio corpo, restaurando HP." },
  { key: "jiongu_gouken",            name: "Jiongu Gouken",                 typeKey: "jiongu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Projeta punhos pelos fios dos pulsos para golpes à distância ou estrangulamento." },
  { key: "biguro",                   name: "Biguro",                        typeKey: "jiongu", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Fios subterrâneos emergem sob o alvo para contra-ataque surpresa com imobilização." },
  { key: "jiongu_henge",             name: "Jiongu Henge",                  typeKey: "jiongu", jutsuRank: "B", chakraCost: 50, description: "Fios se tornam visíveis; membros se separam para flexibilidade monstruosa. Forma de batalha padrão de Kakuzu." },
  { key: "jiongu_shinzoma",          name: "Jiongu Shinzoma",               typeKey: "jiongu", jutsuRank: "A", chakraCost: 100, description: "Forma final — libera os quatro corações elementais (Fogo, Relâmpago, Água, Vento) como entidades separadas. Para matar o usuário é preciso derrotar todas as cinco entidades." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ SENJU / YAMATO — Mokuton (Liberação de Madeira)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "mokuton_base",             name: "Mokuton",                       typeKey: "cla_senju", jutsuRank: "D", chakraCost: 30, description: "Liberação de Madeira — Kekkei Genkai do Clã Senju: combina Suiton e Doton para criar e controlar madeira. Usada por Hashirama Senju e Yamato." },
  { key: "mokuton_moku_shouheki",    name: "Mokuton: Moku Shouheki no Jutsu", typeKey: "cla_senju", jutsuRank: "C", chakraCost: 25, duration: "1 rodada", usageLimit: 1, description: "Barreira de Madeira praticamente impenetrável." },
  { key: "mokuton_shichuurou",       name: "Mokuton: Shichuurou no Jutsu",  typeKey: "cla_senju", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Prisão de Quatro Pilares — imobiliza o oponente dentro de uma cela de madeira." },
  { key: "mokuton_moku_bunshin",     name: "Mokuton: Moku Bunshin no Jutsu",typeKey: "cla_senju", jutsuRank: "C", chakraCost: 10, duration: "2 rodadas", description: "Cria clone de madeira com as características físicas do usuário." },
  { key: "mokuton_moku_shibari",     name: "Mokuton: Moku Shibari no Jutsu",typeKey: "cla_senju", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Grandes galhos emergem e imobilizam o oponente completamente." },
  { key: "mokuton_jukai_heki",       name: "Mokuton: Jukai Heki",           typeKey: "cla_senju", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Barreira de Floresta Densa — parede de árvores entrelaçadas impede o avanço." },
  { key: "mokuton_jubaku_eisou",     name: "Mokuton: Jubaku Eisou",         typeKey: "cla_senju", jutsuRank: "B", chakraCost: 80, duration: "1 rodada", usageLimit: 1, description: "Raízes enlaçam e esmagam o inimigo dentro de uma árvore. Causa dano grave por constrição." },
  { key: "hokage_shiki_jijun",       name: "Hokage Shiki Jijun Jutsu: Kakuan Nitten Suishu", typeKey: "cla_senju", jutsuRank: "A", chakraCost: 150, duration: "1 rodada", usageLimit: 1, description: "Técnica do Estilo Hokage — sela ou extrai chakra de Bijuu. A técnica de Yamato para suprimir o Kyuubi de Naruto." },
  { key: "mokuton_hotei",            name: "Mokuton: Hotei no Jutsu",       typeKey: "cla_senju", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Mãos Gigantes de Madeira — mãos enormes contêm qualquer alvo, incluindo Bijuu e Susano'o. Técnica de Hashirama." },
  { key: "mokuton_jukai_koutan",     name: "Mokuton Hijutsu: Jukai Koutan", typeKey: "cla_senju", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Gênese da Floresta — cria uma floresta inteira para ataque e defesa simultâneos. Técnica definitiva de Hashirama." },
  { key: "mokuton_mokuryu",          name: "Mokuton: Mokuryu no Jutsu",     typeKey: "cla_senju", jutsuRank: "S", chakraCost: 500, duration: "3 rodadas", usageLimit: 1, description: "Dragão de Madeira gigante que ataca e drena chakra do oponente por rodada." },
  { key: "moku_no_senjutsu",         name: "Moku no Senjutsu",              typeKey: "cla_senju", jutsuRank: "S", chakraCost: 250, duration: "3 rodadas", usageLimit: 3, description: "Senjutsu da Madeira — Modo Sábio específico de Hashirama que amplifica imensamente todas as técnicas de madeira." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ HOZUKI — Técnica de Hidratação  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "suika_no_jutsu",           name: "Suika no Jutsu",                typeKey: "cla_hozuki", jutsuRank: "D", chakraCost: 30, description: "Técnica do Corpo d'Água — transforma o corpo em água, reduzindo dano de taijutsu. Base do Clã Hozuki. Usado por Suigetsu e Mangetsu Hozuki." },
  { key: "kongoo_suika",             name: "Kongoo Suika no Jutsu",         typeKey: "cla_hozuki", jutsuRank: "D", chakraCost: 15, duration: "3 rodadas", usageLimit: 3, description: "Fusão com fontes de água enquanto Suika está ativo. Permite esconder-se em rios e lagos." },
  { key: "kurage_suika",             name: "Kurage Suika no Jutsu",         typeKey: "cla_hozuki", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", usageLimit: 3, description: "Separação do Corpo d'Água — divide-se em partes menores para fuga ou evasão de ataques." },
  { key: "mizu_kawarimi_suika",      name: "Mizu Kawarimi: Suika no Jutsu", typeKey: "cla_hozuki", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 3, description: "Substitui o corpo por água para esquivar de ataques e reaparecer em outro ponto." },
  { key: "ritorudoragon_hozuki",     name: "Ritorudoragon",                 typeKey: "cla_hozuki", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Dragão d'água controlável criado pelo próprio corpo do usuário." },
  { key: "uootaaponpu",              name: "Uootaaponpu",                   typeKey: "cla_hozuki", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Bomba d'Água — o usuário se transforma em esfera d'água para esmagar o oponente com pressão massiva." },
  { key: "fukasu_mizudeppoo",        name: "Fukasu Mizudeppoo",             typeKey: "cla_hozuki", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 2, description: "Metralhadora d'Água — braço transformado em disparador de água guiado por chakra com cadência altíssima." },

  // ═══════════════════════════════════════════════════════════════════════
  // EXCLUSIVO — Kibaku Nendo / Deidara  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kibaku_nendo_base",        name: "Kibaku Nendo (Ativação)",       typeKey: "cla_kibaku_nendo", jutsuRank: "D", chakraCost: 20, description: "Liberação de Argila Explosiva — Kekkei Genkai de Deidara: as bocas nas palmas mastigam argila infundida com chakra explosivo. Base de todos os C-type." },
  { key: "kibaku_nendo_c1",          name: "Kibaku Nendo: C1",              typeKey: "cla_kibaku_nendo", jutsuRank: "C", chakraCost: 15, duration: "1 rodada", description: "Pequenas criaturas de argila animadas (insetos, pássaros, serpentes) que detonam no comando. Volume de explosivos limitado." },
  { key: "kibaku_nendo_kumo",        name: "Kibaku Nendo: Kumo",            typeKey: "cla_kibaku_nendo", jutsuRank: "C", chakraCost: 15, duration: "1 rodada", description: "Aranhas de argila que se fixam no alvo e detonam no comando." },
  { key: "kibaku_nendo_tori",        name: "Kibaku Nendo: Tori",            typeKey: "cla_kibaku_nendo", jutsuRank: "C", chakraCost: 15, duration: "1 rodada", description: "Pássaros de argila em alta velocidade que perseguem e detonam no alvo." },
  { key: "nendo_bunshin",            name: "Nendo Bunshin",                 typeKey: "cla_kibaku_nendo", jutsuRank: "C", chakraCost: 30, usageLimit: 1, description: "Clone de argila como substituto; pode explodir com o inimigo preso dentro." },
  { key: "kibaku_nendo_taka",        name: "Kibaku Nendo: Taka",            typeKey: "cla_kibaku_nendo", jutsuRank: "C", chakraCost: 15, description: "Águia de argila para transporte aéreo e bombardeio. Requer chakra por rodada mantida." },
  { key: "kibaku_nendo_c2",          name: "Kibaku Nendo: C2",              typeKey: "cla_kibaku_nendo", jutsuRank: "B", chakraCost: 30, description: "Dragão de argila gigante para transporte e combate; cospe mini-dragões como mísseis teleguiados. 2 usos por combate." },
  { key: "kibaku_jirai",             name: "Kibaku Jirai",                  typeKey: "cla_kibaku_nendo", jutsuRank: "B", chakraCost: 50, usageLimit: 1, description: "Minas explosivas de argila no subsolo que detonam automaticamente quando ativadas." },
  { key: "kibaku_nendo_c3",          name: "Kibaku Nendo: C3",              typeKey: "cla_kibaku_nendo", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Estátua massiva de argila lançada de grande altitude; poder suficiente para destruir partes de uma vila inteira." },
  { key: "ningyou_kibaku_nendo",     name: "Ningyou Kibaku Nendo",          typeKey: "cla_kibaku_nendo", jutsuRank: "A", chakraCost: 100, duration: "3 rodadas", usageLimit: 1, description: "Cinco marionetes de argila controladas por fios; se multiplicam quando cortadas. Usadas contra Gaara." },
  { key: "kibaku_nendo_c4",          name: "Kibaku Nendo: C4",              typeKey: "cla_kibaku_nendo", jutsuRank: "S", chakraCost: 1000, duration: "1 rodada", usageLimit: 1, description: "Marionete gigante de argila que libera nuvem de micro-bombas invisíveis. Destroem o alvo em nível celular. Só escapa com Defesa Absoluta Perfeita." },
  { key: "kibaku_nendo_c0",          name: "Kibaku Nendo: C0",              typeKey: "cla_kibaku_nendo", jutsuRank: "S", chakraCost: 1000, duration: "1 rodada", usageLimit: 1, description: "Arte Final Suicida — detona a partir do próprio tórax. Raio de 10 km de destruição total. Mata o usuário. Técnica suprema de Deidara." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUGUTSU NO JUTSU — Técnicas de Marionete (Sasori, Chiyo, Kankuro)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kugutsu_no_jutsu",         name: "Kugutsu no Jutsu",              typeKey: "cla_kugutsu", jutsuRank: "D", chakraCost: 10, description: "Técnica da Marionete — cria fios de chakra para controlar bonecos ou objetos à distância. Base de todo o estilo de combate dos mestres de marionetes." },
  { key: "kugutsu_henge",            name: "Kugutsu Henge no Jutsu",        typeKey: "cla_kugutsu", jutsuRank: "D", chakraCost: 30, description: "Altera a aparência de uma marionete para se disfarçar ou surpreender o oponente." },
  { key: "kugutsu_kawarimi",         name: "Kugutsu Kawarimi",              typeKey: "cla_kugutsu", jutsuRank: "D", chakraCost: 30, description: "O usuário se esconde nos invólucros da marionete para um contra-ataque surpresa." },
  { key: "mugen_senbon_hougeki",     name: "Mugen Senbon Hougeki",          typeKey: "cla_kugutsu", jutsuRank: "C", chakraCost: 50, duration: "1 rodada", description: "Chuva infinita de agulhas disparadas pela marionete em todas as direções. Difícil de escapar." },
  { key: "dokugiri_kugutsu",         name: "Dokugiri Zuyoku",               typeKey: "cla_kugutsu", jutsuRank: "C", chakraCost: 50, duration: "1 rodada", description: "Fumaça venenosa combinada com chuva de senbon pela marionete. Causa envenenamento e visibilidade zero." },
  { key: "souen_hitomi_gokuu",       name: "Souen: Hitomi Gokuu",           typeKey: "cla_kugutsu", jutsuRank: "B", chakraCost: 150, description: "Controla o corpo humano diretamente via fios de chakra (requer consentimento ou captura prévia)." },
  { key: "shirohigi_ogi_mugen",      name: "Shirohigi Ōgi: Mugen no Shū",  typeKey: "cla_kugutsu", jutsuRank: "B", chakraCost: 100, duration: "1 rodada", description: "Ataque simultâneo de múltiplos corpos de marionete em todas as direções." },
  { key: "senju_sobu",               name: "Senju Sobu",                    typeKey: "cla_kugutsu", jutsuRank: "A", chakraCost: 0, duration: "1 rodada", description: "Milhares de braços da marionete emergem e atacam — técnica de área devastadora de Sasori." },
  { key: "hitokugutsu",              name: "Hitokugutsu",                   typeKey: "cla_kugutsu", jutsuRank: "S", chakraCost: 1000, description: "Transforma cadáveres humanos em marionetes permanentes que retêm as habilidades e Kekkei Genkai originais. Técnica proibida de Sasori." },
  { key: "hyakki_no_souen",          name: "Karakuri Engeki: Akahigi Hyakki no Souen", typeKey: "cla_kugutsu", jutsuRank: "S", chakraCost: 1000, description: "Invoca 100 marionetes humanas simultaneamente. A técnica definitiva de Sasori do Deserto — seu 'terceiro maior tesouro'." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Rashoumon / Portões  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "rashoumon",                name: "Rashōmon",                      typeKey: "kuchiyose_rashoumon", jutsuRank: "B", chakraCost: 40, duration: "1 rodada", usageLimit: 1, description: "Portão Demônico invocado que serve como barreira defensiva ou armadilha. Técnica de Orochimaru e Sakon." },
  { key: "sou_rashoumon",            name: "Sō Rashōmon",                   typeKey: "kuchiyose_rashoumon", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Três Portões Demônicos invocados simultaneamente. A defesa mais poderosa de Orochimaru — resistiu ao ataque de Gamabunta." },
  { key: "rashoumon_ro_yose",        name: "Rashōmon: Ro Yose",             typeKey: "kuchiyose_rashoumon", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", usageLimit: 2, description: "Portão invocado com o oponente entre as duas folhas — o portão fecha esmagando o alvo e liberando energia." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Aranhas / Kidoumaru  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_kyodaigumo",     name: "Kuchiyose: Kyodaigumo",         typeKey: "kuchiyose_aranhas", jutsuRank: "B", chakraCost: 50, description: "Invoca a aranha gigante mãe dos aracnídeos de Kidoumaru. Ela libera ovos contendo centenas de aranhas menores." },
  { key: "moujourou",                name: "Moujourou",                     typeKey: "kuchiyose_aranhas", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Prisão de Teia de Aranha — invoca uma aranha que manipula sua teia criando uma estrutura que envolve e imobiliza o oponente." },
  { key: "amegumo",                  name: "Amegumo",                       typeKey: "kuchiyose_aranhas", jutsuRank: "B", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Chuva de Aranhas — saco liberado pela Kyodaigumo contendo filhotes do tamanho de cães que descem envolvendo o oponente em teias. Requer Kyodaigumo invocada." },
  { key: "sticki_gold",              name: "Stīki Gōrudo",                  typeKey: "kuchiyose_aranhas", jutsuRank: "C", chakraCost: 30, description: "Seda endurecida como ouro — Kidoumaru cria projéteis de seda solidificada extremamente resistentes." },
  { key: "kidoumaru_yomi_numa",      name: "Nenkin no Ya",                  typeKey: "kuchiyose_aranhas", jutsuRank: "B", chakraCost: 40, duration: "1 rodada", description: "Flecha de seda dourada solidificada disparada como projétil de alta velocidade. Técnica de precisão de Kidoumaru." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Aves  [PARCIALMENTE CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "karasu_bunshin",           name: "Karasu Bunshin no Jutsu",       typeKey: "kuchiyose_aves", jutsuRank: "D", chakraCost: 5, description: "Técnica do Clone de Corvo — clones que se dispersam em corvos quando destruídos. Técnica de Itachi Uchiha." },
  { key: "karasu_shunshin",          name: "Karasu Shunshin no Jutsu",      typeKey: "kuchiyose_aves", jutsuRank: "D", chakraCost: 10, duration: "1 rodada", usageLimit: 1, description: "Teleporte camuflado pelo movimento de corvos. Técnica de Itachi Uchiha." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ JUUGO — Senninka / Selo Maldito  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "senninka_1",               name: "Senninka Nível 1",              typeKey: "cla_juugo", jutsuRank: "C", chakraCost: 30, description: "Transformação Sábia Parcial — absorve uma pequena quantidade de energia natural criando mutação em metade do corpo. +15 em todos os atributos. Base do Clã Juugo." },
  { key: "senninka_2",               name: "Senninka Nível 2",              typeKey: "cla_juugo", jutsuRank: "B", chakraCost: 50, description: "Transformação Sábia Completa — corpo inteiro se transforma com mutações extremas. +50 em todos os atributos. Juugo perde parcialmente o controle." },
  { key: "saibou_kyuuin",            name: "Saibō Kyūin",                  typeKey: "cla_juugo", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Absorção Celular — drena energia vital e chakra do oponente para restaurar HP e chakra do usuário." },
  { key: "saibou_haishutsu",         name: "Saibō Haishutsu",              typeKey: "cla_juugo", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", description: "Ejeção Celular — transfere células pessoais para curar aliados, restaurando HP. O usuário sofre o desgaste." },
  { key: "maku_no_jyuuin",           name: "Maku no Jyuuin",                typeKey: "cla_juugo", jutsuRank: "A", chakraCost: 100, usageLimit: 1, description: "Marca do Selo Maldito — implanta o Selo Maldito em outro ninja, transferindo consciência do usuário para o novo portador." },
  { key: "jettosumasshu",            name: "Jettosumasshu",                 typeKey: "cla_juugo", jutsuRank: "B", chakraCost: 55, duration: "1 rodada", description: "Golpe com jato — ataque que quebra defesas absolutas usando propulsão de energia natural." },
  { key: "senninka_final",           name: "Senninka Final",                typeKey: "cla_juugo", jutsuRank: "S", chakraCost: 300, duration: "3 rodadas", usageLimit: 1, description: "Transformação extrema com +500 atributos mas causa insanidade temporária. Após o fim, o usuário não pode usar jutsus por 1 rodada." },

  // ═══════════════════════════════════════════════════════════════════════
  // BAKUTON — Liberação de Explosão (Gari)  [CANÔNICO]
  // Nota: A argila explosiva de Deidara está em cla_kibaku_nendo.
  // Bakuton de Gari é uma Kekkei Genkai separada (Raiton + Doton).
  // ═══════════════════════════════════════════════════════════════════════
  { key: "bakuton_base",             name: "Bakuton",                       typeKey: "bakuton", jutsuRank: "C", chakraCost: 50, description: "Liberação de Explosão — Kekkei Genkai de Gari (do Exército Shinobi da Aliança): combina Doton e Raiton para criar explosões ao toque. Qualquer parte do corpo pode detonar." },
  { key: "bakuton_rendan",           name: "Bakuton: Rendan",                typeKey: "bakuton", jutsuRank: "B", chakraCost: 60, duration: "1 rodada", description: "Série de golpes físicos que terminam em explosão devastadora ao contato final." },
  { key: "bakuton_chakra_bakuhatsu", name: "Bakuton: Chakra Bakuhatsu",     typeKey: "bakuton", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Liberação total de chakra explosivo do corpo em área ao redor. A técnica mais poderosa de Gari." },

  // ═══════════════════════════════════════════════════════════════════════
  // SHOUTON — Liberação de Cristal (Guren)  [CANÔNICO — Anime]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "shouton_base",             name: "Shouton",                       typeKey: "shouton", jutsuRank: "C", chakraCost: 40, description: "Liberação de Cristal — Kekkei Genkai de Guren (arco do anime): cristaliza qualquer substância, criando estruturas de cristal. Exclusiva do anime." },
  { key: "shouton_suishou_no_jutsu", name: "Shouton: Suishō no Jutsu",      typeKey: "shouton", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Cria projéteis de cristal afiados disparados em alta velocidade." },
  { key: "shouton_roshou_no_jutsu",  name: "Shouton: Roshou no Jutsu",      typeKey: "shouton", jutsuRank: "B", chakraCost: 60, duration: "1 rodada", usageLimit: 1, description: "Cristaliza e aprisiona o oponente numa estrutura de cristal sólido." },
  { key: "shouton_meiro_no_jutsu",   name: "Shouton: Meiro no Jutsu",       typeKey: "shouton", jutsuRank: "B", chakraCost: 80, description: "Labirinto de Cristal — cria labirinto de cristais ao redor do campo de batalha, desorientando e aprisionando o oponente." },
  { key: "shouton_suishou_kajuu",    name: "Shouton: Suishō Kajū",          typeKey: "shouton", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Árvore de Cristal gigante que cresce rapidamente aprisionando o alvo nos galhos e cristalizando-o." },

  // ═══════════════════════════════════════════════════════════════════════
  // SHICHI TEN KOHOU — Sete Ativações (sistema de treino de Guy/Lee)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "shichi_daiichi_kassei",    name: "Daiichi Kassei",                typeKey: "shichi_ten_kohou", jutsuRank: "D", chakraCost: 35, duration: "3 rodadas", description: "Primeira Ativação — olhos brancos, aura amarela. +20 em todos atributos e +100 de chakra." },
  { key: "shichi_daini_kassei",      name: "Daini Kassei",                  typeKey: "shichi_ten_kohou", jutsuRank: "C", chakraCost: 50, duration: "3 rodadas", description: "Segunda Ativação — músculos se expandem. +30 em todos atributos e +200 de chakra." },
  { key: "shichi_daisan_kassei",     name: "Daisan Kassei",                 typeKey: "shichi_ten_kohou", jutsuRank: "B", chakraCost: 65, duration: "3 rodadas", description: "Terceira Ativação — pele avermelhada. +40 em todos atributos, +300 chakra e mobilidade aérea." },
  { key: "shichi_daiyon_kassei",     name: "Daiyon Kassei",                 typeKey: "shichi_ten_kohou", jutsuRank: "B", chakraCost: 80, duration: "3 rodadas", description: "Quarta Ativação — força e velocidade máximas. +50 em todos atributos e +400 chakra." },
  { key: "shichi_daigo_kassei",      name: "Daigo Kassei",                  typeKey: "shichi_ten_kohou", jutsuRank: "A", chakraCost: 95, duration: "3 rodadas", description: "Quinta Ativação — libera Asa Kujaku (Pavão Matinal). +100 em todos atributos e +500 chakra." },
  { key: "shichi_dairoku_kassei",    name: "Dairoku Kassei",                typeKey: "shichi_ten_kohou", jutsuRank: "S", chakraCost: 350, duration: "3 rodadas", description: "Sexta Ativação — suor luminoso verde. +200 em todos atributos, +600 chakra. Libera Hirudora (Tigre do Dia)." },
  { key: "shichi_daishichi_kassei",  name: "Daishichi Kassei",              typeKey: "shichi_ten_kohou", jutsuRank: "S", chakraCost: 450, duration: "3 rodadas", usageLimit: 1, description: "Sétima Ativação — aura de vapor amarelo de sangue. +350 em todos atributos, +700 chakra, quebra defesas absolutas. O usuário morre após 3 rodadas." },

  // ═══════════════════════════════════════════════════════════════════════
  // MEITON — Liberação das Trevas (Hiruko — Filme)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "meiton_base",              name: "Meiton",                        typeKey: "meiton", jutsuRank: "C", chakraCost: 0, description: "Liberação das Trevas — Kekkei Genkai de Hiruko (Filme A Vontade de Fogo). A mão esquerda absorve chakra e anula jutsus de rank igual; a direita libera como vórtice destrutivo." },

  // ═══════════════════════════════════════════════════════════════════════
  // TAITON — Liberação de Tufão  [PARCIALMENTE CANÔNICO — RPG]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "taiton_base",              name: "Taiton",                        typeKey: "taiton", jutsuRank: "C", chakraCost: 20, description: "Liberação de Tufão — Kekkei Genkai avançada de vento: gera ciclones e tornados capazes de mover entidades como o Susano'o completo." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Gatos / Nekomata  [CANÔNICO — Anime]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_nekomata",       name: "Kuchiyose: Nekomata",           typeKey: "kuchiyose_gatos", jutsuRank: "B", chakraCost: 50, description: "Invoca Nekomata, a grande gata-fantasma de dois rabo. Aparece no anime de Naruto." },
  { key: "neko_no_gen",              name: "Neko no Gen",                   typeKey: "kuchiyose_gatos", jutsuRank: "C", chakraCost: 0, duration: "1 rodada", usageLimit: 1, description: "Genjutsu do gato — múltiplos gatos atacam o oponente em ilusão que causa dano real. Técnica de Nekomata." },
  { key: "neko_capa",                name: "Arte Ninja: Capa de Gato",      typeKey: "kuchiyose_gatos", jutsuRank: "C", chakraCost: 50, usageLimit: 1, description: "O usuário é envolto em chakra felino, ganhando características de gato (garras, reflexos, cauda). Permite escolher espécie felina e seus atributos." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUCHIYOSE — Tartaruga (Mensageira)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kuchiyose_messenjaa_kame", name: "Kuchiyose: Messenjaa Kame",     typeKey: "kuchiyose_tartarugas", jutsuRank: "D", chakraCost: 10, description: "Invoca a tartaruga-mensageira: viaja longas distâncias e sinaliza socorro queimando a palavra 'S.O.S.' para alertar aliados. Aparece na 4ª Grande Guerra." },

  // ═══════════════════════════════════════════════════════════════════════
  // JUJUTSU — Técnicas de Maldição (Hidan e Kakuzu)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "jujutsu_shiji_hyouketsu",  name: "Jujutsu: Shiji Hyōketsu",      typeKey: "jujutsu", jutsuRank: "A", chakraCost: 50, description: "Ritual de maldição — liga o usuário à vítima pela ingestão de sangue; qualquer dano sofrido pelo usuário espelha no alvo. Técnica baseada nas maldições de Hidan." },
  { key: "jujutsu_mugen_shiki",      name: "Jujutsu: Mugen Shiki",          typeKey: "jujutsu", jutsuRank: "S", chakraCost: 0, description: "Corpo imortal via ritual de maldição — o usuário sobrevive a traumas físicos extremos, mas membros decepados não regeneram. Exige um sacrifício por uso." },

  // ═══════════════════════════════════════════════════════════════════════
  // KUJAKU — Método Misterioso do Pavão  [CANÔNICO — Anime]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kujaku_cura",              name: "Método do Pavão: Cura",         typeKey: "kujaku", jutsuRank: "C", chakraCost: 50, description: "Concentra chakra roxo na palma para curar o alvo instantaneamente sem radiação. Técnica de Shizune/discípulos de Tsunade." },
  { key: "kujaku_base",              name: "Método Misterioso do Pavão",    typeKey: "kujaku", jutsuRank: "B", chakraCost: 75, description: "Gera aura de chakra roxo em forma de penas de pavão manipuláveis em ataques, cordas, asas ou manifestações de bestas. Técnica do anime Naruto." },
  { key: "kujaku_hipnose",           name: "Método do Pavão: Hipnose",      typeKey: "kujaku", jutsuRank: "A", chakraCost: 150, usageLimit: 1, description: "Cria esfera de energia rosa incandescente que submete o alvo à hipnose quando visto. Requer que o alvo esteja imobilizado." },
  { key: "kujaku_absorcao",          name: "Método do Pavão: Absorção",     typeKey: "kujaku", jutsuRank: "S", chakraCost: 500, usageLimit: 1, description: "A besta de chakra devora o chakra roxo do oponente para amplificar seu poder. Pode criar variante de duas cabeças afetando dois alvos." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ ORIGAMI — Técnicas de Papel (Konan)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "origami_base",             name: "Origami no Jutsu",              typeKey: "cla_origami", jutsuRank: "D", chakraCost: 30, description: "Transformação do corpo em papel — base de todas as técnicas do Clã Origami. Konan do Akatsuki usa esta habilidade." },
  { key: "origami_kami_shuriken",    name: "Kami Shuriken",                 typeKey: "cla_origami", jutsuRank: "D", chakraCost: 10, duration: "1 rodada", description: "Cria shurikens de papel com efeitos reais. Até 100 por uso." },
  { key: "origami_kami_bunshin",     name: "Kami Bunshin",                  typeKey: "cla_origami", jutsuRank: "D", chakraCost: 10, description: "Clones de papel que podem usar todas as técnicas de papel. Até 15 clones simultâneos." },
  { key: "origami_kami_kawarimi",    name: "Kami Kawarimi no Jutsu",        typeKey: "cla_origami", jutsuRank: "D", chakraCost: 10, duration: "1 rodada", usageLimit: 3, description: "Se desfaz em pedaços de papel para escapar de ataques e reaparecer em outro ponto." },
  { key: "origami_kami_no_tate",     name: "Kami no Tate",                  typeKey: "cla_origami", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 3, description: "Barreira de papel — defesa absoluta. Técnica de Konan." },
  { key: "origami_shikigami_no_mai", name: "Shikigami no Mai",              typeKey: "cla_origami", jutsuRank: "B", chakraCost: 50, description: "Dança do Papel — o usuário se transforma em fragmentos de papel, +50 dano. A técnica icônica de Konan." },
  { key: "origami_kami_no_tsubasa",  name: "Kami no Tsubasa",               typeKey: "cla_origami", jutsuRank: "B", chakraCost: 50, duration: "3 rodadas", usageLimit: 2, description: "Asas de papel — permite voo e dá +50 dano às técnicas do clã. Konan usa para voar." },
  { key: "origami_shikigami_arashi", name: "Shikigami no Mai: Arashi",      typeKey: "cla_origami", jutsuRank: "B", chakraCost: 70, duration: "1 rodada", description: "Dança do Papel: Tempestade — tornado gigante de pétalas de papel. Técnica de Konan." },
  { key: "origami_kibaku_kami",      name: "Kibaku Kami",                   typeKey: "cla_origami", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Papel Explosivo — centenas de bilhões de papéis explosivos marcados detonam em sequência. Técnica S-class de Konan usada contra Obito." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ IBURI — Técnicas de Fumaça  [CANÔNICO — Arco ANBU de Kakashi]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "iburi_kemuri",             name: "Kemuri no Jutsu",               typeKey: "cla_iburi", jutsuRank: "D", chakraCost: 30, description: "Corpo de Fumaça — o usuário pode transformar partes ou todo o corpo em fumaça. Kekkei Genkai do Clã Iburi, aparece no arco ANBU de Kakashi." },
  { key: "iburi_maengan",            name: "Maengan",                       typeKey: "cla_iburi", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", description: "Lança múltiplas esferas de fumaça negra no oponente." },
  { key: "iburi_kemuri_bunshin",     name: "Kemuri Bunshin",                typeKey: "cla_iburi", jutsuRank: "D", chakraCost: 10, description: "Clones de fumaça que explodem quando atingidos." },
  { key: "iburi_enmakugire",         name: "Enmakugire",                    typeKey: "cla_iburi", jutsuRank: "C", chakraCost: 20, duration: "3 rodadas", usageLimit: 1, description: "Prisão de Fumaça — cria um prisma de fumaça onde o usuário pode desaparecer." },
  { key: "iburi_enryuu",             name: "Enryuu",                        typeKey: "cla_iburi", jutsuRank: "B", chakraCost: 60, duration: "1 rodada", description: "Dragão de Fumaça — cria um poderoso dragão de fumaça para atacar." },
  { key: "iburi_kemuri_henge",       name: "Kemuri ni Henkan",              typeKey: "cla_iburi", jutsuRank: "A", chakraCost: 100, duration: "1 rodada", usageLimit: 1, description: "Transformação em Fumaça — o usuário se torna intangível e imune a ataques físicos. A técnica limite do Clã Iburi." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ KURAMA — Genjutsu Extremo  [CANÔNICO — Filler Naruto]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kurama_gen_estilo",        name: "Gen: Kurama Sutairu",           typeKey: "cla_kurama", jutsuRank: "C", chakraCost: 30, description: "Estilo Genjutsu Kurama — amplifica a aptidão para ilusões e manipula a percepção da realidade. Base do Clã Kurama (Yakumo)." },
  { key: "kurama_an_no_gen",         name: "An no Genjutsu",                typeKey: "cla_kurama", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Aprisiona o oponente numa vagem ilusória; causa cegueira e imobilização. Técnica do Clã Kurama." },
  { key: "kurama_ta_an_no_gen",      name: "Ta An no Genjutsu",             typeKey: "cla_kurama", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Múltiplas vagens ilusórias aprisionam o oponente simultaneamente." },
  { key: "kurama_dai_moku",          name: "Kurama Magen: Dai Moku",        typeKey: "cla_kurama", jutsuRank: "A", chakraCost: 100, duration: "3 rodadas", usageLimit: 1, description: "Aprisiona o oponente em floresta ilusória; o usuário pode se mover pelas árvores livremente." },
  { key: "kurama_idou_no_kaibutsu",  name: "Idou no Kaibutsu",              typeKey: "cla_kurama", jutsuRank: "S", chakraCost: 500, duration: "3 rodadas", usageLimit: 1, description: "Manifesta uma criatura ilusória que distorce a realidade — a técnica proibida do Clã Kurama que distorce toda a percepção do campo de batalha." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ SOMA NO KO — Técnicas Siamesas (Sakon e Ukon)  [CANÔNICO]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "soma_no_ko_despertar",     name: "Ninpou: Despertar do Gêmeo Siamês", typeKey: "cla_soma_no_ko", jutsuRank: "C", chakraCost: 30, description: "Desperta o irmão gêmeo siamês — o segundo corpo emerge do primeiro, aumentando força, agilidade e resistência. Técnica de Sakon e Ukon (Sound 4)." },
  { key: "soma_no_ko_libertacao",    name: "Ninpou: Libertação do Gêmeo Siamês", typeKey: "cla_soma_no_ko", jutsuRank: "B", chakraCost: 70, description: "Libera o irmão completamente — permite 4 jutsus por turno. Forma de combate plena de Sakon/Ukon." },
  { key: "soma_no_ko_tarenken",      name: "Tarenken",                      typeKey: "cla_soma_no_ko", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 2, description: "Múltiplos Punhos Conectados — golpe triplo de dano devastador pelos dois corpos." },
  { key: "soma_no_ko_tarensenpuu",   name: "Tarensenpū",                    typeKey: "cla_soma_no_ko", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 1, description: "Múltiplos Redemoinhos Conectados — rotação em espiral dos dois corpos criando defesa absoluta." },
  { key: "soma_no_ko_kisei_kikai",   name: "Kisei Kikai no Jutsu",          typeKey: "cla_soma_no_ko", jutsuRank: "S", chakraCost: 300, duration: "2 rodadas", usageLimit: 1, description: "Fusão Parasitária — os dois corpos se fundem no oponente; 1ª rodada drena metade do HP/Chakra, 2ª rodada é fatal. Técnica proibida de Sakon/Ukon." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ KAZAMA — Manipulação de Chakra  [RPG — Pedido do servidor]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kazama_karasugan",         name: "Karasugan",                     typeKey: "cla_kazama", jutsuRank: "D", chakraCost: 10, description: "Dojutsu do Clã Kazama — detecta e absorve chakra corrupto do oponente." },
  { key: "kazama_manipulacao_1",     name: "Manipulação de Chakra Kazama — Nível 1", typeKey: "cla_kazama", jutsuRank: "D", chakraCost: 5, duration: "3 rodadas", usageLimit: 1, description: "Materializa pequenos objetos de chakra para uso em combate." },
  { key: "kazama_barreira",          name: "Barreira Kazama",               typeKey: "cla_kazama", jutsuRank: "C", chakraCost: 25, usageLimit: 1, description: "Barreira de chakra denso que bloqueia ataques físicos e elementais." },
  { key: "kazama_manipulacao_2",     name: "Manipulação de Chakra Kazama — Nível 2", typeKey: "cla_kazama", jutsuRank: "C", chakraCost: 15, duration: "3 rodadas", usageLimit: 1, description: "Cria objetos de complexidade moderada a partir de chakra concentrado." },
  { key: "kazama_manipulacao_3",     name: "Manipulação de Chakra Kazama — Nível 3", typeKey: "cla_kazama", jutsuRank: "A", chakraCost: 35, duration: "3 rodadas", usageLimit: 1, description: "Materializa construções complexas e armas de chakra puro de alto poder destrutivo." },
  { key: "kazama_esferas_destruicao", name: "Esferas de Destruição Kazama", typeKey: "cla_kazama", jutsuRank: "S", chakraCost: 200, duration: "2 rodadas", usageLimit: 2, description: "Esferas de chakra puro que escalam em poder conforme o chakra investido. Técnica máxima do Clã Kazama." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ SARUTOBI — Domínio dos Cinco Elementos  [CANÔNICO]
  // Techniques scattered across elements; clan bonus: all 5 natures + half chakra cost on elementals
  // Sarutobi members: Hiruzen (3rd Hokage), Asuma, Konohamaru — techniques already in other categories
  // Adding clan-exclusive entries based on canonical knowledge
  // ═══════════════════════════════════════════════════════════════════════
  { key: "sarutobi_cinco_elementos", name: "Cinco Elementos: Domínio Total", typeKey: "cla_sarutobi", jutsuRank: "A", chakraCost: 0, description: "Habilidade inata do Clã Sarutobi: domínio de todas as cinco naturezas de chakra simultaneamente. Hiruzen Sarutobi, o Terceiro Hokage, era chamado de 'Deus dos Shinobi' por esta habilidade." },
  { key: "sarutobi_saru_no_ken",     name: "Saru no Ken",                   typeKey: "cla_sarutobi", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Estilo de Combate do Macaco — técnica de taijutsu dos Sarutobi que imita os movimentos ágeis e imprevisíveis dos macacos. Usada em conjunto com Enma." },
  { key: "sarutobi_katon_goryu",     name: "Katon: Gouka Mekkyaku — Sarutobi", typeKey: "cla_sarutobi", jutsuRank: "S", chakraCost: 300, duration: "1 rodada", usageLimit: 1, description: "Grande Aniquilação — versão do Clã Sarutobi da técnica de fogo suprema. Hiruzen usou contra Orochimaru durante o Ataque a Konoha." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ OTENKI — Manipulação do Clima  [RPG — Pedido do servidor]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "otenki_base",              name: "Manipulação do Tempo",          typeKey: "cla_otenki", jutsuRank: "D", chakraCost: 20, description: "Kekkei Genkai do Clã Otenki: controla o clima ao redor conforme a emoção do usuário — chuva, neve ou relâmpago independentemente do tempo real." },
  { key: "otenki_chuva",             name: "Otenki: Chuva",                 typeKey: "cla_otenki", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Chuva que drena 40% do chakra do oponente e causa efeito de melancolia." },
  { key: "otenki_neve",              name: "Otenki: Neve",                  typeKey: "cla_otenki", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Nevasca que pode congelar e imobilizar o alvo." },
  { key: "otenki_trovao",            name: "Otenki: Trovão",                typeKey: "cla_otenki", jutsuRank: "B", chakraCost: 20, duration: "1 rodada", description: "Relâmpago roxo de rastreamento automático. Capacidade de incapacitação instantânea." },

  // ═══════════════════════════════════════════════════════════════════════
  // CLÃ KAMIZURUI — Técnicas de Abelhas  [SEMI-CANÔNICO — Anime]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "kamizurui_hachi",          name: "Kuchiyose: Hachi",              typeKey: "cla_kamizurui", jutsuRank: "D", chakraCost: 50, description: "Invoca abelhas controláveis para ataque e defesa. Técnica básica do Clã Kamizurui." },
  { key: "kamizurui_hachimitsu_bunshin", name: "Kuchiyose: Hachimitsu no Bunshin", typeKey: "cla_kamizurui", jutsuRank: "D", chakraCost: 25, duration: "1 rodada", description: "Clones de mel que se dissolvem em mel grudento quando destruídos, prendendo o oponente." },
  { key: "kamizurui_hachimitsu",     name: "Hachimitsu no Jutsu",           typeKey: "cla_kamizurui", jutsuRank: "C", chakraCost: 35, duration: "1 rodada", usageLimit: 3, description: "Abelhas que imobilizam via cobertura de mel pegajoso." },
  { key: "kamizurui_subako",         name: "Subako (Colmeia)",              typeKey: "cla_kamizurui", jutsuRank: "C", chakraCost: 30, duration: "1 rodada", usageLimit: 2, description: "Colmeia de pedra contendo larvas que drenam chakra do oponente." },
  { key: "kamizurui_hachi_senbon",   name: "Hachi Senbon no Jutsu",         typeKey: "cla_kamizurui", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Mil Ferrões — chuva de ferrões de abelha que causa dano e reduz a resistência do oponente por 3 rodadas." },

  // ═══════════════════════════════════════════════════════════════════════
  // JIBAKUJUTSU — Técnicas de Kanji Escrito  [RPG — Pedido do servidor]
  // ═══════════════════════════════════════════════════════════════════════
  { key: "jibaku_base",              name: "Jibakujutsu",                   typeKey: "cla_jibakujutsu", jutsuRank: "D", chakraCost: 20, description: "Técnica base — escreve kanji no ar com chakra para manifestar o significado literal do caractere." },
  { key: "jibaku_iwa",               name: "Jibakujutsu: Iwa (岩 — Pedra)", typeKey: "cla_jibakujutsu", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Kanji Pedra — imobiliza alvos ou dispersa clones." },
  { key: "jibaku_hi",                name: "Jibakujutsu: Hi (火 — Fogo)",   typeKey: "cla_jibakujutsu", jutsuRank: "D", chakraCost: 20, duration: "1 rodada", description: "Kanji Fogo — produz chamas de tamanho variável." },
  { key: "jibaku_baku",              name: "Jibakujutsu: Baku (爆 — Explosão)", typeKey: "cla_jibakujutsu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Kanji Explosão — múltiplas explosões simultâneas." },
  { key: "jibaku_en",                name: "Jibakujutsu: En (炎 — Chamas)", typeKey: "cla_jibakujutsu", jutsuRank: "C", chakraCost: 20, duration: "1 rodada", usageLimit: 1, description: "Kanji Chamas — muro de fogo como defesa absoluta." },
  { key: "jibaku_zan",               name: "Jibakujutsu: Zan (斬 — Corte)", typeKey: "cla_jibakujutsu", jutsuRank: "C", chakraCost: 40, duration: "1 rodada", description: "Kanji Corte — cria lâminas de vento cortantes." },
  { key: "jibaku_ayatsuru",          name: "Jibakujutsu: Ayatsuru (操 — Controlar)", typeKey: "cla_jibakujutsu", jutsuRank: "B", chakraCost: 50, duration: "1 rodada", usageLimit: 1, description: "Kanji Controlar — manipula as ações do oponente. Dispersível por reservas altas de chakra." },

];




