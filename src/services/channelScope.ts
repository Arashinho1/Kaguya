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
