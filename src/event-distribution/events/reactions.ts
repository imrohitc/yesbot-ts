import {
  AddEventHandlerFunction,
  BaseOptions,
  DiscordEvent,
  ExtractInfoForEventFunction,
  HandlerFunctionFor,
} from "../types/base";
import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  TextBasedChannels,
  User,
} from "discord.js";
import { addToTree } from "../helper";

export interface ReactionEventHandlerOptions extends BaseOptions {
  emoji: string;
  event: DiscordEvent.REACTION_ADD | DiscordEvent.REACTION_REMOVE;
}

export type ReactionHandlerFunction<T extends DiscordEvent> =
  HandlerFunctionFor<
    T,
    DiscordEvent.REACTION_ADD | DiscordEvent.REACTION_REMOVE,
    [MessageReaction | PartialMessageReaction, User | PartialUser]
  >;

export const addReactionHandler: AddEventHandlerFunction<ReactionEventHandlerOptions> =
  (options, ioc, tree) => {
    const channels = options.channelNames ?? [];
    if (channels.length === 0) channels.push("");

    const emoji = options.emoji ?? "";

    for (const channel of channels) {
      addToTree([channel, emoji], { options, ioc }, tree);
    }
  };

export const extractReactionInfo: ExtractInfoForEventFunction<
  DiscordEvent.REACTION_ADD | DiscordEvent.REACTION_REMOVE
> = (reaction, user) => {
  const getChannelIdentifier = (channel: TextBasedChannels) =>
    channel.type === "DM" ? channel.id : channel.name;

  const channel = reaction.message.channel;
  const guild = channel.type === "DM" ? null : channel.guild;
  const member = guild?.members.resolve(user.id) ?? null;

  const channelIdentifier = getChannelIdentifier(channel);
  return {
    handlerKeys: [channelIdentifier, reaction.emoji.name],
    member,
    isDirectMessage: reaction.message.channel.type === "DM",
  };
};
