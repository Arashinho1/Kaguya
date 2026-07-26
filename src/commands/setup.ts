import { EmbedBuilder } from "discord.js";

import { defineCommand } from "../core/commands/index.js";
import type { CommandServices } from "../types/command.js";

export const setupCommand = defineCommand<[], CommandServices>({
  name: "setup",
  aliases: ["iniciar"],
  description: "Garante que este servidor está inicializado no bot.",
  access: "admin",
  async handler(ctx) {
    const rpgGuild = await ctx.services.guildConfig.ensureGuild(ctx.guild);
    const overview = await ctx.services.guildConfig.getGuildOverview(ctx.guild);

    await ctx.services.guildConfig.writeAuditLog({
      guildId: rpgGuild.id,
      actorId: ctx.user.id,
      action: "guild.setup",
      targetType: "RpgGuild",
      targetId: rpgGuild.id
    });

    const modulesText =
      Object.entries(overview.modules).length > 0
        ? Object.entries(overview.modules)
            .map(([key, enabled]) => `${enabled ? "🟢" : "🔴"} ${key}`)
            .join("\n")
        : "Nenhum módulo de jogo instalado ainda.";

    const embed = new EmbedBuilder()
      .setTitle("Servidor inicializado")
      .setDescription("As configurações estruturais deste servidor foram criadas ou já existiam.")
      .addFields(
        { name: "Prefixo", value: `\`${overview.prefix}\``, inline: true },
        { name: "Settings salvos", value: String(overview.settingsCount), inline: true },
        { name: "Módulos", value: modulesText }
      );

    await ctx.reply({ embeds: [embed] });
  }
});
