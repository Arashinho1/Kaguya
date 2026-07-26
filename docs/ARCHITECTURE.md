# Arquitetura

Este documento descreve a reconstrução do Kaguya feita a partir do zero (ver
histórico do git a partir do commit `refactor!: reconstruir fundação do bot
do zero (Fase 1)`). Se você está retomando o trabalho numa sessão nova, leia
isto antes de mexer em qualquer módulo.

## Regra do projeto

Nenhuma regra variável de RPG deve ficar presa em forma fixa no código. Isso
vale duas vezes aqui:

1. **Conteúdo** (atributos, jutsus, perícias, clãs, vilas, ranks, itens) já
   era guild-configurável na versão anterior do bot — esse padrão continua.
2. **Fórmulas** (chakra, custo de treino, custo de chakra por rank de jutsu)
   agora também são guild-configuráveis na *forma*, não só nos números. Isso
   é a diferença central desta reconstrução: antes um admin só podia ajustar
   constantes dentro de uma fórmula fixa em TypeScript; agora a fórmula em si
   é dado (`FormulaNode`, ver abaixo).

Se você está adicionando uma mecânica nova e a primeira ideia for "vou
hardcodar esse número/essa fórmula por enquanto", pare e pergunte: dá para
guardar isso como `GuildSetting` (valor simples), como bônus (`Record<string,
number>`) ou como `FormulaNode` (motor de regras)? Quase sempre dá.

## Stack

- discord.js v14, TypeScript ESM (`type: module`), Node >= 20.19.
- Prisma 7 (`generator client = "prisma-client"`, gerado em
  `src/generated/prisma`, **gitignored** — rode `npm run db:generate` depois
  de clonar) + `@prisma/adapter-pg` sobre PostgreSQL (Supabase).
- `zod` para schemas de ambiente e da fórmula.
- `@napi-rs/canvas` (ainda não usado nesta reconstrução — fichas por enquanto
  são só embed, sem geração de imagem).
- Hospedagem alvo: Discloud (ver `discloud.config`, `scripts/`).

## Camadas em `src/core`

Tudo aqui é genérico — nenhum arquivo em `src/core` sabe o que é "chakra" ou
"jutsu". Se você notar conhecimento de domínio vazando para dentro de
`src/core`, é sinal de que deveria estar em `src/modules` ou `src/commands`.

### `src/core/formula`

`FormulaNode` é uma árvore JSON (`const`, `var`, `add`, `sub`, `mul`, `div`,
`min`, `max`, `floor`, `ceil`, `abs`, `lookup`). `evaluate.ts` interpreta essa
árvore com limite de profundidade/nós (protege contra fórmula patológica
travando o processo) — **nunca** `eval`, nunca código arbitrário. `builders.ts`
tem atalhos (`f.add(...)`, `f.lookup(...)`) para montar fórmulas em código
(defaults, comandos de conveniência). `format.ts` imprime a fórmula de forma
legível para embeds.

Todo módulo que guarda uma fórmula segue o mesmo padrão: uma constante
`DEFAULT_..._FORMULA` como fallback, um par `get.../set...Formula` que lê/grava
em `GuildSetting` via `safeParseFormula`, e (quando faz sentido) um comando de
conveniência que monta a árvore a partir de campos simples (ex:
`.atributo chakra` monta uma fórmula soma-ponderada sem o admin precisar
escrever JSON à mão).

### `src/core/commands`

- `defineCommand()` — comando simples. Define nome, `args` (lista de
  `ArgDef`), `access`, `module` e um `handler(ctx)` **uma vez só**; o helper
  deriva o parser de prefixo e o `SlashCommandBuilder`/handler de interação a
  partir da mesma definição.
- `defineCommandGroup()` + `defineSubcommand()` — comando com subcomandos
  (a maioria dos comandos admin, e alguns de jogador). Suporta
  `defaultSubcommand`: no modo prefixo, `.comando` sem token extra roda esse
  subcomando (ex: `.ficha` = `.ficha ver`); no slash os subcomandos continuam
  sempre explícitos (`/ficha ver`).
- `CommandContext` unifica `Message` e `ChatInputCommandInteraction` — todo
  handler usa `ctx.guild`, `ctx.user`, `ctx.args`, `ctx.services`,
  `ctx.reply(...)` sem se importar se veio de prefixo ou slash.
- `CommandRegistry` guarda os comandos por nome/alias; `deployGlobalSlashCommands`
  registra os espelhos slash no boot (`src/index.ts`, evento `ClientReady`).

**Prefixo (`.`) é o caminho primário** — é o que os jogadores usam no dia a
dia. Slash é sempre um espelho gerado a partir da mesma definição, nunca a
fonte da verdade.

### `src/core/modules`

`registerModule({ key, name, description })` — cada módulo se registra
sozinho (efeito colateral no import do arquivo de comando). `GuildConfigService`
não mantém uma lista fixa de módulos: um módulo desconhecido é considerado
**ativo por padrão**; só overrides explícitos (`isModuleEnabled` → false)
ficam salvos. Adicionar um módulo novo não exige editar um enum central em
lugar nenhum.

### `src/core/errors`

`DomainError` — erro de regra de negócio pensado para virar mensagem amigável
no Discord. `messageCreate.ts`/`interactionCreate.ts` tratam `DomainError` de
forma especial (respondem com `error.message`); qualquer outro erro vira log
+ mensagem genérica. Cada módulo define seu próprio `XxxRuleError extends
DomainError` (`AttributeRuleError`, `CharacterRuleError`, `WorldRuleError`,
`TrainingRuleError`, `PericiaRuleError`, `JutsuRuleError`, `CombatRuleError`,
`EconomyRuleError`).

## Multi-tenant

Tudo pendura em `RpgGuild` (chave `discordId` = ID do servidor Discord).
`GuildConfigService.ensureGuild(guild)` faz upsert e é chamado no início de
quase todo método de serviço — nunca assuma que o `RpgGuild` já existe.

## Padrão de um módulo

Cada módulo em `src/modules/<nome>` normalmente tem:

- Um `XxxService.ts` com toda a lógica de negócio e acesso a Prisma. CRUD de
  definição segue sempre o mesmo formato: `list.../find.../create.../update.../delete...`,
  cada um chamando `guildConfig.writeAuditLog(...)` depois de mutar.
- Um `XxxRuleError` para violações de regra (chave duplicada, saldo
  insuficiente, etc.) — vira resposta amigável automaticamente.
- Um arquivo em `src/commands/<nome>.ts` com `registerModule(...)` no topo e
  os comandos (`defineCommand`/`defineCommandGroup`) que usam o serviço.
- Instanciação em `src/index.ts`, na ordem certa de dependência (ver comentário
  ali — `economy` antes de `characters`, por exemplo, porque `characters`
  soma bônus de item equipado).

### Leitura-então-escrita: sempre relê do banco

Se um serviço lê um valor de um objeto (`CharacterWithWorld`) passado pelo
chamador e depois escreve algo derivado desse valor, **relê do banco
imediatamente antes de calcular** em vez de confiar no objeto em mãos
(`CharacterService.getById`). Isso não é opcional — foi um bug real pego pelo
smoke test do módulo `training` (duas ações de treino em sequência sem reler
causavam lost-update). `TrainingService.trainAttribute` é o exemplo de
referência.

### Valores derivados nunca são cacheados como fonte da verdade

Chakra (calculado a partir dos atributos efetivos + fórmula) e nível de
perícia (calculado a partir do XP + curva de níveis) são sempre recalculados
na leitura, nunca confiados a partir de uma coluna "cacheada" no banco — outro
bug real pego pelo smoke test (`PericiaService.getProgressView` mostrava
nível desatualizado depois que a curva de níveis mudava). Se você guardar um
valor derivado numa coluna por performance, garanta que todo *display* recalcula
ao vivo; a coluna vira só um cache para outros fins (ex: log/auditoria).

## Módulos

### guild-config (`src/modules/guild-config`)

Fundação: `RpgGuild`, `GuildSetting` (chave/valor JSON genérico com
`get/setSetting`), `GuildRolePermission`, `AuditLog`. Não expõe um comando
próprio de configuração ainda — ver "Gaps conhecidos".

Comando: `.setup` (admin) — garante que o servidor está inicializado, sem
seedar conteúdo de jogo nenhum.

### attributes (`src/modules/attributes`)

`AttributeDefinition` por guild. Chakra é um `FormulaNode` (`GuildSetting`
`chakraFormula`), default `floor(forca + velocidade + resistencia)`.

- `.atributos` (member) — lista os atributos ativos + fórmula de chakra atual.
- `.atributo` (admin): `listar`, `criar`, `editar`, `ativar`, `desativar`,
  `remover`, `chakra` (monta a fórmula soma-ponderada clássica via
  `setWeightedSumChakraFormula`).

### characters (`src/modules/characters`)

`Character.attributes` é um snapshot JSON dos valores **base**. `getCharacterView`
mescla esse snapshot com as definições de atributo atuais do servidor
(fallback pro `baseValue` se um atributo foi criado depois da ficha), soma
bônus de clã + vila + rank + itens equipados, e calcula o chakra — tudo isso
sempre ao vivo, nada fica salvo como "efetivo".

- `.ficha` (member, `personagem`/`perfil`), default `ver`: `ver [usuario]`,
  `criar <nome>`, `vincular <cla|vila|rank> <nome>`.

Regra: um personagem ativo por usuário (não implementamos múltiplos
personagens nesta leva — era um toggle no bot antigo, ficou de fora).

### world (`src/modules/world`)

`Clan` (com `memberLimit` opcional), `Village`, `RankDefinition` — todos com
`bonuses: Record<string, number>` (offset direto por atributo, não precisa do
motor de fórmulas completo).

- `.mundo` (admin), default `listar`: `cla_criar`, `cla_remover`,
  `vila_criar`, `vila_remover`, `rank_criar`, `rank_remover`, `editar
  <cla|vila|rank> <identificador> <campo> <valor>` (campo `bonus` aceita
  `forca:2,chakra:10`).

### training (`src/modules/training`)

`CharacterProgress.trainingPoints` + `TrainingLog`. Custo de evolução é um
`FormulaNode` avaliado com a variável `atual` (valor atual do atributo antes
do treino) — default custo fixo de 1 por ponto. Limite de pontos por ação
também é configurável (default 5).

- `.treino` (member, `treinar`/`evoluir`), default `ver`: `ver`,
  `treinar <atributo> <quantidade>`.
- `.pa` (admin): `conceder <usuario> <quantidade> [motivo]`, `custo
  <custo_base> <custo_por_valor_atual>`, `limite <quantidade>`.

### pericias (`src/modules/pericias`)

`PericiaDefinition`, `CharacterPericia` (xp/level), `PericiaXpLog`. Curva de
nível é uma tabela livre `{nível: xpMínimo}` (`GuildSetting`
`periciaLevelThresholds`), não um número fixo de níveis. Nesta leva o ganho
de XP é só manual/admin (`.pericia conceder`) — o gatilho automático de "usar
jutsu dá XP" mora no módulo `jutsus`.

- `.pericias` (member, `perícia`/`perícias`) `[usuario]` — mostra progresso.
- `.pericia` (admin): `listar`, `criar`, `editar`, `ativar`, `desativar`,
  `remover`, `conceder <usuario> <chave> <quantidade> [motivo]`, `limiares
  <"1:0,2:100,..."`.

### jutsus (`src/modules/jutsus`)

Catálogo **sincronizado do site `mundo-ninja.discloud.app`** (Supabase
próprio do site, API REST pública já existente — descoberta durante esta
reconstrução, sem precisar mudar nada no site). `JutsuDefinition.externalId`
faz o upsert idempotente. `JutsuType` nasce das categorias do site que
realmente têm jutsus (hoje: Ninjutsu Elemental, Kekkei Genkai, Genjutsu).

O site **não tem custo de chakra** — isso é derivado no bot a partir do
`jutsuRank` via um `FormulaNode` do tipo `lookup` (`GuildSetting`
`jutsuChakraCostByRank`, default `D=30 C=50 B=70 A=100 S=200`). Trocar a
tabela não exige re-sincronizar.

`CharacterProgress.currentChakra` (nullable) é o chakra **atual** — distinto
do chakra **máximo** (calculado por `attributes.calculateChakra`). É
inicializado no máximo na primeira vez que o personagem usa um jutsu.

Se um `JutsuType` estiver vinculado a uma `PericiaDefinition`
(`.jutsuadmin tipopericia`), usar um jutsu desse tipo concede XP
automaticamente (`GuildSetting` `jutsuXpPerUse`, default 4).

Sync automático é opt-in por servidor (`GuildSetting`
`jutsuAutoSyncEnabled`) — `src/index.ts` roda um `setInterval`
(`JUTSU_SYNC_INTERVAL_MINUTES`, default 360) mais uma rodada 30s após o boot,
iterando `client.guilds.cache` e pulando guilds sem a opção ligada.

- `.jutsu` (member, `jutsus`/`tecnica`/`tecnicas`), default `catalogo`:
  `catalogo`, `tipo <chave>`, `ver <chave>`, `aprender <chave>`,
  `usar <chave>`, `aprendidos`.
- `.jutsuadmin` (admin): `sincronizar`, `autosync <ativo>`, `custorank <d> <c>
  <b> <a> <s>`, `xppuso <quantidade>`, `tipopericia <tipo> <pericia|->`.

### combat (`src/modules/combat`)

Escopo definido durante esta reconstrução a partir de feedback direto: é RPG
de **texto puro**, não um simulador de combate por comando. `DuelEncounter`
modela só o essencial: desafio amistoso (`PENDING` até aceitar) ou forçado
(`ACTIVE` direto), restrito a canais liberados pela staff
(`GuildSetting` `combatChannelIds`), finalizado pela staff declarando o
vencedor. **Sem HP, sem dano automático** — a luta em si acontece só na
narrativa dos jogadores.

A detecção de `[jutsu]` no chat (em `handleMessageCreate`,
`src/events/messageCreate.ts`) só age quando o autor tem um duelo **ACTIVE**
no canal, e usa `JutsuService.findJutsuFuzzy` (match parcial de nome/chave,
sem acento/case — texto livre nunca vai bater 100% com nomes longos). Sem
match nenhum, fica em silêncio (não trava a escrita); um jutsu reconhecido
mas que falhou (não aprendido, chakra insuficiente) vira uma resposta curta;
sucesso reage com 🔥.

- `.duelo` (member), default `status`: `desafiar <jogador>`, `forcar
  <jogador>`, `aceitar`, `recusar`, `status`.
- `.combateadmin` (admin): `canaladicionar <canal>`, `canalremover <canal>`,
  `canais`, `finalizar <vencedor>`.

### economy (`src/modules/economy`)

`ItemDefinition` (mesmo formato de `bonuses` que clã/vila/rank; `price`
nullable = não está à venda), `CharacterInventory` (quantidade + equipado),
`CurrencyLog`. `CharacterProgress.currency` guarda o saldo.

`EconomyService` opera só por `characterId: string`, nunca pelo
`CharacterWithWorld` inteiro — de propósito, para não criar dependência
circular (`CharacterService.getCharacterView` chama `economy.getEquippedBonuses`
de volta). Se você for adicionar um método novo aqui que "precisa" do
personagem completo, primeiro cheque se só precisa do id.

Bônus de itens equipados somam junto com clã/vila/rank em
`getCharacterView` — equipar/desequipar muda o chakra na hora, sem
recálculo manual. Recompensas automáticas (vencer duelo, subir de nível numa
perícia) ficam **desligadas por padrão** (0) — staff liga via
`.economiaadmin recompensaduelo`/`recompensapericia`.

- `.economia` (member, `banco`), default `saldo`: `saldo`, `loja`, `comprar
  <chave>`, `inventario`, `equipar <chave>`, `desequipar <chave>`.
- `.economiaadmin` (admin): `moedanome <nome>`, `itemlistar`, `itemcriar
  <chave> <nome>`, `itemeditar <chave> <campo> <valor>`, `itemativar`,
  `itemdesativar`, `itemremover`, `conceder <usuario> <quantidade> [motivo]`,
  `recompensaduelo <quantidade>`, `recompensapericia <quantidade>`.

## Gaps conhecidos (não implementados nesta reconstrução)

- **Sem `.guia`/`.ping`**: o bot antigo tinha um menu de ajuda e um
  healthcheck simples. Não foram recriados — o `CommandRegistry` já tem tudo
  que precisa (`list()`) para gerar um `.guia` automaticamente a partir das
  definições, é só não foi feito ainda.
- **Sem comando de configuração geral**: `GuildConfigService` já tem
  `setPrefix`, `setLogChannel`, `setCommandLogChannel`,
  `grantRolePermission`/`revokeRolePermission`, `setModuleEnabled` — mas
  nenhum comando expõe isso ainda. Hoje não dá para mudar o prefixo `.`, nem
  ativar/desativar um módulo, nem dar acesso admin a um cargo, sem mexer
  direto no banco.
- **Log de comando/admin não é escrito em lugar nenhum**: os campos existem
  (`logChannelId`, `commandLogChannelId`) mas nada posta neles — o serviço de
  log (`commandUsageLog`/`staffLog` do bot antigo) não foi recriado.
- **Um personagem por usuário**: sem suporte a múltiplos personagens
  (existia como toggle no bot antigo).
- **Sem geração de imagem de ficha** (`@napi-rs/canvas` é dependência mas não
  é usada ainda).
- **Perícia XP manual**: XP de perícia só é concedido automaticamente pelo
  módulo `jutsus` (uso de jutsu). Não existe outro gatilho automático ainda.

Nenhum desses é um bloqueador para rodar o bot — são só funcionalidades do
bot antigo que ficaram de fora do escopo dos 9 módulos reconstruídos. Se for
mexer numa dessas áreas, este documento já está desatualizado no ponto em que
você terminar — atualize a seção correspondente no mesmo commit.
