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
    description: "Mostra como o Chakra e calculado neste servidor."
  },
  {
    command: "ping",
    description: "Confirma se o bot esta respondendo."
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
    description: "Cria ou atualiza os dados padrao do RPG no servidor.",
    aliases: "iniciar"
  },
  {
    command: "config",
    description: "Painel tecnico do servidor: prefixo, canal de logs e resumo das configuracoes.",
    aliases: "cfg"
  },
  {
    command: "atributo",
    description: "Painel de atributos: cria, edita, remove e configura a formula de Chakra.",
    aliases: "attr"
  }
];

export function buildHelpPanel(prefix: string, page: HelpPage = "home") {
  return {
    embeds: [buildHelpEmbed(prefix, page)],
    components: [buildHelpSelect(page)]
  };
}

export async function handleHelpInteraction(
  interaction: Interaction,
  services: CommandServices
): Promise<boolean> {
  if (!interaction.isStringSelectMenu() || interaction.customId !== HELP_SELECT_ID) {
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
        name: "Permissao",
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
        "**Staff** mostra configuracoes e paineis administrativos.",
        "",
        "Comandos com muitas funcoes usam menus. Atalhos por texto existem so para manutencao."
      ].join("\n")
    )
    .addFields(
      { name: "Comandos de jogador", value: String(PLAYER_COMMANDS.length), inline: true },
      { name: "Comandos de staff", value: String(STAFF_COMMANDS.length), inline: true }
    );
}

function buildHelpSelect(activePage: HelpPage): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(HELP_SELECT_ID)
      .setPlaceholder("Escolha uma categoria")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Inicio")
          .setDescription("Resumo do guia e quantidade de comandos.")
          .setValue("home")
          .setDefault(activePage === "home"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Jogador")
          .setDescription("Ficha, atributos, Chakra e comandos publicos.")
          .setValue("player")
          .setDefault(activePage === "player"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Staff")
          .setDescription("Setup, configuracoes e paineis administrativos.")
          .setValue("staff")
          .setDefault(activePage === "staff")
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
