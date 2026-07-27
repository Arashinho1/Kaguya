import { AttachmentBuilder } from "discord.js";

import { BRAND_COLOR, truncate } from "./uiConstants.js";

/**
 * Helpers visuais compartilhados entre o comando de texto (.jutsu) e o menu
 * interativo (JutsuMenu) — cor/emoji por rank, emoji por tipo/elemento, ordenação.
 * Puramente apresentação; não sabe nada de Prisma/serviço.
 */

export { truncate };
export const EMBED_COLOR = BRAND_COLOR;

export const RANK_ORDER: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };

const RANK_COLOR: Record<string, number> = {
  D: 0x95a5a6,
  C: 0x2ecc71,
  B: 0x3498db,
  A: 0x9b59b6,
  S: 0xe74c3c
};

const RANK_BADGE: Record<string, string> = {
  D: "⚪",
  C: "🟢",
  B: "🔵",
  A: "🟣",
  S: "🔴"
};

const TYPE_EMOJI: Record<string, string> = {
  ninjutsu: "🌀",
  "ninjutsu-elemental": "🌪️",
  taijutsu: "👊",
  genjutsu: "🌀",
  "kekkei-genkai": "🧬",
  fuinjutsu: "🔏",
  kenjutsu: "🗡️",
  bukijutsu: "🏹"
};

const ELEMENT_EMOJI: Record<string, string> = {
  Katon: "🔥",
  Suiton: "💧",
  Raiton: "⚡",
  Doton: "🪨",
  Futon: "🌪️",
  Hyouton: "❄️",
  Youton: "🌋",
  Jinton: "💨",
  Bakuton: "💥",
  Mokuton: "🌳"
};

export function rankBadge(rank: string | null): string {
  return rank ? (RANK_BADGE[rank] ?? "⭐") : "❔";
}

export function rankColor(rank: string | null): number {
  return rank ? (RANK_COLOR[rank] ?? EMBED_COLOR) : EMBED_COLOR;
}

export function typeEmoji(typeKey: string | undefined): string {
  return (typeKey && TYPE_EMOJI[typeKey]) || "🥷";
}

export function elementEmoji(element: string | null): string {
  return element ? (ELEMENT_EMOJI[element] ?? "🌊") : "";
}

export function sortByRank<T extends { jutsuRank: string | null; name: string }>(jutsus: T[]): T[] {
  return [...jutsus].sort((a, b) => {
    const diff = (RANK_ORDER[a.jutsuRank ?? ""] ?? 0) - (RANK_ORDER[b.jutsuRank ?? ""] ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

export interface ImageAttachmentResult {
  attachment: AttachmentBuilder;
  /** Já no formato attachment://<arquivo> — pronto pra passar em embed.setImage(). */
  imageUrl: string;
}

const IMAGE_FETCH_TIMEOUT_MS = 5000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp"
};

/**
 * Muitos hosts de imagem usados no cadastro do site (wikis de terceiros, CDNs
 * obscuros) bloqueiam especificamente o crawler de embed do Discord mesmo
 * respondendo normalmente a qualquer outro cliente — provável Cloudflare
 * bloqueando o user-agent "Discordbot". Por isso o bot baixa a imagem aqui
 * (com um cliente HTTP normal) e reenvia como anexo do próprio Discord, que
 * nunca falha em renderizar o que ele mesmo hospedou.
 */
export async function fetchImageAttachment(url: string, baseName: string): Promise<ImageAttachmentResult | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const extension = contentType ? EXTENSION_BY_CONTENT_TYPE[contentType] : undefined;
    if (!extension) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;

    const fileName = `${sanitizeFileName(baseName)}.${extension}`;
    return {
      attachment: new AttachmentBuilder(buffer, { name: fileName }),
      imageUrl: `attachment://${fileName}`
    };
  } catch {
    return null;
  }
}

function sanitizeFileName(base: string): string {
  return base.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "jutsu";
}
