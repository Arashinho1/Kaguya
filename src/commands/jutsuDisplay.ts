/**
 * Helpers visuais compartilhados entre o comando de texto (.jutsu) e o menu
 * interativo (JutsuMenu) — cor/emoji por rank, emoji por tipo/elemento, ordenação.
 * Puramente apresentação; não sabe nada de Prisma/serviço.
 */

export const EMBED_COLOR = 0xff6b1a;

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

/** Trunca preservando limites de campo do Discord (label/description de SelectMenuOption = 100). */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
