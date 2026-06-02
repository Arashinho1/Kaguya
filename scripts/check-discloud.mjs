import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";

const requiredConfig = {
  NAME: "Kaguya",
  TYPE: "bot",
  MAIN: "index.js",
  BUILD: "npm run discloud:build",
  START: "npm run discloud:start",
  VLAN: "true"
};

const requiredScripts = [
  "build",
  "typecheck",
  "db:generate",
  "db:validate",
  "db:deploy",
  "discloud:build",
  "discloud:start"
];

const requiredIgnoreEntries = ["node_modules/", "dist/", ".env", ".git/"];
const requiredEnv = ["DISCORD_TOKEN", "DATABASE_URL"];

const failures = [];

function readText(path) {
  if (!existsSync(path)) {
    failures.push(`${path} nao existe.`);
    return "";
  }

  return readFileSync(path, "utf8");
}

function parseDiscloudConfig(text) {
  const entries = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    entries[key] = value;
  }

  return entries;
}

const discloudConfig = parseDiscloudConfig(readText("discloud.config"));

for (const [key, expected] of Object.entries(requiredConfig)) {
  if (discloudConfig[key] !== expected) {
    failures.push(`discloud.config precisa ter ${key}=${expected}.`);
  }
}

const packageJsonText = readText("package.json");

if (packageJsonText) {
  const packageJson = JSON.parse(packageJsonText);

  for (const script of requiredScripts) {
    if (!packageJson.scripts?.[script]) {
      failures.push(`package.json precisa do script ${script}.`);
    }
  }

  if (!packageJson.scripts?.build?.includes("db:generate")) {
    failures.push("package.json precisa gerar o Prisma Client dentro do script build.");
  }

  if (!packageJson.scripts?.build?.includes("typecheck")) {
    failures.push("package.json precisa compilar TypeScript via typecheck dentro do script build.");
  }
}

const discloudIgnore = readText(".discloudignore");

for (const entry of requiredIgnoreEntries) {
  if (!discloudIgnore.includes(entry)) {
    failures.push(`.discloudignore precisa conter ${entry}.`);
  }
}

for (const key of requiredEnv) {
  if (!process.env[key]) {
    failures.push(`Variavel ${key} nao configurada no ambiente local.`);
  }
}

if (failures.length > 0) {
  console.error("Preflight Discloud falhou:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Preflight Discloud ok.");
console.log("DISCORD_TOKEN e DATABASE_URL estao presentes, sem exibir valores.");
