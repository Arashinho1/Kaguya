import { EmbedBuilder } from "discord.js";

import { sendStaffLog } from "../../services/staffLog.js";
import type { PrefixCommand } from "../../types/command.js";

const ATTR_DISPLAY: Record<string, string> = {
  forca:       "Força",
  velocidade:  "Velocidade",
  resistencia: "Resistência"
};

function parseUserId(input: string): string | null {
  const m = input?.match(/^<@!?(\d{15,25})>$/);
  if (m?.[1]) return m[1];
  return /^\d{15,25}$/.test(input) ? input : null;
}

export const paCommand: PrefixCommand = {
  name: "pa",
  aliases: [],
  access: "admin",
  description: "Gerencia PA (Pontos de Atributo) de jogadores.",
  usage: ".pa give <@jogador> <quantidade> | .pa take <@jogador> <quantidade>",
  async execute({ message, args, services }) {
    const sub = args[0]?.toLowerCase();

    if (sub !== "give" && sub !== "take") {
      await message.reply(
        "**Uso:** `.pa give <@jogador> <quantidade>` — Dar PA\n" +
        "        `.pa take <@jogador> <quantidade>` — Remover PA"
      );
      return;
    }

    const rawUser   = args[1] ?? "";
    const rawAmount = args[2] ?? "";

    const userId = parseUserId(rawUser);
    if (!userId) {
      await message.reply("Mencione um jogador válido ou informe um ID de usuário.");
      return;
    }

    const amount = parseInt(rawAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      await message.reply("A quantidade deve ser um número inteiro positivo.");
      return;
    }

    const delta = sub === "give" ? amount : -amount;

    try {
      const { characterName, newPA, reversed } = await services.characters.adjustPA(
        message.guild,
        message.author.id,
        userId,
        delta
      );

      const isGive = sub === "give";
      const color  = isGive ? 0x27AE60 : 0xE74C3C;
      const icon   = isGive ? "✅" : "🔻";

      // Linha principal
      const mainLine = isGive
        ? `**+${amount} PA** concedidos a **${characterName}** (<@${userId}>).`
        : `**${amount} PA** removidos de **${characterName}** (<@${userId}>).`;

      // Detalhes de reversão (only for take with auto-reversal)
      const reversalLines = reversed.length > 0
        ? [
            "",
            "**Atributos revertidos automaticamente:**",
            ...reversed.map(r => `• ${ATTR_DISPLAY[r.attr] ?? r.attr}: **−${r.amount}**`)
          ]
        : [];

      const description = [mainLine, `PA disponível agora: **${newPA}**`, ...reversalLines].join("\n");

      await sendStaffLog(message, services, {
        title: isGive ? "PA concedidos" : "PA removidos",
        description
      });

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(color)
            .setTitle(`${icon} ${isGive ? "PA concedidos" : "PA removidos"}`)
            .setDescription(description)
            .setFooter({ text: `Por: ${message.author.displayName}` })
            .setTimestamp()
        ]
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao ajustar PA.";
      await message.reply(msg);
    }
  }
};
