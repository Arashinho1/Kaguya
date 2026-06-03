# Arquitetura

## Regra do projeto

Nenhuma regra variável de RPG deve ficar presa no código.

O código pode ter defaults e estruturas, mas cada servidor precisa conseguir ajustar suas regras pelo Discord. Se um módulo puder variar entre RPGs, ele precisa ter uma área de configuração.

## Separação por servidor

O banco é multi-servidor. Tudo que pertence a uma campanha ou RPG carrega referência ao servidor:

- `RpgGuild`
- `GuildSetting`
- `AttributeDefinition`
- `Clan`
- `Village`
- `RankDefinition`
- `JutsuType`
- `JutsuDefinition`
- `Character`
- `CharacterJutsu`
- `CharacterProgress`
- `JutsuUseLog`
- `CombatEncounter`
- `CombatParticipant`
- `CombatActionLog`
- `TrainingLog`
- `AuditLog`

## Contrato de cada módulo

Um módulo só é considerado completo quando tiver:

- fluxo de jogador;
- fluxo de configuração de staff;
- validação de permissão;
- persistência por servidor;
- registro em `AuditLog`;
- mensagens claras no Discord.

## Padrão de comandos

Comandos futuros devem seguir este padrão:

- Se o comando tiver uma única leitura simples, pode ser direto. Exemplos: `.ping`, `.chakra`.
- Se o comando tiver mais de uma aplicação, ele deve abrir um menu principal com embed e componentes.
- O menu principal deve ser a porta oficial; subcomandos por texto podem existir apenas como atalhos técnicos.
- Configurações devem usar modais, selects e botões em vez de exigir que a staff memorize sintaxe.
- Cada embed deve ter uma descrição curta, técnica o suficiente para orientar a staff, mas escrita para usuário final.
- Toda função que pode variar por servidor deve salvar dados por servidor e aparecer no guia quando ficar pública.
- Ao criar ou alterar comando, atualizar `.guia` e este documento no mesmo passo.

Cada comando deve declarar um nível de acesso:

- `member`: qualquer membro do servidor pode usar;
- `admin`: exige Administrador ou Gerenciar Servidor;
- `owner`: exige dono do bot ou ID definido em `BOT_OWNER_IDS`.

## Prefixo

O prefixo inicial é `.`. Ele também fica salvo por servidor para permitir ajuste futuro sem mexer no código.

## Módulo de atributos

Os atributos são configurados por servidor em `AttributeDefinition`.

Comandos atuais:

- `.atributos`: lista os atributos ativos para jogadores;
- `.atributo listar`: lista atributos para staff;
- `.atributo criar chave | Nome | base | min | max | descrição`: cria atributo por servidor;
- `.atributo editar chave campo valor`: altera nome, descrição, base, min, max ou ordem;
- `.atributo ativar chave` / `.atributo desativar chave`: controla disponibilidade;
- `.atributo remover chave confirmar`: remove a definição.

Esse módulo é a base para ficha, treino, clãs, jutsus e combate.

O comando `.atributo` sem argumentos abre um painel com embed, botões e modais para staff configurar sem decorar comandos longos.

## Módulo de configuração

O comando `.config` abre um painel com lista suspensa para configurações técnicas do servidor.

Funções atuais:

- ver resumo de configuração;
- alterar prefixo por modal;
- configurar log administrativo por modal;
- configurar log de comandos por modal.
- configurar cargos com permissão administrativa pelo painel.
- ativar ou desativar módulos do bot por servidor.
- gerenciar dados do Mundo RPG: clãs, vilas e ranks.
- ativar ou desativar módulos como treino e combate junto dos demais módulos.

O log administrativo registra funções relacionadas à configuração do bot no servidor. O log de comandos registra comandos executados por usuários naquele servidor.

Permissões administrativas usam `GuildRolePermission` com a permissão `command.admin`. Administrador e Gerenciar Servidor continuam liberados por padrão, e cargos configurados também passam a usar comandos `access: "admin"`.

Módulos usam `GuildSetting.enabledModules`. Comandos associados a um módulo desativado não executam até que a staff reative o módulo pelo `.config`.

Atalhos de texto existem para manutenção (`.config prefix .`, `.config log #canal`, `.config log-comandos #canal`, `.config permissao adicionar @cargo`, `.config modulo desativar attributes`), mas o uso oficial é pelo painel.

O comando `.servidores` lista todos os servidores em que o bot está. Por ser uma informação global da aplicação, ele é restrito ao dono do bot ou aos IDs definidos em `BOT_OWNER_IDS`.

## Mundo RPG

O painel `.config` tem uma página `Mundo RPG` para dados narrativos que variam por servidor.

Dados atuais:

- `Clan`: clãs vinculáveis à ficha. Suporta nome, descrição, limite de membros, bônus em JSON, restrições em JSON e status ativo/inativo.
- `Village`: vilas vinculáveis à ficha. Suporta nome, descrição, metadados em JSON e status ativo/inativo.
- `RankDefinition`: ranks vinculáveis à ficha. Suporta chave técnica, nome, descrição, ordem, metadados em JSON e status ativo/inativo.

O uso oficial é pelo painel com lista suspensa e modais. A ficha só aceita vínculos com registros ativos do servidor.

Os dados do Mundo RPG já aplicam efeitos básicos na ficha:

- `Clan.memberLimit` limita quantas fichas ativas podem usar o clã.
- `Clan.bonuses` aceita bônus numéricos por chave de atributo. Exemplo: `{"forca":2,"velocidade":1,"chakra":10}`.
- `Village.metadata` e `RankDefinition.metadata` aceitam bônus no campo `bonuses`. Exemplo: `{"bonuses":{"resistencia":1,"chakra":5}}`.
- `chakra` em `bonuses` é tratado como bônus direto depois da fórmula de Chakra.
- `Clan.restrictions`, `Village.metadata.restrictions` e `RankDefinition.metadata.restrictions` aceitam regras simples como `{"cla":"Uchiha"}`, `{"vila":"Konoha"}`, `{"vilas":["Konoha","Suna"]}`, `{"rank":"genin"}`, `{"ranks":["genin","chunin"]}` e `{"rank_minimo":"chunin"}`.

Ao criar, editar, reativar ou recalcular uma ficha, o bot valida essas regras e recalcula os atributos efetivos. O snapshot do bônus aplicado fica no metadata da ficha para evitar bônus duplicado em recalculos futuros.

Outros metadados livres continuam persistidos para módulos futuros consumirem de forma padronizada.

## Chakra derivado

O Chakra tem uma fórmula configurável por servidor em `GuildSetting.chakraFormula`.

Default:

```txt
floor((forca + velocidade + resistencia) * 1 * 1 + 0)
```

Campos da fórmula:

- `sourceAttributeKeys`: atributos somados, por padrão `forca`, `velocidade` e `resistencia`;
- `sourceMultiplier`: multiplicador aplicado na soma;
- `isolatedMultiplier`: multiplicador separado para bônus direto no Chakra;
- `directBonus`: bônus fixo somado diretamente no Chakra.

Comandos:

- `.chakra`: mostra a fórmula pública;
- `.atributo chakra`: mostra a configuração para staff;
- `.atributo chakra forca,velocidade,resistencia | 1 | 0 | 1`: altera atributos, multiplicador da soma, bônus direto e multiplicador isolado.

## Módulo de jutsus

O comando `.jutsu` é menu-first. Ele abre um painel público para jogadores e, quando usado por staff, exibe botões administrativos no mesmo painel.

Dados atuais:

- `JutsuType`: tipo/categoria do jutsu, criado por defaults do `.setup`.
- `JutsuDefinition`: catálogo de jutsus do servidor, com chave técnica, nome, descrição, tipo, rank mínimo, custo de Chakra, requisitos, metadados e status ativo/inativo.
- `CharacterJutsu`: vínculo entre ficha e jutsu aprendido.
- `JutsuUseLog`: histórico de uso de jutsus, custo e Chakra antes/depois.

Fluxo do jogador:

- ver catálogo ativo;
- ver jutsus aprendidos pela ficha ativa;
- aprender um jutsu informando nome ou chave;
- usar um jutsu aprendido e consumir o Chakra atual da ficha.

Fluxo da staff:

- criar jutsu;
- editar nome, tipo, rank mínimo, custo e status;
- configurar requisitos e metadados em JSON;
- ajustar Chakra atual de uma ficha ativa (`full`, `+10`, `-5` ou valor fixo).

Requisitos aceitos em `JutsuDefinition.requirements`:

```json
{
  "atributos": { "ninjutsu": 5 },
  "jutsus": ["raiton_basico"]
}
```

O campo `requiredRankId` valida rank mínimo pela ordem do rank. O campo `chakraCost` não é cobrado ao aprender, mas é consumido ao usar o jutsu aprendido.

## Módulo de combate

O comando `.combate` é direto por padrão. O objetivo do módulo é interferir pouco na cena: jogadores escrevem ações narrativas normalmente, o bot registra jutsus entre colchetes e só responde quando chamado por comando ou quando um turno é finalizado.

Dados atuais:

- `CombatEncounter`: cena de combate do canal, status, rodada e metadata de encerramento da rodada.
- `CombatParticipant`: vínculo entre cena e ficha participante, com iniciativa e usuário.
- `CombatActionLog`: histórico da cena, incluindo uso de jutsu dentro do turno.

Fluxo do jogador:

- iniciar combate direto com `.combate @jogador`, desde que as duas fichas estejam no mesmo local;
- entrar em um combate ativo com `.entrar`, também respeitando o local;
- escrever ações narrativas usando `[nome do jutsu]` para consumir Chakra e registrar técnica usada;
- finalizar a própria ação com `.turno`, recebendo um status mínimo de Chakra.

Fluxo da staff:

- usar `.combate painel` como visão opcional de diagnóstico;
- usar permissões futuras para encerrar/remover participantes quando o controle narrativo exigir.

O bot não decide a ordem de ação. Cada jogador/narrador decide a sequência naturalmente e usa `.turno` para marcar que terminou. Quando todos os participantes finalizam, o bot avança a rodada e mostra uma atualização curta.

O "mesmo local" usa, nesta versão, a vila vinculada à ficha ou campos livres no metadata da ficha (`locationId`, `location`, `local`, `localizacao`, `localização`) quando existirem.

Esta primeira versão não calcula dano, HP, defesa ou acerto automaticamente. Ela organiza o estado da cena e já integra uso de jutsu com consumo de Chakra atual. Regras de dano, vida e efeitos devem entrar em uma camada futura e configurável por servidor.

## Módulo de treino

O comando `.treino` é menu-first. Ele abre um painel público para jogadores e, quando usado por staff, exibe botões administrativos no mesmo painel.

Dados atuais:

- `CharacterProgress`: saldo de pontos de treino, Chakra atual, experiência futura e metadados da ficha.
- `TrainingLog`: histórico de pontos concedidos e atributos evoluídos.
- `GuildSetting.trainingConfig`: custo base, custo por valor atual e limite de evolução por ação.

Fluxo do jogador:

- ver pontos disponíveis;
- ver atributos base e atributos efetivos;
- gastar pontos para evoluir um atributo ativo.

Fluxo da staff:

- conceder ou remover pontos de treino de uma ficha ativa;
- configurar custo base, custo por valor atual e máximo de pontos evoluídos por ação.

O treino altera o valor base da ficha. Depois disso, o bot recalcula os atributos efetivos, aplica bônus de clã/vila/rank e recalcula Chakra pela fórmula do servidor. `chakra` não pode ser treinado diretamente.

Default de custo:

```txt
custo = max(1, ceil(soma_por_ponto(custo_base + valor_atual * custo_por_valor_atual)))
```

Com a configuração inicial, cada ponto de atributo custa 1 ponto de treino e o jogador pode evoluir até 5 pontos por ação.

## Módulo de ficha

O comando `.ficha` é menu-first. Se o jogador ainda não tiver ficha, o bot mostra um painel com botão para criar. A criação acontece por modal.

A ficha salva:

- nome do personagem;
- conceito curto;
- imagem por URL;
- vínculo com clã;
- vínculo com vila;
- vínculo com rank;
- snapshot dos atributos ativos do servidor;
- Chakra derivado pela fórmula configurada;
- bônus do Mundo RPG aplicados aos atributos efetivos;
- jutsus aprendidos vinculados por `CharacterJutsu`;
- usos de jutsu registrados por `JutsuUseLog`;
- participação em cenas por `CombatParticipant`;
- progresso vinculado por `CharacterProgress`;
- status ativo/inativo.

Clã, vila e rank são vínculos reais com `Clan`, `Village` e `RankDefinition`. O jogador pode editar os vínculos pelo modal da ficha usando nome, chave ou ID quando aplicável. Uma ficha inativa pode ser reativada pelo painel do próprio jogador, desde que ainda respeite as regras do clã configurado.

Comandos atuais:

- `.ficha`: mostra sua ficha ou abre o painel de criação;
- `.ficha @jogador`: mostra a ficha ativa de outro jogador;
- `.personagem` / `.perfil`: aliases públicos.

Os atributos salvos na ficha representam o valor efetivo atual. Para evitar duplicidade de bônus, o metadata guarda o snapshot de bônus do Mundo RPG; sistemas como treino consultam o valor base, ajustam esse valor e pedem ao serviço de ficha para recalcular o efetivo.

## Guia de comandos

O comando `.guia` abre um painel de ajuda com lista suspensa por categoria.

Aliases:

- `.ajuda`
- `.help`
- `.comandos`

O guia mostra comandos de jogador e staff com descrições curtas. Sempre que novos comandos forem criados, o guia deve ser atualizado no mesmo passo.
