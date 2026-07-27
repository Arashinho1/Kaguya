/**
 * Convenção de customId pros menus interativos: "<prefixo>:<ação>:<parte>:<parte>...".
 * O prefixo identifica o menu (roteado pelo MenuRegistry); ação+partes são específicos
 * de cada menu (ver jutsuMenu.ts, fichaMenu.ts, ...).
 */
export function buildCustomId(prefix: string, action: string, ...parts: string[]): string {
  return [prefix, action, ...parts].join(":");
}

export interface ParsedCustomId {
  prefix: string;
  action: string;
  parts: string[];
}

export function parseCustomId(customId: string): ParsedCustomId {
  const [prefix, action, ...parts] = customId.split(":");
  return { prefix: prefix ?? "", action: action ?? "", parts };
}
