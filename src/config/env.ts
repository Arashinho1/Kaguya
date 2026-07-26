import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN é obrigatório."),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório."),
  BOT_PREFIX: z.string().min(1).default("."),
  BOT_OWNER_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d{15,25}$/.test(id))
    ),
  // Fonte pública de conteúdo de jutsus (site "Mundo Ninja", Supabase próprio do site — API
  // REST pública, chave anônima já é enviada ao navegador de qualquer visitante do site).
  JUTSU_SOURCE_URL: z.string().default("https://hedlqpecdzkntrnqsmug.supabase.co"),
  JUTSU_SOURCE_ANON_KEY: z
    .string()
    .default(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZGxxcGVjZHprbnRybnFzbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzMzMjQsImV4cCI6MjA5OTAwOTMyNH0.VyJPlUfHle6wo1pQQhzuvZ0EmZ2EbFa-8xQtmpd6z5o"
    ),
  JUTSU_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração de ambiente inválida:", parsed.error.flatten().fieldErrors);
  throw new Error("Variáveis de ambiente inválidas. Confira o .env.");
}

export const env = parsed.data;
