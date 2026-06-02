import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN é obrigatório."),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório."),
  BOT_PREFIX: z.string().min(1).default("."),
  BOT_OWNER_IDS: z.string().default("")
});

export const env = envSchema.parse(process.env);
