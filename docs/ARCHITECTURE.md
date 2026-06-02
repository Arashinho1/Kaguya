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
