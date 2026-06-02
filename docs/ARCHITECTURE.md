# Arquitetura

## Regra do projeto

Nenhuma regra variavel de RPG deve ficar presa no codigo.

O codigo pode ter defaults e estruturas, mas cada servidor precisa conseguir ajustar suas regras pelo Discord. Se um modulo puder variar entre RPGs, ele precisa ter uma area de configuracao.

## Separacao por servidor

O banco e multi-servidor. Tudo que pertence a uma campanha ou RPG carrega referencia ao servidor:

- `RpgGuild`
- `GuildSetting`
- `AttributeDefinition`
- `Clan`
- `Village`
- `RankDefinition`
- `JutsuType`
- `Character`
- `AuditLog`

## Contrato de cada modulo

Um modulo so e considerado completo quando tiver:

- fluxo de jogador;
- fluxo de configuracao de staff;
- validacao de permissao;
- persistencia por servidor;
- registro em `AuditLog`;
- mensagens claras no Discord.

## Padrao de comandos

Comandos futuros devem seguir este padrao:

- Se o comando tiver uma unica leitura simples, pode ser direto. Exemplos: `.ping`, `.chakra`.
- Se o comando tiver mais de uma aplicacao, ele deve abrir um menu principal com embed e componentes.
- O menu principal deve ser a porta oficial; subcomandos por texto podem existir apenas como atalhos tecnicos.
- Configuracoes devem usar modais, selects e botoes em vez de exigir que a staff memorize sintaxe.
- Cada embed deve ter uma descricao curta, tecnica o suficiente para orientar a staff, mas escrita para usuario final.
- Toda funcao que pode variar por servidor deve salvar dados por servidor e aparecer no guia quando ficar publica.
- Ao criar ou alterar comando, atualizar `.guia` e este documento no mesmo passo.

## Prefixo

O prefixo inicial e `.`. Ele tambem fica salvo por servidor para permitir ajuste futuro sem mexer no codigo.

## Modulo de atributos

Os atributos sao configurados por servidor em `AttributeDefinition`.

Comandos atuais:

- `.atributos`: lista os atributos ativos para jogadores;
- `.atributo listar`: lista atributos para staff;
- `.atributo criar chave | Nome | base | min | max | descricao`: cria atributo por servidor;
- `.atributo editar chave campo valor`: altera nome, descricao, base, min, max ou ordem;
- `.atributo ativar chave` / `.atributo desativar chave`: controla disponibilidade;
- `.atributo remover chave confirmar`: remove a definicao.

Esse modulo e a base para ficha, treino, clas, jutsus e combate.

O comando `.atributo` sem argumentos abre um painel com embed, botoes e modais para staff configurar sem decorar comandos longos.

## Modulo de configuracao

O comando `.config` abre um painel com lista suspensa para configuracoes tecnicas do servidor.

Funcoes atuais:

- ver resumo de configuracao;
- alterar prefixo por modal;
- configurar canal de logs por modal.

Atalhos de texto existem para manutencao (`.config prefix .`, `.config log #canal`), mas o uso oficial e pelo painel.

## Chakra derivado

O Chakra tem uma formula configuravel por servidor em `GuildSetting.chakraFormula`.

Default:

```txt
floor((forca + velocidade + resistencia) * 1 * 1 + 0)
```

Campos da formula:

- `sourceAttributeKeys`: atributos somados, por padrao `forca`, `velocidade` e `resistencia`;
- `sourceMultiplier`: multiplicador aplicado na soma;
- `isolatedMultiplier`: multiplicador separado para bonus direto no Chakra;
- `directBonus`: bonus fixo somado diretamente no Chakra.

Comandos:

- `.chakra`: mostra a formula publica;
- `.atributo chakra`: mostra a configuracao para staff;
- `.atributo chakra forca,velocidade,resistencia | 1 | 0 | 1`: altera atributos, multiplicador da soma, bonus direto e multiplicador isolado.

## Modulo de ficha

O comando `.ficha` e menu-first. Se o jogador ainda nao tiver ficha, o bot mostra um painel com botao para criar. A criacao acontece por modal.

A ficha inicial salva:

- nome do personagem;
- conceito curto;
- imagem por URL;
- snapshot dos atributos ativos do servidor;
- Chakra derivado pela formula configurada.

Comandos atuais:

- `.ficha`: mostra sua ficha ou abre o painel de criacao;
- `.ficha @jogador`: mostra a ficha ativa de outro jogador;
- `.personagem` / `.perfil`: aliases publicos.

## Guia de comandos

O comando `.guia` abre um painel de ajuda com lista suspensa por categoria.

Aliases:

- `.ajuda`
- `.help`
- `.comandos`

O guia mostra comandos de jogador e staff com descricoes curtas. Sempre que novos comandos forem criados, o guia deve ser atualizado no mesmo passo.
