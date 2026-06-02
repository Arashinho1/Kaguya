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
