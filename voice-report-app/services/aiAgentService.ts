// services/aiAgentService.ts - COMPLETE FIXED VERSION WITH TYPESCRIPT CORRECTIONS
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

export class AIAgentService {
  private static instance: AIAgentService;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  
  // NEW: Connection caching to prevent repeated connection tests
  private static workingBackendUrl: string | null = null;
  private static lastConnectionTest: number = 0;
  private static readonly CONNECTION_CACHE_DURATION = 60000; // 1 minute

  static getInstance(): AIAgentService {
    if (!AIAgentService.instance) {
      AIAgentService.instance = new AIAgentService();
    }
    return AIAgentService.instance;
  }

  async startListening(): Promise<Audio.Recording> {
    // Request permissions
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Microphone permission denied');
    }

    // Set audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // FIXED: Use the correct preset that matches your working Recorder
    // This is the safest approach - use the preset that already works
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    this.recording = recording;
    console.log('✅ AI Agent recording started with HIGH_QUALITY preset');
    return recording;
  }

  async stopListening(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      console.log('✅ AI Agent recording stopped successfully');
      console.log('📁 AI Agent audio URI:', uri);
      
      this.recording = null;
      return uri;
    } catch (error) {
      console.error('❌ Error stopping AI agent recording:', error);
      this.recording = null;
      return null;
    }
  }

  // NEW: Cached backend connection to avoid repeated testing
  private async getWorkingBackend(): Promise<string | null> {
    const now = Date.now();
    
    // Return cached URL if still valid (within 1 minute)
    if (AIAgentService.workingBackendUrl && 
        (now - AIAgentService.lastConnectionTest) < AIAgentService.CONNECTION_CACHE_DURATION) {
      console.log(`🔄 Using cached backend: ${AIAgentService.workingBackendUrl}`);
      return AIAgentService.workingBackendUrl;
    }

    console.log('🔍 Testing backend connections for AI Agent...');
    AIAgentService.workingBackendUrl = await this.findWorkingBackend();
    AIAgentService.lastConnectionTest = now;
    
    return AIAgentService.workingBackendUrl;
  }

  private async findWorkingBackend(): Promise<string | null> {
    for (const url of API_CONFIG.BACKEND_URLS) {
      try {
        console.log(`Testing AI Agent connection to: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VoiceReportApp/1.0',
            'ngrok-skip-browser-warning': 'true'
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ AI Agent found working backend at ${url}`);
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

  async processVoiceCommand(
    audioUri: string, 
    screenContext: ScreenContext
  ): Promise<VoiceCommandResponse> {
    try {
      // IMPROVED: Validate audio file first
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('📁 AI Agent audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      // Check minimum file size (avoid processing very short recordings)
      if (fileInfo.size && fileInfo.size < 1000) {
        throw new Error('Audio recording too short - please speak longer');
      }

      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available');
      }

      console.log(`🎙️ AI Agent processing voice command from: ${audioUri}`);
      console.log(`📁 Audio file size: ${fileInfo.size} bytes`);

      // Convert audio to base64
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📊 AI Agent base64 audio length: ${base64Audio.length} characters`);

      // Determine audio format from file extension
      const format = audioUri.split('.').pop()?.toLowerCase() || 'm4a';

      const payload = {
        audio: base64Audio,
        format: format,
        screenContext: screenContext
      };

      console.log(`🌐 Sending AI Agent request to: ${workingBackendUrl}/voice-command`);

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
        console.error(`❌ Voice command API error: ${response.status} - ${errorText}`);
        
        // Provide more specific error messages based on status code
        if (response.status === 400) {
          throw new Error('Invalid audio format or data. Please try again.');
        } else if (response.status === 500) {
          throw new Error('Server processing error. Please try again.');
        } else if (response.status === 503) {
          throw new Error('Service temporarily unavailable. Please try again.');
        } else {
          throw new Error(`Voice command failed with status: ${response.status}`);
        }
      }

      const result = await response.json();
      console.log('✅ AI Agent voice command processed successfully');
      console.log('📋 AI Agent response:', result);
      
      return result as VoiceCommandResponse;

    } catch (error) {
      console.error('❌ AI Agent voice command processing failed:', error);
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('Audio file does not exist')) {
          throw new Error('Recording failed. Please try again.');
        } else if (error.message.includes('too short')) {
          throw new Error('Please speak for a longer duration.');
        } else if (error.message.includes('No backend server')) {
          throw new Error('Cannot connect to server. Check your internet connection.');
        } else if (error.message.includes('Invalid audio format')) {
          throw new Error('Audio format error. Please try recording again.');
        }
      }
      
      throw new Error('Failed to process voice command. Please try again.');
    }
  }

  async playTTSResponse(text: string): Promise<void> {
    try {
      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available for TTS');
      }

      console.log(`🔊 AI Agent generating TTS for: "${text.substring(0, 50)}..."`);

      // FIXED: Use AbortController properly with fetch (no timeout in RequestInit)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`${workingBackendUrl}/text-to-speech`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ text: text.substring(0, 500) }), // Limit text length
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ TTS API error: ${response.status} - ${errorText}`);
        throw new Error(`TTS failed with status: ${response.status}`);
      }

      // Get audio data as array buffer
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = this.arrayBufferToBase64(audioBuffer);
      
      console.log(`📁 AI Agent TTS audio received: ${audioBuffer.byteLength} bytes`);
      
      // Create temporary file for audio playback
      const tempUri = `${FileSystem.cacheDirectory}ai_agent_tts_${Date.now()}.mp3`;
      
      await FileSystem.writeAsStringAsync(tempUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`🎵 AI Agent playing TTS audio from: ${tempUri}`);

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { shouldPlay: true }
      );
      
      this.sound = sound;
      
      // FIXED: Better type handling for playback status
      return new Promise<void>((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              console.log('🎵 AI Agent TTS playback completed');
              sound.unloadAsync(); // Clean up
              resolve();
            } else if (!status.isLoaded) {
              // Handle error case - when isLoaded becomes false, it usually means an error
              console.error('🔇 AI Agent TTS playback error: Audio failed to load');
              sound.unloadAsync(); // Clean up
              reject(new Error('Audio playback failed'));
            }
          }
        });

        // Fallback timeout in case status update doesn't fire
        setTimeout(() => {
          console.log('🕐 TTS playback timeout, resolving anyway');
          sound.unloadAsync();
          resolve();
        }, 10000);
      });

    } catch (error) {
      console.error('❌ AI Agent TTS failed:', error);
      throw new Error('Text-to-speech failed');
    }
  }

  // Helper function to convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // NEW: Health check method (FIXED: Removed timeout from fetch)
  async healthCheck(): Promise<boolean> {
    try {
      const workingUrl = await this.getWorkingBackend();
      if (!workingUrl) return false;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${workingUrl}/ai-agent/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('AI Agent health check failed:', error);
      return false;
    }
  }

  // Clean up resources
  async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        console.warn('⚠️ Error cleaning up recording:', error);
      }
      this.recording = null;
    }

    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.warn('⚠️ Error cleaning up sound:', error);
      }
      this.sound = null;
    }
  }

  // NEW: Reset connection cache (useful for debugging)
  static resetConnectionCache(): void {
    AIAgentService.workingBackendUrl = null;
    AIAgentService.lastConnectionTest = 0;
    console.log('🔄 AI Agent connection cache reset');
  }
}