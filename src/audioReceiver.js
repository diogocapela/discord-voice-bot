const { EndBehaviorType, VoiceConnectionStatus } = require("@discordjs/voice");
const prism = require("prism-media");
const { pipeline } = require("node:stream");
const { promisify } = require("node:util");
const fs = require("fs");
const path = require("path");

class AudioReceiver {
  constructor(voiceHandler, client) {
    this.voiceHandler = voiceHandler;
    this.client = client;
    this.receivers = new Map();
    this.audioBuffers = new Map();
    this.isRecording = new Map();
    this.silenceThreshold = 1000; // 1 second of silence
    this.minAudioLength = 500; // Minimum 500ms of audio
    this.maxAudioLength = 10000; // Maximum 10 seconds of audio
  }

  // Start receiving audio from a voice connection
  startReceiving(connection, guildId) {
    if (this.receivers.has(guildId)) {
      console.log("🎤 Already receiving audio for this guild");
      return;
    }

    try {
      const receiver = connection.receiver;
      const audioBuffer = [];
      let lastAudioTime = Date.now();
      let recordingStartTime = null;

      this.audioBuffers.set(guildId, audioBuffer);
      this.receivers.set(guildId, receiver);
      this.isRecording.set(guildId, false);

      // Listen for speaking state updates
      connection.on("stateChange", (oldState, newState) => {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          this.stopReceiving(guildId);
        }
      });

      // Process audio from each user
      receiver.speaking.on("start", (userId) => {
        const user = this.client.users.cache.get(userId);
        if (user && !user.bot) {
          console.log(`🎤 ${user.username} started speaking`);
          this.startRecording(guildId, userId);
        }
      });

      receiver.speaking.on("end", (userId) => {
        const user = this.client.users.cache.get(userId);
        if (user && !user.bot) {
          console.log(`🔇 ${user.username} stopped speaking`);
          this.stopRecording(guildId, userId);
        }
      });

      console.log(`🎤 Started receiving audio for guild ${guildId}`);
    } catch (error) {
      console.error("Error starting audio receiver:", error);
    }
  }

  // Start recording audio from a specific user
  startRecording(guildId, userId) {
    if (this.isRecording.get(guildId)) {
      return; // Already recording
    }

    const receiver = this.receivers.get(guildId);
    if (!receiver) return;

    try {
      this.isRecording.set(guildId, true);
      const audioBuffer = this.audioBuffers.get(guildId);
      audioBuffer.length = 0; // Clear previous audio
      const recordingStartTime = Date.now();

      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100,
        },
      });

      const decoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000,
      });

      const audioChunks = [];
      let isProcessing = false;

      // Process audio chunks
      decoder.on("data", (chunk) => {
        audioChunks.push(chunk);
      });

      // Handle end of audio stream
      decoder.on("end", async () => {
        if (isProcessing) return;
        isProcessing = true;

        const recordingDuration = Date.now() - recordingStartTime;

        if (
          recordingDuration >= this.minAudioLength &&
          recordingDuration <= this.maxAudioLength
        ) {
          console.log(
            `📝 Processing ${recordingDuration}ms of audio from user ${userId}`
          );

          // Combine all audio chunks
          const combinedAudio = Buffer.concat(audioChunks);

          // Process the audio
          await this.processAudioChunk(combinedAudio, guildId, userId);
        } else {
          console.log(
            `⏭️ Skipping audio: too short (${recordingDuration}ms) or too long`
          );
        }

        this.isRecording.set(guildId, false);
      });

      // Pipe opus stream to decoder
      pipeline(opusStream, decoder, (err) => {
        if (err) {
          console.error("Error in audio pipeline:", err);
          this.isRecording.set(guildId, false);
        }
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      this.isRecording.set(guildId, false);
    }
  }

  // Stop recording audio
  stopRecording(guildId, userId) {
    // This is handled by the 'end' event of the opus stream
    // We just need to ensure we're not recording
    this.isRecording.set(guildId, false);
  }

  // Process audio chunk
  async processAudioChunk(audioBuffer, guildId, userId) {
    try {
      // Save audio to temporary file for Whisper
      const tempFile = path.join(
        __dirname,
        `temp_audio_${guildId}_${userId}.wav`
      );

      // Convert audio to format suitable for Whisper
      const convertedAudio = await this.convertAudioForWhisper(audioBuffer);
      fs.writeFileSync(tempFile, convertedAudio);

      // Process with voice handler
      await this.voiceHandler.processAudio(convertedAudio, { guildId, userId });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (error) {
        console.error("Error cleaning up temp audio file:", error);
      }
    } catch (error) {
      console.error("Error processing audio chunk:", error);
    }
  }

  // Convert audio buffer to format suitable for Whisper
  async convertAudioForWhisper(audioBuffer) {
    // Convert raw PCM data to WAV format
    const sampleRate = 48000;
    const channels = 2;
    const bitDepth = 16;

    // WAV header
    const wavHeader = Buffer.alloc(44);

    // RIFF header
    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(36 + audioBuffer.length, 4);
    wavHeader.write("WAVE", 8);

    // fmt chunk
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16); // chunk size
    wavHeader.writeUInt16LE(1, 20); // audio format (PCM)
    wavHeader.writeUInt16LE(channels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE((sampleRate * channels * bitDepth) / 8, 28); // byte rate
    wavHeader.writeUInt16LE((channels * bitDepth) / 8, 32); // block align
    wavHeader.writeUInt16LE(bitDepth, 34);

    // data chunk
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(audioBuffer.length, 40);

    // Combine header and audio data
    return Buffer.concat([wavHeader, audioBuffer]);
  }

  // Stop receiving audio for a guild
  stopReceiving(guildId) {
    const receiver = this.receivers.get(guildId);
    if (receiver) {
      receiver.destroy();
      this.receivers.delete(guildId);
    }

    this.audioBuffers.delete(guildId);
    this.isRecording.delete(guildId);

    console.log(`🔇 Stopped receiving audio for guild ${guildId}`);
  }

  // Check if currently receiving audio
  isReceiving(guildId) {
    return this.receivers.has(guildId);
  }

  // Get recording status
  getRecordingStatus(guildId) {
    return this.isRecording.get(guildId) || false;
  }
}

module.exports = AudioReceiver;
