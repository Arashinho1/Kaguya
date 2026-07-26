import type { Client } from "discord.js";

import type { ArgDef } from "./types.js";
import type { HybridCommand } from "./defineCommand.js";

export class CommandRegistry<TServices> {
  private readonly byName = new Map<string, HybridCommand<readonly ArgDef[], TServices>>();
  private readonly unique = new Set<HybridCommand<readonly ArgDef[], TServices>>();

  public register(command: HybridCommand<readonly ArgDef[], TServices>): void {
    this.byName.set(command.name.toLowerCase(), command);
    for (const alias of command.aliases) {
      this.byName.set(alias.toLowerCase(), command);
    }
    this.unique.add(command);
  }

  public get(nameOrAlias: string): HybridCommand<readonly ArgDef[], TServices> | undefined {
    return this.byName.get(nameOrAlias.toLowerCase());
  }

  public list(): HybridCommand<readonly ArgDef[], TServices>[] {
    return [...this.unique];
  }
}

/** Registra (globalmente) todos os slash commands espelhados a partir da mesma definição de comando. */
export async function deployGlobalSlashCommands(
  client: Client<true>,
  registry: CommandRegistry<unknown>
): Promise<void> {
  const payload = registry.list().map((command) => command.toSlashBuilder().toJSON());
  await client.application.commands.set(payload);
}
