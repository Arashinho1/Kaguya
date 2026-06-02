import { EmbedBuilder } from "discord.js";

import { formatChakraFormula } from "../../modules/attributes/AttributeService.js";
import type { PrefixCommand } from "../../types/command.js";

function formatRange(minValue: number, maxValue: number | null): string {
  return maxValue === null ? `${minValue}+` : `${minValue}-${maxValue}`;
}

export const attributesCommand: PrefixCommand = {
  name: "atributos",
  aliases: ["attrs"],
  description: "Mostra os atributos configurados neste RPG.",
  usage: ".atributos",
  async execute({ message, services, prefix }) {
    const [attributes, chakraFormula] = await Promise.all([
      services.attributes.listAttributes(message.guild),
      services.attributes.getChakraFormula(message.guild)
    ]);

    if (attributes.length === 0) {
      await message.reply(`Nenhum atributo ativo foi configurado. Staff pode usar \`${prefix}setup\`.`);
      return;
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2f855a)
          .setTitle("Atributos do RPG")
          .setDescription(
            attributes
              .map((attribute) => {
                const description = attribute.description ? `\n${attribute.description}` : "";
                return `**${attribute.name}** \`[${attribute.key}]\`\nBase: ${attribute.baseValue} | Faixa: ${formatRange(attribute.minValue, attribute.maxValue)}${description}`;
              })
              .join("\n\n")
          )
          .addFields({ name: "Fórmula de Chakra", value: `\`${formatChakraFormula(chakraFormula)}\`` })
      ]
    });
  }
};
