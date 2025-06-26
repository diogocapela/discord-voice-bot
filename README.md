# Discord Voice Bot 🤖🎤

A powerful Discord bot that can join voice channels, transcribe speech using OpenAI's Whisper, generate AI responses using ChatGPT, and reply with AI-generated voice using OpenAI's TTS.

## ✨ Features

- **Voice Channel Integration**: Join any voice channel in your Discord server
- **Real-time Speech Transcription**: Uses OpenAI Whisper to transcribe speech in real-time
- **AI-Powered Responses**: Generates contextual responses using ChatGPT
- **Text-to-Speech**: Converts AI responses to natural-sounding voice using OpenAI TTS
- **Conversation Memory**: Maintains context across multiple exchanges (last 10 messages)
- **Auto-disconnect**: Automatically leaves empty voice channels
- **Error Handling**: Robust error handling for various scenarios
- **Easy Commands**: Simple command system for controlling the bot

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- Discord Bot Token
- OpenAI API Key
- FFmpeg (for audio processing)

### Installation

1. **Clone or download this repository**

   ```bash
   git clone <repository-url>
   cd discord-voice-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` and add your tokens:

   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Run the bot**
   ```bash
   npm start
   ```

## 🔧 Setup Instructions

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Copy the bot token and add it to your `.env` file
5. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
   - Server Members Intent
   - Presence Intent
6. Save changes

### 2. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an account or sign in
3. Generate a new API key
4. Add the key to your `.env` file

### 3. Invite Bot to Your Server

1. In the Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Use Slash Commands
   - Connect
   - Speak
   - Use Voice Activity
   - Read Message History
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 4. Install FFmpeg

**macOS (using Homebrew):**

```bash
brew install ffmpeg
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [FFmpeg official website](https://ffmpeg.org/download.html) or use Chocolatey:

```bash
choco install ffmpeg
```

## 🎮 Usage

### Commands

- `!voice` - Join your current voice channel and start listening
- `!leave` - Leave the voice channel
- `!clear` - Clear conversation history
- `!help` - Show help information

### How to Use

1. **Join a voice channel** in your Discord server
2. **Type `!voice`** in any text channel
3. **Start speaking** - the bot will transcribe your speech and respond with AI-generated voice
4. **Use `!leave`** when you're done or `!clear` to reset the conversation

### Example Interaction

```
User: !voice
Bot: 🎤 Voice Bot Activated
     I've joined #General and I'm ready to listen and respond!

User: [speaks] "What's the weather like today?"
Bot: [transcribes] "What's the weather like today?"
     [responds with voice] "I don't have access to real-time weather data, but I can help you find a weather app or website to check the current conditions in your area!"
```

## 📁 Project Structure

```
discord-voice-bot/
├── index.js              # Main bot file
├── voiceHandler.js       # Handles speech processing and AI responses
├── audioReceiver.js      # Manages audio input from voice channels
├── package.json          # Dependencies and scripts
├── env.example           # Environment variables template
├── .env                  # Your environment variables (create this)
└── README.md            # This file
```

## 🔧 Configuration

### Environment Variables

| Variable         | Description            | Required |
| ---------------- | ---------------------- | -------- |
| `DISCORD_TOKEN`  | Your Discord bot token | Yes      |
| `OPENAI_API_KEY` | Your OpenAI API key    | Yes      |

### Bot Configuration

You can modify the bot behavior by editing the `config` object in `index.js`:

```javascript
const config = {
  prefix: "!", // Command prefix
  voiceCommand: "voice", // Voice activation command
  leaveCommand: "leave", // Leave voice channel command
  helpCommand: "help", // Help command
  clearCommand: "clear", // Clear history command
};
```

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon to automatically restart the bot when files change.

### Debugging

The bot includes comprehensive logging. Check the console output for:

- Connection status
- Audio processing events
- Transcription results
- AI response generation
- Error messages

## ⚠️ Troubleshooting

### Common Issues

1. **Bot can't join voice channel**

   - Ensure the bot has "Connect" and "Speak" permissions
   - Check if the voice channel is full
   - Verify the bot token is correct

2. **No audio transcription**

   - Check your OpenAI API key
   - Ensure you have sufficient API credits
   - Verify FFmpeg is installed correctly

3. **Bot doesn't respond to voice**

   - Make sure you're speaking clearly
   - Check if the bot is muted or deafened
   - Verify the audio receiver is working

4. **High API usage**
   - The bot processes all speech in the channel
   - Consider using `!clear` to reset conversation history
   - Monitor your OpenAI usage dashboard

### Error Messages

- `❌ You need to be in a voice channel` - You must join a voice channel first
- `❌ I'm already active in a voice channel` - Use `!leave` to disconnect first
- `❌ Failed to join the voice channel` - Check permissions and try again

## 📊 API Usage

This bot uses the following OpenAI APIs:

- **Whisper**: For speech-to-text transcription
- **ChatGPT**: For generating AI responses
- **TTS**: For text-to-speech conversion

Monitor your usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API wrapper
- [OpenAI](https://openai.com/) - AI APIs for transcription and generation
- [FFmpeg](https://ffmpeg.org/) - Audio processing

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Ensure all dependencies are installed correctly
4. Verify your API keys and bot permissions

---

**Happy coding! 🎉**
