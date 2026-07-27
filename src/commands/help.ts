import { EmbedBuilder } from "discord.js";

import { defineCommand } from "../core/commands/index.js";
import type { ArgDef } from "../core/commands/index.js";
import { listModules } from "../core/modules/registry.js";
import type { CommandServices } from "../types/command.js";
import { commandRegistry } from "./index.js";

const GERAL_KEY = "__geral__";

const MODULE_ORDER = [
  GERAL_KEY,
  "attributes",
  "characters",
  "world",
  "training",
  "pericias",
  "jutsus",
  "combat",
  "economy"
];

const MODULE_EMOJI: Record<string, string> = {
  [GERAL_KEY]: "⚙️",
  attributes: "📊",
  characters: "📜",
  world: "🗺️",
  training: "💪",
  pericias: "🎯",
  jutsus: "🥷",
  combat: "⚔️",
  economy: "💰"
};

const MODULE_FALLBACK_EMOJI = "📦";
const EMBED_COLOR = 0xff6b1a;

const semArgs = [] as const satisfies readonly ArgDef[];

export const helpCommand = defineCommand<typeof semArgs, CommandServices>({
  name: "guia",
  aliases: ["ajuda", "help", "comandos"],
  description: "Mostra o guia de comandos do bot.",
  access: "member",
  args: semArgs,
  async handler(ctx) {
    const prefix = await ctx.services.guildConfig.getPrefix(ctx.guild);
    const modules = new Map(listModules().map((module) => [module.key, module]));
    modules.set(GERAL_KEY, { key: GERAL_KEY, name: "Geral", description: "Comandos gerais do bot." });

    const commandsByModule = new Map<string, string[]>();
    for (const command of commandRegistry.list()) {
      const moduleKey = command.module ?? GERAL_KEY;
      const lock = command.access === "member" ? "" : command.access === "admin" ? " 🔒" : " 👑";
      const aliases = command.aliases.length > 0 ? ` (${command.aliases.map((a) => `${prefix}${a}`).join(", ")})` : "";
      const line = `**\`${prefix}${command.name}\`**${lock} — ${command.description}${aliases}`;

      const bucket = commandsByModule.get(moduleKey) ?? [];
      bucket.push(line);
      commandsByModule.set(moduleKey, bucket);
    }

    const orderedKeys = [
      ...MODULE_ORDER.filter((key) => commandsByModule.has(key)),
      ...[...commandsByModule.keys()].filter((key) => !MODULE_ORDER.includes(key))
    ];

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle("📖 Guia do Kaguya")
      .setDescription(
        `Prefixo deste servidor: \`${prefix}\` — todo comando também existe como slash (\`/comando\`).\n` +
          "🔒 = precisa de Administrador/Gerenciar Servidor · 👑 = restrito ao dono do bot."
      );

    for (const key of orderedKeys) {
      const module = modules.get(key);
      const emoji = MODULE_EMOJI[key] ?? MODULE_FALLBACK_EMOJI;
      const lines = commandsByModule.get(key) ?? [];

      embed.addFields({
        name: `${emoji} ${module?.name ?? key}`,
        value: lines.join("\n")
      });
    }

    embed.setFooter({ text: "Comandos com subcomando mostram as opções se você rodar sem argumento." });

    await ctx.reply({ embeds: [embed] });
  }
});
