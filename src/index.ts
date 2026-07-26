import { Client, Events, GatewayIntentBits, Partials } from "discord.js";

import { commandRegistry } from "./commands/index.js";
import { env } from "./config/env.js";
import { deployGlobalSlashCommands } from "./core/commands/index.js";
import { closeDatabase, prisma } from "./database/prisma.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { AttributeService } from "./modules/attributes/AttributeService.js";
import { CharacterService } from "./modules/characters/CharacterService.js";
import { CombatService } from "./modules/combat/CombatService.js";
import { GuildConfigService } from "./modules/guild-config/GuildConfigService.js";
import { JutsuService } from "./modules/jutsus/JutsuService.js";
import { PericiaService } from "./modules/pericias/PericiaService.js";
import { TrainingService } from "./modules/training/TrainingService.js";
import { WorldConfigService } from "./modules/world/WorldConfigService.js";
import type { CommandServices } from "./types/command.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const guildConfig = new GuildConfigService(prisma);
const attributes = new AttributeService(prisma, guildConfig);
const world = new WorldConfigService(prisma, guildConfig);
const characters = new CharacterService(prisma, guildConfig, attributes, world);
const training = new TrainingService(prisma, guildConfig, attributes, characters);
const pericias = new PericiaService(prisma, guildConfig);
const jutsus = new JutsuService(prisma, guildConfig, characters, pericias);
const combat = new CombatService(prisma, guildConfig);

const services: CommandServices = {
  guildConfig,
  attributes,
  characters,
  world,
  training,
  pericias,
  jutsus,
  combat
};

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Kaguya online como ${readyClient.user.tag}`);

  void deployGlobalSlashCommands(readyClient, commandRegistry).catch((error) => {
    console.error("[slash-deploy]", error);
  });

  scheduleJutsuAutoSync(readyClient);
});

function scheduleJutsuAutoSync(readyClient: Client<true>): void {
  const intervalMs = env.JUTSU_SYNC_INTERVAL_MINUTES * 60_000;

  const runOnce = async (): Promise<void> => {
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        if (await jutsus.isAutoSyncEnabled(guild)) {
          await jutsus.syncFromSource(guild, "auto-sync");
        }
      } catch (error) {
        console.error(`[jutsu-auto-sync:${guild.id}]`, error);
      }
    }
  };

  setTimeout(() => void runOnce(), 30_000);
  setInterval(() => void runOnce(), intervalMs);
}

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
