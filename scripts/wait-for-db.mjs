import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const maxAttempts = Number(process.env.DB_WAIT_ATTEMPTS ?? 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS ?? 5000);

if (!connectionString) {
  console.error("DATABASE_URL nao configurada.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.password) {
      parsed.password = "***";
    }

    return parsed.toString();
  } catch {
    return "DATABASE_URL invalida ou sensivel";
  }
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000
  });

  try {
    await pool.query("select 1");
    await pool.end();
    console.log("Banco acessivel.");
    process.exit(0);
  } catch (error) {
    await pool.end().catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);

    console.log(
      `Aguardando banco (${attempt}/${maxAttempts}) em ${redactDatabaseUrl(connectionString)}: ${message}`
    );

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }
}

console.error("Nao foi possivel conectar no banco depois das tentativas configuradas.");
process.exit(1);
