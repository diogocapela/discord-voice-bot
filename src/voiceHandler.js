const { OpenAI } = require("openai");
const { createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");

class VoiceHandler {
  constructor(openaiClient) {
    this.openai = openaiClient;
    this.audioPlayer = null;
    this.isProcessing = false;
    this.conversationHistory = [];
    this.maxHistoryLength = 10;
  }

  setAudioPlayer(player) {
    this.audioPlayer = player;
  }

  // Process incoming audio and generate response
  async processAudio(audioBuffer, session) {
    if (this.isProcessing) {
      console.log("⏳ Already processing audio, skipping...");
      return;
    }

    this.isProcessing = true;

    try {
      // Step 1: Transcribe audio using Whisper
      const transcription = await this.transcribeAudio(audioBuffer);
      if (!transcription || transcription.trim() === "") {
        console.log("🔇 No speech detected");
        this.isProcessing = false;
        return;
      }

      console.log(`🎤 Transcribed: "${transcription}"`);

      // Check if the message starts with trigger phrase
      const triggerPhrases = ["bom dia", "boa tarde", "boa noite"];
      const lowerTranscription = transcription.toLowerCase().trim();

      const isTriggered = triggerPhrases.some((phrase) =>
        lowerTranscription.startsWith(phrase)
      );

      if (!isTriggered) {
        console.log("🤐 No trigger phrase detected, not responding");
        this.isProcessing = false;
        return;
      }

      // Remove trigger phrase from the message
      let cleanMessage = transcription;
      for (const phrase of triggerPhrases) {
        if (lowerTranscription.startsWith(phrase)) {
          cleanMessage = transcription.substring(phrase.length).trim();
          break;
        }
      }

      console.log(`🎯 Trigger detected! Processing: "${cleanMessage}"`);

      // Step 2: Generate response using ChatGPT
      const response = await this.generateResponse(cleanMessage, session);
      if (!response) {
        console.log("❌ Failed to generate response");
        this.isProcessing = false;
        return;
      }

      console.log(`🤖 Response: "${response}"`);

      // Step 3: Convert response to speech
      await this.speakResponse(response, session);
    } catch (error) {
      console.error("Error processing audio:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Transcribe audio using OpenAI Whisper
  async transcribeAudio(audioBuffer) {
    try {
      // Save audio buffer to temporary file
      const tempFile = path.join(__dirname, "temp_audio.wav");
      fs.writeFileSync(tempFile, audioBuffer);

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: "gpt-4o-mini-transcribe",
        language: "pt",
        response_format: "text",
      });

      // Clean up temp file
      fs.unlinkSync(tempFile);

      return transcription;
    } catch (error) {
      console.error("Error transcribing audio:", error);
      return null;
    }
  }

  // Generate response using ChatGPT
  async generateResponse(userMessage, session) {
    try {
      // Add user message to conversation history
      this.conversationHistory.push({
        role: "user",
        content: userMessage,
      });

      // Keep conversation history manageable
      if (this.conversationHistory.length > this.maxHistoryLength) {
        this.conversationHistory = this.conversationHistory.slice(
          -this.maxHistoryLength
        );
      }

      const messages = [
        {
          role: "system",
          content: `You are a helpful AI assistant in a Discord voice channel. 
                    Keep your responses concise and conversational. 
                    You're speaking to users in a voice chat, so keep responses under 100 words when possible.
                    Be friendly, helpful, and engaging.`,
        },
        ...this.conversationHistory,
      ];

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;

      // Add AI response to conversation history
      this.conversationHistory.push({
        role: "assistant",
        content: response,
      });

      return response;
    } catch (error) {
      console.error("Error generating response:", error);
      return null;
    }
  }

  // Convert text to speech using OpenAI TTS
  async speakResponse(text, session) {
    try {
      const speechFile = path.join(__dirname, "temp_speech.mp3");

      const mp3 = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(speechFile, buffer);

      // Create audio resource and play
      const resource = createAudioResource(speechFile, {
        inputType: "mp3",
      });

      if (this.audioPlayer) {
        this.audioPlayer.play(resource);

        // Clean up file after playback
        this.audioPlayer.once(AudioPlayerStatus.Idle, () => {
          try {
            fs.unlinkSync(speechFile);
          } catch (error) {
            console.error("Error cleaning up speech file:", error);
          }
        });
      }
    } catch (error) {
      console.error("Error generating speech:", error);
    }
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
  }

  // Get conversation history
  getHistory() {
    return this.conversationHistory;
  }
}

module.exports = VoiceHandler;
