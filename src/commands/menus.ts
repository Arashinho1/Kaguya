import { MenuRegistry } from "../core/commands/menuRegistry.js";
import type { CommandServices } from "../types/command.js";

/** Instância compartilhada — cada arquivo de menu (jutsuMenu, fichaMenu, ...) se registra aqui. */
export const menuRegistry = new MenuRegistry<CommandServices>();
