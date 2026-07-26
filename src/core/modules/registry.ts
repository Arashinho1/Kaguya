/**
 * Registro de módulos do bot. Cada módulo de jogo se registra aqui (efeito colateral no
 * import do seu arquivo de índice) em vez de o bot manter uma lista fixa de módulos —
 * adicionar um módulo novo não exige editar um enum central.
 */
export interface ModuleInfo {
  key: string;
  name: string;
  description: string;
}

const modules = new Map<string, ModuleInfo>();

export function registerModule(info: ModuleInfo): void {
  modules.set(info.key, info);
}

export function getModule(key: string): ModuleInfo | undefined {
  return modules.get(key);
}

export function listModules(): ModuleInfo[] {
  return [...modules.values()];
}
