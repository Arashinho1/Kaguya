import type {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Message,
  MessageActionRowComponentBuilder,
  Role,
  User
} from "discord.js";

export type CommandAccess = "owner" | "admin" | "member";

export type ArgType = "string" | "text" | "integer" | "number" | "boolean" | "user" | "channel" | "role";

export interface ArgDef<TName extends string = string, TType extends ArgType = ArgType> {
  name: TName;
  type: TType;
  description: string;
  /** Default: true. Só o último argumento pode ser opcional. */
  required?: boolean;
  /** Só vale para type: "string". Restringe os valores aceitos (prefixo e slash). */
  choices?: readonly string[];
  /** Só vale para type: "integer" | "number". */
  min?: number;
  max?: number;
}

export interface ArgValueMap {
  string: string;
  text: string;
  integer: number;
  number: number;
  boolean: boolean;
  user: User;
  channel: GuildBasedChannel;
  role: Role;
}

type RequiredOf<A extends ArgDef> = A["required"] extends false ? false : true;

export type ArgsResult<TArgs extends readonly ArgDef[]> = {
  [A in TArgs[number] as A["name"]]: RequiredOf<A> extends true
    ? ArgValueMap[A["type"]]
    : ArgValueMap[A["type"]] | undefined;
};

export type ReplyPayload =
  | string
  | {
      content?: string;
      embeds?: EmbedBuilder[];
      components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
      /** Ignorado no modo prefixo (Discord só suporta ephemeral em interações). */
      ephemeral?: boolean;
    };

export interface CommandContext<TArgs extends readonly ArgDef[], TServices> {
  readonly isSlash: boolean;
  readonly guild: Guild;
  readonly user: User;
  readonly member: GuildMember | null;
  readonly channelId: string;
  readonly args: ArgsResult<TArgs>;
  readonly services: TServices;
  readonly source: Message<true> | ChatInputCommandInteraction<"cached">;
  reply(payload: ReplyPayload): Promise<void>;
}

export interface CommandDefinition<TArgs extends readonly ArgDef[], TServices, TModule extends string = string> {
  name: string;
  description: string;
  aliases?: readonly string[];
  access: CommandAccess;
  module?: TModule;
  args?: TArgs;
  handler(context: CommandContext<TArgs, TServices>): Promise<void>;
}
