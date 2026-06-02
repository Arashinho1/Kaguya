import { EmbedBuilder } from "discord.js";

import { buildAttributePanel } from "../../modules/attributes/AttributePanel.js";
import { formatChakraFormula } from "../../modules/attributes/AttributeService.js";
import { sendStaffLog } from "../../services/staffLog.js";
import type { PrefixCommand } from "../../types/command.js";
import {
  normalizeKey,
  parseDecimal,
  parseInteger,
  parseOptionalInteger,
  splitPipeArgs
} from "../../utils/text.js";

function usage(prefix: string): string {
  return [
    `\`${prefix}atributo listar\``,
    `\`${prefix}atributo criar chave | Nome | base | min | max | descrição\``,
    `\`${prefix}atributo editar chave campo valor\``,
    `\`${prefix}atributo ativar chave\``,
    `\`${prefix}atributo desativar chave\``,
    `\`${prefix}atributo remover chave confirmar\``,
    `\`${prefix}atributo chakra forca,velocidade,resistencia | 1 | 0 | 1\``
  ].join("\n");
}

function renderMax(maxValue: number | null): string {
  return maxValue === null ? "sem limite" : String(maxValue);
}

export const attributeCommand: PrefixCommand = {
  name: "atributo",
  aliases: ["attr"],
  access: "admin",
  description: "Configura atributos do RPG neste servidor.",
  usage: ".atributo | .atributo criar forca | Força | 0 | 0 | 100",
  async execute({ message, args, prefix, services }) {
    const subcommand = args.shift()?.toLowerCase();

    if (!subcommand || ["painel", "menu"].includes(subcommand)) {
      await message.reply(await buildAttributePanel(services, message.guild, prefix));
      return;
    }

    if (["ajuda", "help"].includes(subcommand)) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2b6cb0)
            .setTitle("Configuração de atributos")
            .setDescription(usage(prefix))
        ]
      });
      return;
    }

    if (subcommand === "chakra") {
      if (args.length === 0) {
        const formula = await services.attributes.getChakraFormula(message.guild);

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x805ad5)
              .setTitle("Fórmula de Chakra")
              .setDescription(`\`${formatChakraFormula(formula)}\``)
              .addFields({
                name: "Como configurar",
                value: `\`${prefix}atributo chakra forca,velocidade,resistencia | 1 | 0 | 1\``
              })
          ]
        });
        return;
      }

      const parts = splitPipeArgs(args.join(" "));
      const sourceAttributeKeys = (parts[0] ?? "")
        .split(",")
        .map((key) => normalizeKey(key))
        .filter((key): key is string => Boolean(key));
      const sourceMultiplier = parseDecimal(parts[1]);
      const directBonus = parseDecimal(parts[2]);
      const isolatedMultiplier = parseDecimal(parts[3]);

      if (
        sourceAttributeKeys.length === 0 ||
        sourceMultiplier === null ||
        directBonus === null ||
        isolatedMultiplier === null
      ) {
        await message.reply(
          `Use \`${prefix}atributo chakra forca,velocidade,resistencia | 1 | 0 | 1\`. Ordem: atributos | multiplicador da soma | bônus direto | multiplicador isolado.`
        );
        return;
      }

      const formula = await services.attributes.setChakraFormula(message.guild, message.author.id, {
        sourceAttributeKeys,
        sourceMultiplier,
        directBonus,
        isolatedMultiplier
      });

      await sendStaffLog(message, services, {
        title: "Fórmula de chakra atualizada",
        description: `Nova fórmula: \`${formatChakraFormula(formula)}\`.`
      });
      await message.reply(`Fórmula de chakra atualizada: \`${formatChakraFormula(formula)}\`.`);
      return;
    }

    if (["listar", "lista", "ver"].includes(subcommand)) {
      const includeInactive = args.includes("--todos") || args.includes("todos");
      const attributes = await services.attributes.listAttributes(message.guild, { includeInactive });

      if (attributes.length === 0) {
        await message.reply(`Nenhum atributo configurado. Use \`${prefix}atributo criar chakra | Chakra | 0 | 0 | 100\`.`);
        return;
      }

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2f855a)
            .setTitle(includeInactive ? "Todos os atributos" : "Atributos ativos")
            .setDescription(
              attributes
                .map(
                  (attribute) =>
                    `**${attribute.name}** \`[${attribute.key}]\` ${attribute.isActive ? "" : "(inativo)"}\nBase: ${attribute.baseValue} | Min: ${attribute.minValue} | Max: ${renderMax(attribute.maxValue)} | Ordem: ${attribute.sortOrder}`
                )
                .join("\n\n")
            )
        ]
      });
      return;
    }

    if (subcommand === "criar") {
      const parts = splitPipeArgs(args.join(" "));
      const key = normalizeKey(parts[0] ?? "");
      const name = parts[1]?.trim();
      const baseValue = parseInteger(parts[2]) ?? 0;
      const minValue = parseInteger(parts[3]) ?? 0;
      const maxValue = parseOptionalInteger(parts[4]);
      const description = parts[5]?.trim();

      if (!key || !name || maxValue === undefined) {
        await message.reply(`Use ${usage(prefix)}`);
        return;
      }

      if (maxValue !== null && maxValue < minValue) {
        await message.reply("O valor máximo não pode ser menor que o mínimo.");
        return;
      }

      const existing = await services.attributes.findAttribute(message.guild, key);

      if (existing) {
        await message.reply(`Já existe um atributo com a chave \`${key}\`.`);
        return;
      }

      const created = await services.attributes.createAttribute(message.guild, message.author.id, {
        key,
        name,
        baseValue,
        minValue,
        maxValue,
        description
      });

      await sendStaffLog(message, services, {
        title: "Atributo criado",
        description: `Criado **${created.name}** \`[${created.key}]\`.`
      });
      await message.reply(`Atributo **${created.name}** criado com a chave \`${created.key}\`.`);
      return;
    }

    if (subcommand === "editar") {
      const key = normalizeKey(args.shift() ?? "");
      const field = args.shift()?.toLowerCase();
      const value = args.join(" ").trim();

      if (!key || !field || !value) {
        await message.reply(`Use \`${prefix}atributo editar chave campo valor\`.`);
        return;
      }

      const update = (() => {
        if (["nome", "name"].includes(field)) {
          return { name: value };
        }

        if (["descricao", "descrição", "desc"].includes(field)) {
          return { description: ["-", "limpar", "null"].includes(value.toLowerCase()) ? null : value };
        }

        if (["base", "valor_base"].includes(field)) {
          const parsed = parseInteger(value);
          return parsed === null ? null : { baseValue: parsed };
        }

        if (["min", "minimo", "mínimo"].includes(field)) {
          const parsed = parseInteger(value);
          return parsed === null ? null : { minValue: parsed };
        }

        if (["max", "maximo", "máximo"].includes(field)) {
          const parsed = parseOptionalInteger(value);
          return parsed === undefined ? null : { maxValue: parsed };
        }

        if (["ordem", "order", "sort"].includes(field)) {
          const parsed = parseInteger(value);
          return parsed === null ? null : { sortOrder: parsed };
        }

        return undefined;
      })();

      if (update === undefined) {
        await message.reply("Campo desconhecido. Campos: nome, descrição, base, min, max, ordem.");
        return;
      }

      if (update === null) {
        await message.reply("Valor inválido para esse campo.");
        return;
      }

      const updated = await services.attributes.updateAttribute(message.guild, message.author.id, key, update);

      if (!updated) {
        await message.reply(`Não encontrei atributo com chave \`${key}\`.`);
        return;
      }

      await sendStaffLog(message, services, {
        title: "Atributo editado",
        description: `Editado **${updated.name}** \`[${updated.key}]\`.`
      });
      await message.reply(`Atributo \`${updated.key}\` atualizado.`);
      return;
    }

    if (["ativar", "desativar"].includes(subcommand)) {
      const key = normalizeKey(args[0] ?? "");

      if (!key) {
        await message.reply(`Use \`${prefix}atributo ${subcommand} chave\`.`);
        return;
      }

      const updated = await services.attributes.setAttributeActive(
        message.guild,
        message.author.id,
        key,
        subcommand === "ativar"
      );

      if (!updated) {
        await message.reply(`Não encontrei atributo com chave \`${key}\`.`);
        return;
      }

      await sendStaffLog(message, services, {
        title: subcommand === "ativar" ? "Atributo ativado" : "Atributo desativado",
        description: `**${updated.name}** \`[${updated.key}]\`.`
      });
      await message.reply(`Atributo \`${updated.key}\` ${subcommand === "ativar" ? "ativado" : "desativado"}.`);
      return;
    }

    if (subcommand === "remover") {
      const key = normalizeKey(args[0] ?? "");
      const confirmed = args[1]?.toLowerCase() === "confirmar";

      if (!key || !confirmed) {
        await message.reply(`Use \`${prefix}atributo remover chave confirmar\`.`);
        return;
      }

      const deleted = await services.attributes.deleteAttribute(message.guild, message.author.id, key);

      if (!deleted) {
        await message.reply(`Não encontrei atributo com chave \`${key}\`.`);
        return;
      }

      await sendStaffLog(message, services, {
        title: "Atributo removido",
        description: `Removido **${deleted.name}** \`[${deleted.key}]\`.`
      });
      await message.reply(`Atributo \`${deleted.key}\` removido.`);
      return;
    }

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xc53030)
          .setTitle("Subcomando desconhecido")
          .setDescription(usage(prefix))
      ]
    });
  }
};
