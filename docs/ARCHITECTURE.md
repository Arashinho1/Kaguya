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
- `Character`
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
- configurar canal de logs por modal.

Atalhos de texto existem para manutenção (`.config prefix .`, `.config log #canal`), mas o uso oficial é pelo painel.

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

## Módulo de ficha

O comando `.ficha` é menu-first. Se o jogador ainda não tiver ficha, o bot mostra um painel com botão para criar. A criação acontece por modal.

A ficha inicial salva:

- nome do personagem;
- conceito curto;
- imagem por URL;
- snapshot dos atributos ativos do servidor;
- Chakra derivado pela fórmula configurada.

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
