/** Cor de destaque usada em todos os embeds do bot — um só lugar pra mudar a identidade visual. */
export const BRAND_COLOR = 0xff6b1a;

/** Trunca preservando limites de campo do Discord (label/description de SelectMenuOption = 100). */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
