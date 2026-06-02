# Kaguya RPG Bot

Bot de RPG Naruto feito para rodar em varios servidores com regras diferentes.

## Ideia central

O codigo fornece a engine. As regras variaveis ficam no banco e devem ser configuraveis pelo Discord.

Toda feature nova deve entregar:

- comando ou fluxo para jogador usar;
- painel/comando de staff para configurar;
- dados separados por servidor (`guildId`);
- log de auditoria para alteracoes administrativas;
- valores padrao para um servidor novo nao comecar vazio.

## Stack

- TypeScript
- discord.js
- PostgreSQL
- Prisma

## Primeiros passos

1. Preencha `.env` com base em `.env.example`.
2. Instale as dependencias com `npm.cmd install`.
3. Gere o Prisma Client com `npm.cmd run db:generate`.
4. Rode uma migracao com `npm.cmd run db:migrate`.
5. Inicie em desenvolvimento com `npm.cmd run dev`.

O prefixo padrao e `.`.

## Permissoes do bot

Ative o intent de conteudo de mensagens no portal do Discord, pois o bot usa comandos por prefixo.

## Upload na Discloud

Configure `DISCORD_TOKEN` e `DATABASE_URL` nas variaveis da aplicacao na Discloud. Nao coloque token ou senha em `discloud.config`.

Antes do upload local, rode:

```powershell
npm.cmd run discloud:check
npm.cmd run discloud:build
```

Envie a raiz deste projeto, onde ficam `discloud.config`, `package.json` e `index.js`.

Observacao: a Discloud executa `npm run build --if-present` durante a montagem. Por isso o script `build` tambem gera o Prisma Client antes de compilar TypeScript.
