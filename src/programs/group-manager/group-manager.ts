import {
  Channel,
  Message,
  TextChannel,
} from "discord.js";
import Tools from "../../common/tools";
import { isAuthorModerator } from "../../common/moderator";
import {
  GroupPingSetting,
  UserGroup,
} from "@yes-theory-fam/database/client";
import { ChatNames } from "../../collections/chat-names";
import prisma from "../../prisma";
import {
  logger,
} from "./common";

const groupManager = async (message: Message, isConfig: boolean) => {
  const content = message.content;

  if (isConfig) {
    const words = Tools.stringToWords(content);
    words.shift();
    const [action, requestName, ...rest] = words;
    const description = rest.join(" ");

    if (
      !action ||
      ![
        "toggle",
        "changeCooldown",
        "changeDeadtime",
        "changeGroupPingSettings",
      ].includes(action)
    ) {
      const helpMessage = `Incorrect syntax, please use the following: \`!group join|leave|create|search|delete|update|changeCooldown|changeDeadtime\`. If you need additional help, react with 🛠️ below to tag a ${process.env.ENGINEER_ROLE_NAME}`;
      await message.reply(helpMessage);
      return;
    }

    const user = message.member;
    const moderator = isAuthorModerator(message);

    switch (action) {

      case "changeGroupPingSettings": {
        moderator
          ? await changeGroupPingSettings(message, requestName, description)
          : await Tools.handleUserError(
              message,
              "You do not have permissions to use this command."
            );
        break;
      }

      case "changeCooldown": {
        moderator
          ? await changeCooldown(message, requestName, description)
          : await Tools.handleUserError(
              message,
              "You do not have permission to use this command."
            );
      }
    }
  } else {
    if (!isChannelAllowed(message.channel)) {
      return;
    }
    const lines = content.split("\n");
    const unquoted = lines.filter((line) => !line.startsWith(">")).join("\n");
    const hasUnquotedGroupPing = unquoted.includes("@group");

    if (!hasUnquotedGroupPing) return;

    const groupTriggerStart = content.substring(content.indexOf("@group"));
    const args = <string[]>groupTriggerStart.split(/\s/g);

    args.shift();
    const [requestName] = args;

    const groups = await prisma.userGroup.findMany({
      include: {
        userGroupMembersGroupMembers: { include: { groupMember: true } },
      },
    });
    const matchingGroups = groups.filter(
      (group: UserGroup) =>
        group.name.toLowerCase() == requestName.toLowerCase()
    );

    if (matchingGroups.length === 0) {
      await message.reply("I couldn't find that group.");
      return;
    }

    const group = matchingGroups[0];
    const timeDifference = (Date.now() - group.lastUsed.getTime()) / 1000 / 60;
    const deadChatTimeRemaining = await timeRemainingForDeadchat(
      message,
      group
    );

    const moderator = isAuthorModerator(message);
    const setting = group.groupPingSetting;

    if (setting === GroupPingSetting.MODERATOR && !moderator) {
      await Tools.handleUserError(
        message,
        "Sorry! This group is only pingable by moderators."
      );
      return;
    }

    if (setting === GroupPingSetting.BOT && !message.author.bot) {
      await Tools.handleUserError(
        message,
        "Sorry! This group is only pingable by YesBot."
      );
      return;
    }

    if (setting === GroupPingSetting.OFF) {
      await Tools.handleUserError(
        message,
        "Sorry! This group is not pingable by members."
      );
      return;
    }

    if (deadChatTimeRemaining > 0) {
      await Tools.handleUserError(
        message,
        `Chat is not dead! You can ping this group if there have been no messages in the next ${deadChatTimeRemaining} minutes.`
      );
      return;
    }

    if (timeDifference < group.cooldown) {
      const remainingCooldown = group.cooldown - Math.round(timeDifference);
      await Tools.handleUserError(
        message,
        `Sorry, this group was already pinged within the last ${group.cooldown} minutes; it's about ${remainingCooldown} minutes left until you can ping it again.`
      );
      return;
    }

    const groupPingMessage =
      `**@${group.name}**: ` +
      group.userGroupMembersGroupMembers
        .map((member) => `<@${member.groupMemberId}>`)
        .join(", ");

    await message.channel.send(groupPingMessage, { split: { char: "," } });

    await prisma.userGroup.update({
      where: { id: group.id },
      data: { lastUsed: new Date() },
    });
  }
};

const changeGroupPingSettings = async (
  message: Message,
  requestedGroupName: string,
  option: string
) => {
  const setting = option.toUpperCase();

  if (
    setting !== GroupPingSetting.MODERATOR &&
    setting !== GroupPingSetting.MEMBER &&
    setting !== GroupPingSetting.BOT &&
    setting !== GroupPingSetting.OFF
  ) {
    await Tools.handleUserError(
      message,
      "Please write a valid setting for the group ping! The options are `moderator`, `member`, `bot` or `off`."
    );
    return;
  }
  const group = await prisma.userGroup.findFirst({
    where: {
      name: {
        equals: requestedGroupName,
        mode: "insensitive",
      },
    },
  });

  if (!group) {
    await message.reply("That group doesn't exist!");
    return;
  }

  try {
    await prisma.userGroup.update({
      where: { id: group.id },
      data: { groupPingSetting: GroupPingSetting[setting] },
    });
  } catch (error) {
    logger.error("Failed to update database group ping settings," + error);
    await message.react("👎");
    return;
  }

  await message.react("👍");
};

const changeCooldown = async (
  message: Message,
  requestedGroupName: string,
  newCooldown: string
) => {
  const cooldownNumber = Number(newCooldown);
  if (isNaN(cooldownNumber)) {
    await Tools.handleUserError(
      message,
      "Please write a number for the new cooldown! It will be interpreted as minutes before the group can be pinged again."
    );
    return;
  }

  const group = await prisma.userGroup.findFirst({
    where: {
      name: {
        equals: requestedGroupName,
        mode: "insensitive",
      },
    },
  });

  await prisma.userGroup.update({
    where: { id: group.id },
    data: { cooldown: cooldownNumber },
  });

  await message.react("👍");
};

const isChannelAllowed = (channel: Channel): boolean => {
  const isTextChannel = (channel: Channel): channel is TextChannel =>
    (channel as TextChannel).name && !!(channel as TextChannel).parent;
  if (!isTextChannel(channel)) return;

  const allowedCategories = ["hobbies", "gaming"];
  const allowedChannels = [
    ChatNames.CHAT.toString(),
    ChatNames.CHAT_TOO.toString(),
    ChatNames.FOURTH_CHAT.toString(),
    ChatNames.CHAT_FIVE.toString(),
    ChatNames.VOICE_CHAT.toString(),
    ChatNames.VOICE_CHAT_TWO.toString(),
    ChatNames.SELF_DEVELOPMENT.toString(),
    ChatNames.LEARNING_SPANISH.toString(),
    ChatNames.DAILY_CHALLENGE.toString(),
    ChatNames.YESTHEORY_DISCUSSION.toString(),
  ];

  if (
    allowedCategories.some((category) =>
      channel.parent?.name?.toLowerCase()?.includes(category)
    )
  )
    return true;

  return allowedChannels.includes(channel.name);
};

const timeRemainingForDeadchat = async (message: Message, group: UserGroup) => {
  const lastMessages = (
    await message.channel.messages.fetch({ limit: 2 })
  ).array();

  if (lastMessages.length < 2) {
    return 0;
  }

  const timeDifference =
    (Date.now() - lastMessages[1].createdTimestamp) / 1000 / 60;

  return group.deadtime - Math.round(timeDifference);
};

export default groupManager;
