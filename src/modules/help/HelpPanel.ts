import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type Interaction
} from "discord.js";

import type { CommandServices } from "../../types/command.js";

const CUSTOM_ID_PREFIX = "kaguya:help";
const HELP_SELECT_ID = `${CUSTOM_ID_PREFIX}:select`;

type HelpPage = "home" | "player" | "staff";

interface HelpCommandEntry {
  command: string;
  description: string;
  aliases?: string;
}

const PLAYER_COMMANDS: HelpCommandEntry[] = [
  {
    command: "ficha",
    description: "Painel da ficha: mostra, cria por modal, edita e recalcula atributos/Chakra.",
    aliases: "personagem, perfil"
  },
  {
    command: "atributos",
    description: "Lista os atributos ativos configurados no RPG.",
    aliases: "attrs"
  },
  {
    command: "chakra",
    description: "Mostra como o Chakra é calculado neste servidor."
  },
  {
    command: "ping",
    description: "Confirma se o bot está respondendo."
  },
  {
    command: "guia",
    description: "Abre este painel de ajuda.",
    aliases: "ajuda, help, comandos"
  }
];

const STAFF_COMMANDS: HelpCommandEntry[] = [
  {
    command: "setup",
    description: "Cria ou atualiza os dados padrão do RPG no servidor.",
    aliases: "iniciar"
  },
  {
    command: "config",
    description: "Painel técnico do servidor: prefixo, log administrativo, log de comandos e resumo.",
    aliases: "cfg"
  },
  {
    command: "atributo",
    description: "Painel de atributos: cria, edita, remove e configura a fórmula de Chakra.",
    aliases: "attr"
  }
];

export function buildHelpPanel(prefix: string, page: HelpPage = "home") {
  return {
    embeds: [buildHelpEmbed(prefix, page)],
    components: [buildHelpSelect()]
  };
}

export async function handleHelpInteraction(
  interaction: Interaction,
  services: CommandServices
): Promise<boolean> {
  if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith(HELP_SELECT_ID)) {
    return false;
  }

  const page = parsePage(interaction.values[0] ?? "home");
  const prefix = interaction.inCachedGuild()
    ? await services.guildConfig.getPrefix(interaction.guild).catch(() => ".")
    : ".";

  await interaction.update(buildHelpPanel(prefix, page));
  return true;
}

function buildHelpEmbed(prefix: string, page: HelpPage): EmbedBuilder {
  if (page === "player") {
    return new EmbedBuilder()
      .setColor(0x2f855a)
      .setTitle("Guia do jogador")
      .setDescription(formatCommandList(prefix, PLAYER_COMMANDS));
  }

  if (page === "staff") {
    return new EmbedBuilder()
      .setColor(0x805ad5)
      .setTitle("Guia da staff")
      .setDescription(formatCommandList(prefix, STAFF_COMMANDS))
      .addFields({
        name: "Permissão",
        value: "Comandos de staff exigem Administrador ou Gerenciar Servidor."
      });
  }

  return new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle("Guia do Kaguya")
    .setDescription(
      [
        "Use a lista suspensa abaixo para navegar pelos comandos.",
        "",
        `Prefixo atual: \`${prefix}\``,
        "",
        "**Jogador** mostra ficha, atributos e Chakra.",
        "**Staff** mostra configurações e painéis administrativos.",
        "",
        "Comandos com muitas funções usam menus. Atalhos por texto existem só para manutenção."
      ].join("\n")
    )
    .addFields(
      { name: "Comandos de jogador", value: String(PLAYER_COMMANDS.length), inline: true },
      { name: "Comandos de staff", value: String(STAFF_COMMANDS.length), inline: true }
    );
}

function buildHelpSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${HELP_SELECT_ID}:${Date.now().toString(36)}`)
      .setPlaceholder("Escolha uma categoria")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Início")
          .setDescription("Resumo do guia e quantidade de comandos.")
          .setValue("home"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Jogador")
          .setDescription("Ficha, atributos, Chakra e comandos públicos.")
          .setValue("player"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Staff")
          .setDescription("Setup, configurações e painéis administrativos.")
          .setValue("staff")
      )
  );
}

function formatCommandList(prefix: string, entries: HelpCommandEntry[]): string {
  return entries
    .map((entry) => {
      const aliases = entry.aliases ? `\nAliases: ${entry.aliases}` : "";
      return `**${prefix}${entry.command}**\n${entry.description}${aliases}`;
    })
    .join("\n\n");
}

function parsePage(value: string): HelpPage {
  return value === "player" || value === "staff" ? value : "home";
}
