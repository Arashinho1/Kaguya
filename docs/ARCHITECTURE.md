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

Fluxo do jogador:

- ver catálogo ativo;
- ver jutsus aprendidos pela ficha ativa;
- aprender um jutsu informando nome ou chave.

Fluxo da staff:

- criar jutsu;
- editar nome, tipo, rank mínimo, custo e status;
- configurar requisitos e metadados em JSON.

Requisitos aceitos em `JutsuDefinition.requirements`:

```json
{
  "atributos": { "ninjutsu": 5 },
  "jutsus": ["raiton_basico"]
}
```

O campo `requiredRankId` valida rank mínimo pela ordem do rank. O campo `chakraCost` registra custo de uso do jutsu, mas nesta primeira versão não consome Chakra ao aprender.

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
- status ativo/inativo.

Clã, vila e rank são vínculos reais com `Clan`, `Village` e `RankDefinition`. O jogador pode editar os vínculos pelo modal da ficha usando nome, chave ou ID quando aplicável. Uma ficha inativa pode ser reativada pelo painel do próprio jogador, desde que ainda respeite as regras do clã configurado.

Comandos atuais:

- `.ficha`: mostra sua ficha ou abre o painel de criação;
- `.ficha @jogador`: mostra a ficha ativa de outro jogador;
- `.personagem` / `.perfil`: aliases públicos.

## Guia de comandos

O comando `.guia` abre um painel de ajuda com lista suspensa por categoria.

Aliases:

- `.ajuda`
- `.help`
- `.comandos`

O guia mostra comandos de jogador e staff com descrições curtas. Sempre que novos comandos forem criados, o guia deve ser atualizado no mesmo passo.
