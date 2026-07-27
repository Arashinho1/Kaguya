import type { GuildBasedChannel } from "discord.js";

/**
 * Resolução de escopo por local (categoria/canal/fórum/thread), compartilhada entre duelo,
 * meditação e a detecção narrada de [jutsu]. Uma categoria liberada libera automaticamente
 * tudo dentro dela (canais e threads); um fórum liberado libera as threads (posts) dele.
 *
 * Não decide o que uma lista vazia significa — cada feature tem um default diferente
 * (duelo é "nada liberado até configurar", jutsu/meditar são "liberado em qualquer lugar
 * até restringir"), então isso fica por conta de quem chama.
 */

/** IDs que "representam" o canal pra fins de escopo: ele mesmo, seu canal-pai (se for
 * thread) e a categoria (dele ou do pai). */
export function collectScopeAncestorIds(channel: GuildBasedChannel): string[] {
  const ids = [channel.id];

  if (channel.isThread()) {
    if (channel.parentId) ids.push(channel.parentId);
    const parent = channel.parent;
    if (parent?.parentId) ids.push(parent.parentId);
    return ids;
  }

  if (channel.parentId) ids.push(channel.parentId);
  return ids;
}

export function isChannelInScope(channel: GuildBasedChannel | null, allowedIds: readonly string[]): boolean {
  if (!channel) return false;
  const ids = collectScopeAncestorIds(channel);
  return ids.some((id) => allowedIds.includes(id));
}

/**
 * Seleção guardada como 4 grupos (um por select de tipo no `.setar`) em vez de uma lista
 * só — cada select só mexe no próprio grupo, sem apagar o que já foi escolhido nos outros.
 * A resolução de escopo (isChannelInScope) não precisa saber de qual grupo cada ID veio;
 * só usa a lista achatada.
 */
export interface ScopeSelection {
  channels: string[];
  categories: string[];
  threads: string[];
  forums: string[];
}

export function emptyScopeSelection(): ScopeSelection {
  return { channels: [], categories: [], threads: [], forums: [] };
}

export function flattenScopeSelection(selection: ScopeSelection): string[] {
  return [...selection.channels, ...selection.categories, ...selection.threads, ...selection.forums];
}

export function isScopeSelectionEmpty(selection: ScopeSelection): boolean {
  return flattenScopeSelection(selection).length === 0;
}

function toIdArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function parseScopeSelection(raw: unknown): ScopeSelection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyScopeSelection();
  const obj = raw as Record<string, unknown>;
  return {
    channels: toIdArray(obj.channels),
    categories: toIdArray(obj.categories),
    threads: toIdArray(obj.threads),
    forums: toIdArray(obj.forums)
  };
}
