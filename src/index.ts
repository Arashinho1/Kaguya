import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import { env } from "./config/env.js";
import { prisma, closeDatabase } from "./database/prisma.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { AttributeService } from "./modules/attributes/AttributeService.js";
import { CharacterService } from "./modules/characters/CharacterService.js";
import { GuildConfigService } from "./modules/guild-config/GuildConfigService.js";
import { JutsuService } from "./modules/jutsus/JutsuService.js";
import { WorldConfigService } from "./modules/world/WorldConfigService.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const guildConfig = new GuildConfigService(prisma);
const attributes = new AttributeService(prisma, guildConfig);
const world = new WorldConfigService(prisma, guildConfig);
const characters = new CharacterService(prisma, guildConfig, attributes);

const services = {
  guildConfig,
  attributes,
  characters,
  jutsus: new JutsuService(prisma, guildConfig, characters),
  world
};

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Kaguya online como ${readyClient.user.tag}`);
});

client.on("messageCreate", (message) => {
  void handleMessageCreate(message, services);
});

client.on("interactionCreate", (interaction) => {
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
