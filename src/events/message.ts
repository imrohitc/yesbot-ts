import { GuildChannel, Message, TextChannel } from "discord.js";
import {
  ExportManager,
  Game,
  MapTools,
  VoiceOnDemand,
} from "../programs";

const message = async (msg: Message) => {
  if (msg.channel.type === "dm" && !msg.author.bot) {
    return;
  } else {
    await routeMessage(msg);
  }
};

const routeMessage = async (message: Message) => {
  const words = message.content.split(/\s+/);
  const channel = <TextChannel>message.channel;
  const firstWord = words[0];
  const restOfMessage = words.slice(1).join(" ");

  switch (channel.name) {
    case "permanent-testing":
      if (firstWord === "!export") await ExportManager(message);;
    case "bot-commands":

      if (firstWord === "!voice") await VoiceOnDemand(message);
      if (firstWord === "!map") await MapTools.map(message);
      if (firstWord === "!mapadd") await MapTools.mapAdd(message);
      break;

    case "feature-requests":
      message.react("👍").then(() => message.react("👎"));
      break;

    case "bot-games":
      if (firstWord === "!game") await Game.showGameEmbed(message);
      break;
  }

  const parentChannel = (message.channel as GuildChannel).parent;
  if (
    parentChannel &&
    parentChannel.name.toLowerCase().endsWith("entertainment")
  ) {
    Game.handleGameInput(message);
  }

  if (firstWord === "!goodbye") {
    const guildRole = message.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === "head"
    );
    await message.member.roles.remove(guildRole);
  }
};

export default message;
