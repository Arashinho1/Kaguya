import { EmbedBuilder } from "discord.js";

import { formatChakraFormula } from "../../modules/attributes/AttributeService.js";
import type { PrefixCommand } from "../../types/command.js";

export const chakraCommand: PrefixCommand = {
  name: "chakra",
  description: "Mostra como o Chakra é calculado neste servidor.",
  usage: ".chakra",
  async execute({ message, services }) {
    const formula = await services.attributes.getChakraFormula(message.guild);

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x805ad5)
          .setTitle("Fórmula de Chakra")
          .setDescription(`\`${formatChakraFormula(formula)}\``)
          .addFields(
            {
              name: "Atributos somados",
              value: formula.sourceAttributeKeys.map((key) => `\`${key}\``).join(", ")
            },
            { name: "Multiplicador da soma", value: String(formula.sourceMultiplier), inline: true },
            { name: "Multiplicador isolado", value: String(formula.isolatedMultiplier), inline: true },
            { name: "Bônus direto", value: String(formula.directBonus), inline: true }
          )
      ]
    });
  }
};
