import {
  Command,
  CommandHandler,
  DiscordEvent,
} from "../../../event-distribution";
import { ChatNames } from "../../../collections/chat-names";
import { MessageReaction, TextChannel, User } from "discord.js";
import { getChannelName, TicketType } from "../common";

@Command({
  event: DiscordEvent.REACTION_ADD,
  channelNames: [ChatNames.TRAVEL_APPROVALS],
  allowedRoles: ["Support"],
  emoji: "🚫",
  description: "Declines a previously opened travel ticket",
})
class DeclineTravelTicket extends CommandHandler<DiscordEvent.REACTION_ADD> {
  async handle(reaction: MessageReaction, user: User): Promise<void> {
    const message = reaction.message;
    const ticketAuthor = message.mentions.users.first();
    const channelName = getChannelName(ticketAuthor, TicketType.TRAVEL);
    const channel = message.guild!.channels.cache.find(
      (c) => c.name === channelName
    ) as TextChannel;

    await channel.send(
      `<@${user.id}> has declined your ticket, they will be here in a second to tell you why! Once you are ready to give it another shot, send !retry to fill in the "form" again.`
    );

    const reactingMember = channel.guild.members.resolve(user);
    await message.edit(
      message.content + `\n\nApproved by ${reactingMember.displayName}`
    );

    await message.reactions.removeAll();
  }
}
