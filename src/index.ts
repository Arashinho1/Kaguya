import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import { commandRegistry } from "./commands/index.js";
import { env } from "./config/env.js";
import { deployGlobalSlashCommands } from "./core/commands/index.js";
import { closeDatabase, prisma } from "./database/prisma.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { AttributeService } from "./modules/attributes/AttributeService.js";
import { GuildConfigService } from "./modules/guild-config/GuildConfigService.js";
import type { CommandServices } from "./types/command.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const guildConfig = new GuildConfigService(prisma);
const attributes = new AttributeService(prisma, guildConfig);

const services: CommandServices = {
  guildConfig,
  attributes
};

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Kaguya online como ${readyClient.user.tag}`);

  void deployGlobalSlashCommands(readyClient, commandRegistry).catch((error) => {
    console.error("[slash-deploy]", error);
  });
});

client.on(Events.MessageCreate, (message) => {
  void handleMessageCreate(message, services);
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteractionCreate(interaction, services);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Recebido ${signal}. Encerrando...`);
  client.destroy();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void client.login(env.DISCORD_TOKEN);
