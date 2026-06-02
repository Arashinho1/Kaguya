# Kaguya RPG Bot

Bot de RPG Naruto feito para rodar em vários servidores com regras diferentes.

## Ideia central

O código fornece a engine. As regras variáveis ficam no banco e devem ser configuráveis pelo Discord.

Toda feature nova deve entregar:

- comando ou fluxo para jogador usar;
- painel/comando de staff para configurar;
- dados separados por servidor (`guildId`);
- log de auditoria para alterações administrativas;
- valores padrão para um servidor novo não começar vazio.

## Stack

- TypeScript
- discord.js
- PostgreSQL
- Prisma

## Primeiros passos

1. Preencha `.env` com base em `.env.example`.
2. Instale as dependências com `npm.cmd install`.
3. Gere o Prisma Client com `npm.cmd run db:generate`.
4. Rode uma migração com `npm.cmd run db:migrate`.
5. Inicie em desenvolvimento com `npm.cmd run dev`.

O prefixo padrão é `.`.

## Permissões do bot

Ative o intent de conteúdo de mensagens no portal do Discord, pois o bot usa comandos por prefixo.

## Upload na Discloud

Configure `DISCORD_TOKEN` e `DATABASE_URL` nas variáveis da aplicação na Discloud. Não coloque token ou senha em `discloud.config`.

Formato esperado da `DATABASE_URL`:

```env
DATABASE_URL=postgresql://usuario:senha@hostname-vlan:5432/database?schema=public
```

Antes do upload local, rode:

```powershell
npm.cmd run discloud:check
npm.cmd run discloud:build
```

Envie a raiz deste projeto, onde ficam `discloud.config`, `package.json` e `index.js`.

Observação: a Discloud executa `npm run build --if-present` durante a montagem. Por isso o script `build` também gera o Prisma Client antes de compilar TypeScript.
