// services/aiAgentService.ts
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { VoiceCommand, VoiceCommandResponse, ScreenContext } from '../types/aiAgent';

// Import the API configuration
let API_CONFIG: {
  NGROK_URL: string;
  LOCAL_URL: string;
  BACKEND_URLS: string[];
};

try {
  const config = require('./api-config');
  API_CONFIG = config.API_CONFIG;
} catch (error) {
  console.warn('⚠️ API config not found, using fallback configuration');
  API_CONFIG = {
    NGROK_URL: 'http://localhost:8000',
    LOCAL_URL: 'http://localhost:8000',
    BACKEND_URLS: [
      'http://localhost:8000'
    ]
  };
}

// Local implementation of findWorkingBackend for AI Agent
async function findWorkingBackend(): Promise<string | null> {
  console.log('🔍 AI Agent testing backend connectivity...');
  
  for (const url of API_CONFIG.BACKEND_URLS) {
    try {
      console.log(`Testing: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VoiceReportApp/1.0',
          // Add ngrok bypass header
          'ngrok-skip-browser-warning': 'true'
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ AI Agent found backend at ${url}`);
        return url;
      } else {
        console.log(`❌ ${url} returned status ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${url} failed:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log('❌ No working backend found for AI Agent');
  return null;
}

export class AIAgentService {
  private static instance: AIAgentService;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;

  static getInstance(): AIAgentService {
    if (!AIAgentService.instance) {
      AIAgentService.instance = new AIAgentService();
    }
    return AIAgentService.instance;
  }

  async startListening(): Promise<Audio.Recording> {
    // Use EXACT same logic as your working Recorder.tsx
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Microphone permission denied');
    }

    // Use EXACT same audio settings as working Recorder
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Use EXACT same recording preset as working Recorder
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    this.recording = recording;
    console.log('AI Agent recording started successfully');
    return recording;
  }

  async stopListening(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      // Use EXACT same logic as working Recorder
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      // Reset audio mode - EXACT same as working Recorder
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      console.log('AI Agent recording stopped successfully');
      console.log('AI Agent audio URI:', uri);
      
      this.recording = null;
      return uri;
    } catch (error) {
      console.error('Error stopping AI agent recording:', error);
      this.recording = null;
      return null;
    }
  }

  async processVoiceCommand(
    audioUri: string, 
    screenContext: ScreenContext
  ): Promise<VoiceCommandResponse> {
    try {
      const workingBackendUrl = await findWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available');
      }

      console.log(`🎙️ AI Agent processing voice command from: ${audioUri}`);

      // Use EXACT same audio processing as your working API
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📁 AI Agent audio file size: ${base64Audio.length} characters (base64)`);

      const format = audioUri.split('.').pop()?.toLowerCase() || 'm4a';

      const payload = {
        audio: base64Audio,
        format: format,
        screenContext: screenContext
      };

      const response = await fetch(`${workingBackendUrl}/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VoiceReportApp/1.0',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Voice command API error: ${response.status} - ${errorText}`);
        throw new Error(`Voice command failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ AI Agent voice command processed successfully');
      return result as VoiceCommandResponse;

    } catch (error) {
      console.error('AI Agent voice command processing failed:', error);
      throw new Error('Failed to process voice command');
    }
  }

  async playTTSResponse(text: string): Promise<void> {
    try {
      const workingBackendUrl = await findWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available');
      }

      console.log(`🔊 AI Agent generating TTS for: "${text.substring(0, 50)}..."`);

      const response = await fetch(`${workingBackendUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ text: text.substring(0, 500) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`TTS API error: ${response.status} - ${errorText}`);
        throw new Error(`TTS failed: ${response.status}`);
      }

      // Get the response as array buffer (more reliable than blob)
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = this.arrayBufferToBase64(audioBuffer);
      
      console.log(`📁 AI Agent TTS audio received: ${audioBuffer.byteLength} bytes`);
      
      // Create temporary file for audio playback
      const tempUri = `${FileSystem.cacheDirectory}ai_agent_tts_${Date.now()}.mp3`;
      
      await FileSystem.writeAsStringAsync(tempUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`🎵 AI Agent playing TTS audio from: ${tempUri}`);

      // Play the audio using same method as your app
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { shouldPlay: true }
      );
      
      this.sound = sound;
      
      // Handle playback completion
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🔇 AI Agent TTS playback finished');
          sound.unloadAsync();
          FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(console.warn);
          this.sound = null;
        }
      });

      console.log('✅ AI Agent TTS playback started successfully');

    } catch (error) {
      console.error('AI Agent TTS playback failed:', error);
      throw new Error('Failed to play voice response');
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async cleanup(): Promise<void> {
    // Stop any ongoing recording
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.warn('Error cleaning up AI Agent recording:', error);
      }
      this.recording = null;
    }

    // Stop any playing sound
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.warn('Error cleaning up AI Agent sound:', error);
      }
      this.sound = null;
    }
  }
}