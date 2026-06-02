import type { PrefixCommand } from "../../types/command.js";
import { buildHelpPanel } from "../../modules/help/HelpPanel.js";

export const helpCommand: PrefixCommand = {
  name: "guia",
  aliases: ["ajuda", "help", "comandos"],
  description: "Mostra um menu com os comandos do bot.",
  usage: ".guia",
  async execute({ message, prefix }) {
    await message.reply(buildHelpPanel(prefix));
  }
};
