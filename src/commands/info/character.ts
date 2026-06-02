import type { PrefixCommand } from "../../types/command.js";
import { buildCharacterPanel } from "../../modules/characters/CharacterPanel.js";

export const characterCommand: PrefixCommand = {
  name: "ficha",
  aliases: ["personagem", "perfil"],
  access: "member",
  module: "characters",
  description: "Mostra ou gerencia sua ficha de personagem.",
  usage: ".ficha | .ficha @jogador",
  async execute({ message, services }) {
    const target = message.mentions.users.first() ?? message.author;

    await message.reply(await buildCharacterPanel(services, message.guild, message.author, target));
  }
};
