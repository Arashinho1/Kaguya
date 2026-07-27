import { defineCommand, type ArgDef } from "../core/commands/index.js";
import { buildSetarHubView } from "./scopeMenu.js";
import type { CommandServices } from "../types/command.js";

const noArgs = [] as const satisfies readonly ArgDef[];

/**
 * Comando único pra configurar onde Duelo, [jutsu] narrado e Meditar funcionam — sem
 * módulo próprio (nunca pode ficar bloqueado por um módulo desativado, já que é o
 * próprio painel de configuração). Acesso de admin é reconferido a cada clique dentro
 * do menu (ver scopeMenu.ts), já que a mensagem em si fica visível pra qualquer um.
 */
export const setarCommand = defineCommand<typeof noArgs, CommandServices>({
  name: "setar",
  description: "Configura onde Duelo, [jutsu] narrado e Meditar funcionam (categoria/canal/fórum/thread).",
  access: "admin",
  args: noArgs,
  async handler(ctx) {
    await ctx.reply(buildSetarHubView());
  }
});
