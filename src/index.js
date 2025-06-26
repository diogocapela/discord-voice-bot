const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
} = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require("@discordjs/voice");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

// Import custom modules
const VoiceHandler = require("./voiceHandler");
const AudioReceiver = require("./audioReceiver");

// Load environment variables
require("dotenv").config();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Audio player for TTS playback
const audioPlayer = createAudioPlayer();

// Initialize voice handler and audio receiver
const voiceHandler = new VoiceHandler(openai);
const audioReceiver = new AudioReceiver(voiceHandler, client);

// Set audio player for voice handler
voiceHandler.setAudioPlayer(audioPlayer);

// Store active voice sessions
const activeSessions = new Map();

// Bot configuration
const config = {
  prefix: "!",
  voiceCommand: "voice",
  leaveCommand: "leave",
  helpCommand: "help",
  clearCommand: "clear",
};

// Error handling
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

// Bot ready event
client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
  console.log(`📝 Use "${config.prefix}${config.helpCommand}" for help`);
});

// Message handler
client.on(Events.MessageCreate, async (message) => {
  console.log(
    `📨 Received message: "${message.content}" from ${message.author.tag}`
  );

  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  console.log(`🎯 Processing command: ${message.content}`);

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  console.log(`⚡ Command parsed: "${command}"`);

  try {
    switch (command) {
      case config.voiceCommand:
        await handleVoiceCommand(message, args);
        break;
      case config.leaveCommand:
        await handleLeaveCommand(message);
        break;
      case config.helpCommand:
        await handleHelpCommand(message);
        break;
      case config.clearCommand:
        await handleClearCommand(message);
        break;
    }
  } catch (error) {
    console.error("Error handling command:", error);
    await message.reply("❌ An error occurred while processing your command.");
  }
});

// Handle voice command
async function handleVoiceCommand(message, args) {
  const member = message.member;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    return message.reply(
      "❌ You need to be in a voice channel to use this command!"
    );
  }

  if (activeSessions.has(message.guild.id)) {
    return message.reply(
      "❌ I'm already active in a voice channel! Use `!leave` to disconnect me first."
    );
  }

  try {
    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // Wait for connection to be ready
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    // Store session
    activeSessions.set(message.guild.id, {
      connection,
      channel: voiceChannel,
      guild: message.guild,
    });

    // Subscribe to audio player
    connection.subscribe(audioPlayer);

    // Start receiving audio
    audioReceiver.startReceiving(connection, message.guild.id);

    // Send confirmation
    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("🎤 Voice Bot Activated")
      .setDescription(
        `I've joined **${voiceChannel.name}** and I'm ready to listen and respond!`
      )
      .addFields(
        {
          name: "Commands",
          value:
            "• `!leave` - Disconnect from voice channel\n• `!clear` - Clear conversation history\n• `!help` - Show help information",
        },
        { name: "Status", value: "✅ Listening for speech..." },
        {
          name: "How to use",
          value:
            "Just speak naturally in the voice channel. I'll transcribe your speech and respond with AI-generated voice.",
        }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    console.log(
      `🎵 Joined voice channel: ${voiceChannel.name} in ${message.guild.name}`
    );

    // Set up voice state update listener for this guild
    setupVoiceStateListener(message.guild.id);
  } catch (error) {
    console.error("Error joining voice channel:", error);
    await message.reply(
      "❌ Failed to join the voice channel. Please try again."
    );
  }
}

// Handle leave command
async function handleLeaveCommand(message) {
  const session = activeSessions.get(message.guild.id);

  if (!session) {
    return message.reply("❌ I'm not currently in a voice channel.");
  }

  try {
    // Stop receiving audio
    audioReceiver.stopReceiving(message.guild.id);

    // Clear conversation history
    voiceHandler.clearHistory();

    // Destroy connection
    session.connection.destroy();
    activeSessions.delete(message.guild.id);

    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("👋 Voice Bot Disconnected")
      .setDescription(
        "I've left the voice channel and cleared the conversation history."
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    console.log(`🔇 Left voice channel in ${message.guild.name}`);
  } catch (error) {
    console.error("Error leaving voice channel:", error);
    await message.reply(
      "❌ An error occurred while leaving the voice channel."
    );
  }
}

// Handle clear command
async function handleClearCommand(message) {
  if (!activeSessions.has(message.guild.id)) {
    return message.reply("❌ I'm not currently in a voice channel.");
  }

  try {
    voiceHandler.clearHistory();

    const embed = new EmbedBuilder()
      .setColor("#ffff00")
      .setTitle("🧹 Conversation Cleared")
      .setDescription(
        "I've cleared our conversation history. Our next interaction will start fresh!"
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    console.log(`🧹 Cleared conversation history in ${message.guild.name}`);
  } catch (error) {
    console.error("Error clearing conversation:", error);
    await message.reply(
      "❌ An error occurred while clearing the conversation."
    );
  }
}

// Handle help command
async function handleHelpCommand(message) {
  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("🤖 Discord Voice Bot Help")
    .setDescription(
      "A bot that can join voice channels, transcribe speech, and respond with AI-generated voice."
    )
    .addFields(
      {
        name: "🎤 Voice Commands",
        value: `\`${config.prefix}${config.voiceCommand}\` - Join your current voice channel and start listening\n\`${config.prefix}${config.leaveCommand}\` - Leave the voice channel\n\`${config.prefix}${config.clearCommand}\` - Clear conversation history`,
      },
      {
        name: "📋 Other Commands",
        value: `\`${config.prefix}${config.helpCommand}\` - Show this help message`,
      },
      {
        name: "🔧 How it works",
        value:
          "1. Join a voice channel\n2. Use `!voice` to activate the bot\n3. Speak naturally - the bot will transcribe and respond\n4. Use `!leave` when done or `!clear` to reset conversation",
      },
      {
        name: "⚠️ Requirements",
        value:
          "• You must be in a voice channel\n• OpenAI API key must be configured\n• Bot needs voice permissions",
      },
      {
        name: "🎯 Features",
        value:
          "• Real-time speech transcription using OpenAI Whisper\n• AI responses using ChatGPT\n• Text-to-speech using OpenAI TTS\n• Conversation memory (last 10 exchanges)\n• Auto-disconnect when channel is empty",
      }
    )
    .setFooter({ text: "Powered by OpenAI Whisper & ChatGPT" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// Set up voice state listener for auto-disconnect
function setupVoiceStateListener(guildId) {
  const session = activeSessions.get(guildId);
  if (!session) return;

  const checkEmptyChannel = () => {
    const channel = session.channel;
    if (
      channel &&
      channel.members.size === 1 &&
      channel.members.has(client.user.id)
    ) {
      // Only bot left in channel
      audioReceiver.stopReceiving(guildId);
      voiceHandler.clearHistory();
      session.connection.destroy();
      activeSessions.delete(guildId);
      console.log(
        `🔇 Auto-disconnected from empty channel in ${session.guild.name}`
      );
    }
  };

  // Check every 30 seconds
  const interval = setInterval(checkEmptyChannel, 30000);

  // Store interval for cleanup
  session.interval = interval;
}

// Handle voice state updates
client.on("voiceStateUpdate", (oldState, newState) => {
  const session = activeSessions.get(newState.guild.id);
  if (!session) return;

  // If bot was moved to a different channel
  if (
    newState.member.id === client.user.id &&
    newState.channelId !== session.channel.id
  ) {
    session.channel = newState.channel;
    console.log(`🔄 Bot moved to new channel: ${newState.channel.name}`);
  }
});

// Cleanup on bot disconnect
client.on("disconnect", () => {
  console.log("🔌 Bot disconnected, cleaning up...");
  activeSessions.forEach((session, guildId) => {
    if (session.interval) clearInterval(session.interval);
    if (session.connection) session.connection.destroy();
    audioReceiver.stopReceiving(guildId);
  });
  activeSessions.clear();
  voiceHandler.clearHistory();
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down bot...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down bot...");
  client.destroy();
  process.exit(0);
});
