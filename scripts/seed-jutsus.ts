/**
 * Seed script: re-seed de JutsuDefinitions para um servidor específico.
 * Os mesmos dados criados pelo .setup — útil para re-sincronizar após atualizações.
 *
 * Uso: npx tsx scripts/seed-jutsus.ts <DISCORD_GUILD_ID>
 */
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DEFAULT_JUTSU_DATA } from "../src/config/defaultJutsus.js";

const guildDiscordId = process.argv[2];

if (!guildDiscordId) {
  console.error("Uso: npx tsx scripts/seed-jutsus.ts <DISCORD_GUILD_ID>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const guild = await prisma.rpgGuild.findUnique({
    where: { discordId: guildDiscordId }
  });

  if (!guild) {
    console.error(`Servidor ${guildDiscordId} não encontrado. Execute .setup no Discord primeiro.`);
    process.exit(1);
  }

  console.log(`Re-seedando jutsus para: ${guild.name} (${guild.discordId})`);

  const [types, ranks] = await Promise.all([
    prisma.jutsuType.findMany({ where: { guildId: guild.id } }),
    prisma.rankDefinition.findMany({ where: { guildId: guild.id } })
  ]);

  const typeMap = new Map(types.map((t) => [t.key, t.id]));
  const rankMap = new Map(ranks.map((r) => [r.key, r.id]));
  const missing = { types: new Set<string>(), ranks: new Set<string>() };

  let created = 0;
  let updated = 0;

  for (const jutsu of DEFAULT_JUTSU_DATA) {
    const typeId = typeMap.get(jutsu.typeKey);
    const requiredRankId = jutsu.rankKey ? rankMap.get(jutsu.rankKey) : undefined;

    if (!typeId) missing.types.add(jutsu.typeKey);
    if (jutsu.rankKey && !requiredRankId) missing.ranks.add(jutsu.rankKey);

    const existing = await prisma.jutsuDefinition.findUnique({
      where: { guildId_key: { guildId: guild.id, key: jutsu.key } }
    });

    if (existing) {
      await prisma.jutsuDefinition.update({
        where: { id: existing.id },
        data: {
          name: jutsu.name,
          description: jutsu.description ?? null,
          typeId: typeId ?? null,
          requiredRankId: requiredRankId ?? null,
          chakraCost: jutsu.chakraCost,
          duration: jutsu.duration ?? null,
          usageLimit: jutsu.usageLimit ?? null
        }
      });
      updated++;
    } else {
      await prisma.jutsuDefinition.create({
        data: {
          guildId: guild.id,
          key: jutsu.key,
          name: jutsu.name,
          description: jutsu.description ?? null,
          typeId: typeId ?? null,
          requiredRankId: requiredRankId ?? null,
          chakraCost: jutsu.chakraCost,
          duration: jutsu.duration ?? null,
          usageLimit: jutsu.usageLimit ?? null
        }
      });
      created++;
    }
  }

  console.log(`\nResultado: ${created} criados, ${updated} atualizados`);

  if (missing.types.size > 0) {
    console.warn(`\nAVISO — Tipos não encontrados: ${[...missing.types].join(", ")}`);
  }
  if (missing.ranks.size > 0) {
    console.warn(`AVISO — Ranks não encontrados: ${[...missing.ranks].join(", ")}`);
  }
}

main()
  .catch((err: unknown) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
