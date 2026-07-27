import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";

import { parseCustomId } from "./customId.js";

export type MenuInteraction =
  | StringSelectMenuInteraction<"cached">
  | ButtonInteraction<"cached">
  | ModalSubmitInteraction<"cached">;

export interface MenuHandler<TServices> {
  /** Precisa bater com o primeiro segmento do customId (buildCustomId(prefix, ...)). */
  prefix: string;
  handle(interaction: MenuInteraction, services: TServices): Promise<void>;
}

/**
 * Roteia interações de componente/modal para o menu certo pelo prefixo do customId —
 * cada módulo com menu (jutsuMenu, fichaMenu, ...) se registra sozinho, sem precisar
 * editar interactionCreate.ts a cada menu novo (mesmo espírito do core/modules/registry).
 */
export class MenuRegistry<TServices> {
  private readonly handlers = new Map<string, MenuHandler<TServices>>();

  public register(handler: MenuHandler<TServices>): void {
    this.handlers.set(handler.prefix, handler);
  }

  /** Retorna false se nenhum menu registrado reconhece o customId (chamador decide o que fazer). */
  public async dispatch(interaction: MenuInteraction, services: TServices): Promise<boolean> {
    const { prefix } = parseCustomId(interaction.customId);
    const handler = this.handlers.get(prefix);

    if (!handler) {
      return false;
    }

    await handler.handle(interaction, services);
    return true;
  }
}
