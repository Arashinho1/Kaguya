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
    )
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Configuração de ambiente inválida:", parsed.error.flatten().fieldErrors);
  throw new Error("Variáveis de ambiente inválidas. Confira o .env.");
}

export const env = parsed.data;
