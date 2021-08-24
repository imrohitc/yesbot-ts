import {
  GuildChannel,
  Message,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import { textLog } from "../common/moderator";
import prisma from "../prisma";

const reactionRemove = async (
  messageReaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
) => {
  const {
    message: { id: messageId, channel, guild },
    emoji: { name: emoji },
  } = messageReaction;

  if (channel.type === "DM" || channel.name === "pick-your-color" || user.bot) {
    return;
  }

  const reactRoleObjects = await prisma.reactionRole.findMany({
    where: {
      messageId: messageId,
      channelId: channel.id,
      reaction: emoji,
    },
  });

  reactRoleObjects.forEach((reactionRole) => {
    const guildMember = guild.members.resolve(user.id);
    const roleToAdd = guild.roles.resolve(reactionRole.roleId);
    guildMember.roles.remove(roleToAdd);
  });

  await handleChannelToggleReaction(
    messageReaction.message,
    user,
    messageReaction.emoji.name
  );
};

const handleChannelToggleReaction = async (
  message: Message | PartialMessage,
  user: User | PartialUser,
  emoji: string
) => {
  const { id: messageId, guild } = message;

  const toggle = await prisma.channelToggle.findFirst({
    where: {
      emoji,
      messageId,
    },
  });
  if (!toggle) {
    return;
  }

  const channel = guild.channels.cache.find((c) => c.id === toggle.channel);

  if (!channel) {
    await textLog(
      `I can't find this channel <#${toggle.channel}>. Has it been deleted?`
    );
    return;
  }
  await (channel as GuildChannel).permissionOverwrites
    .resolve(user.id)
    ?.delete();
};

export default reactionRemove;
