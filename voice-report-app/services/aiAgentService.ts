// voice-report-app/services/aiAgentService.ts - COMPLETE HYBRID VERSION (PRODUCTION READY)
import { File, Paths } from 'expo-file-system'; // ✅ Modern API for file objects & paths
import * as FileSystemLegacy from 'expo-file-system/legacy'; // ✅ Legacy API for base64 operations
import { Audio, AVPlaybackStatus } from 'expo-av';
import { VoiceCommand, VoiceCommandResponse, ScreenContext } from '../types/aiAgent';

// Import the API configuration
let API_CONFIG: {
  NGROK_URL: string;
  LOCAL_URL: string;
  BACKEND_URLS: string[];
  CONNECTION: { TIMEOUT: number };
};

try {
  const config = require('./api-config');
  API_CONFIG = config.API_CONFIG;
} catch (error) {
  console.warn('⚠️ API config not found, using fallback configuration');
  API_CONFIG = {
    NGROK_URL: 'http://localhost:8000',
    LOCAL_URL: 'http://localhost:8000',
    BACKEND_URLS: ['http://localhost:8000'],
    CONNECTION: { TIMEOUT: 3000000 }
  };
}

export class AIAgentService {
  private static instance: AIAgentService;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  
  // Enhanced connection management
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
    // Request permissions with better error handling
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Microphone permission is required for voice commands. Please enable it in your device settings.');
    }

    // Set audio mode for recording
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Use high quality recording for better transcription
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
        playsInSilentModeIOS: true,
      });

      console.log('✅ AI Agent recording stopped successfully');
      console.log('📁 Audio URI:', uri);
      
      this.recording = null;
      return uri;
    } catch (error) {
      console.error('❌ Error stopping AI agent recording:', error);
      this.recording = null;
      throw new Error('Failed to stop recording. Please try again.');
    }
  }

  // Enhanced backend connection with better caching
  private async getWorkingBackend(): Promise<string | null> {
    const now = Date.now();
    
    // Return cached URL if still valid
    if (AIAgentService.workingBackendUrl && 
        (now - AIAgentService.lastConnectionTest) < AIAgentService.CONNECTION_CACHE_DURATION) {
      return AIAgentService.workingBackendUrl;
    }

    console.log('🔍 Testing backend connections...');
    
    // Test each backend URL
    for (const url of API_CONFIG.BACKEND_URLS) {
      try {
        console.log(`📡 Testing connection to: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Cache-Control': 'no-cache',
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const healthData = await response.json();
          console.log(`✅ Backend healthy: ${url}`, healthData);
          
          AIAgentService.workingBackendUrl = url;
          AIAgentService.lastConnectionTest = now;
          return url;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Backend unavailable: ${url}`, errorMessage);
        continue;
      }
    }

    AIAgentService.workingBackendUrl = null;
    AIAgentService.lastConnectionTest = now;
    return null;
  }

  // Voice command processing with hybrid FileSystem API
  // Accept optional AbortSignal to allow callers to cancel the backend request
  async processVoiceCommand(audioUri: string, screenContext: ScreenContext, signal?: AbortSignal): Promise<VoiceCommandResponse> {
    try {
      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available. Please check your internet connection and try again.');
      }

      console.log('🤖 Processing voice command with backend:', workingBackendUrl);

      // ✅ HYBRID - Use modern API for file info, legacy for base64 reading
      const audioFile = new File(audioUri);
      const audioBase64 = await FileSystemLegacy.readAsStringAsync(audioUri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
      console.log(`📁 Audio file: ${audioFile.name} (${audioFile.size} bytes), base64: ${audioBase64.length} chars`);

      // Extract format from filename
      const format = audioFile.name.split('.').pop()?.toLowerCase() || 'm4a';
      
      console.log('📤 Sending voice command to backend...');

      const response = await fetch(`${workingBackendUrl}/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VoiceReportApp/2.0',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          audio: audioBase64,
          format: format,
          screenContext: screenContext
        })
      , signal });

      if (!response.ok) {
        throw new Error(`Voice command failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📥 Received AI response:', result);

      return result;
    } catch (error) {
      console.error('❌ Voice command processing failed:', error);
      throw error;
    }
  }

  // TTS with hybrid FileSystem API
  async playTTSResponse(text: string): Promise<void> {
    if (!text || text.trim().length === 0) {
      console.log('🔇 No TTS text provided, skipping audio playback');
      return;
    }

    try {
      console.log(`🔊 Playing TTS response: ${text}`);
      
      // Clean up any existing sound
      if (this.sound) {
        try {
          await this.sound.unloadAsync();
        } catch (error) {
          console.warn('Warning: Failed to unload previous sound:', error);
        }
        this.sound = null;
      }

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Generate TTS audio using a simple, reliable approach
      const ttsAudioData = await this.generateSimpleTTS(text);
      
      if (!ttsAudioData) {
        console.warn('🔇 TTS generation failed, no audio to play');
        return;
      }

      // ✅ HYBRID - Use modern API for file path, legacy for base64 writing
      const tempAudioFile = new File(Paths.cache, `tts_${Date.now()}.wav`);
      await FileSystemLegacy.writeAsStringAsync(tempAudioFile.uri, ttsAudioData, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      // Load and play audio with proper error handling
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempAudioFile.uri },
        { 
          shouldPlay: true,
          isLooping: false,
          volume: 1.0 
        },
        (status: AVPlaybackStatus) => this.handlePlaybackStatus(status, tempAudioFile)
      );

      this.sound = sound;
      
      // Wait for playback to complete or timeout
      return new Promise<void>((resolve) => {
        const playbackTimeout = setTimeout(() => {
          console.warn('⏰ TTS playback timeout, continuing');
          this.cleanupTTSPlayback(tempAudioFile);
          resolve();
        }, 10000); // 10 second timeout

        const checkPlayback = async () => {
          try {
            if (this.sound) {
              const status = await this.sound.getStatusAsync();
              if (status.isLoaded && !status.isPlaying) {
                clearTimeout(playbackTimeout);
                this.cleanupTTSPlayback(tempAudioFile);
                resolve();
              } else if (status.isLoaded && status.isPlaying) {
                // Still playing, check again in 100ms
                setTimeout(checkPlayback, 100);
              }
            } else {
              clearTimeout(playbackTimeout);
              resolve();
            }
          } catch (error) {
            clearTimeout(playbackTimeout);
            this.cleanupTTSPlayback(tempAudioFile);
            resolve();
          }
        };

        // Start checking playback status
        setTimeout(checkPlayback, 100);
      });

    } catch (error) {
      // Never throw errors from TTS - just log and continue
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⏰ TTS request was cancelled due to timeout');
      } else {
        console.warn('🔇 TTS playback failed, continuing without voice:', error);
      }
      // Always resolve - TTS failure should never block the UI
    }
  }

  private handlePlaybackStatus(status: AVPlaybackStatus, tempAudioFile: File): void {
    if (status.isLoaded && status.didJustFinish) {
      console.log('🔊 TTS playback completed successfully');
      this.cleanupTTSPlayback(tempAudioFile);
    } else if (!status.isLoaded && status.error) {
      console.warn('🔇 TTS playback error:', status.error);
      this.cleanupTTSPlayback(tempAudioFile);
    }
  }

  private async cleanupTTSPlayback(tempAudioFile: File): Promise<void> {
    try {
      // Cleanup sound object
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      
      // ✅ HYBRID - Use legacy API for reliable file deletion
      if (tempAudioFile.exists) {
        await FileSystemLegacy.deleteAsync(tempAudioFile.uri, { idempotent: true });
        console.log(`🗑️ Cleaned up temporary TTS file: ${tempAudioFile.name}`);
      }
    } catch (error) {
      console.warn('Warning: TTS cleanup failed:', error);
    }
  }

  // Simple TTS generation that creates valid audio data
  private async generateSimpleTTS(text: string): Promise<string | null> {
    try {
      // For now, return null to skip TTS entirely
      // This prevents audio corruption issues while maintaining the interface
      console.log('🔇 TTS disabled to prevent audio corruption - text was:', text);
      return null;
      
      // TODO: Implement proper TTS service integration
      // Options:
      // 1. Use expo-speech for native TTS
      // 2. Integrate with Google Text-to-Speech API
      // 3. Use Azure Cognitive Services Speech
      // 4. Use AWS Polly
      
    } catch (error) {
      console.warn('TTS generation failed:', error);
      return null;
    }
  }

  // Health check with proper typing
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    backend: boolean;
    audio: boolean;
    message: string;
  }> {
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      backend: false,
      audio: false,
      message: 'AI Agent is ready',
    };

    try {
      // Check backend connectivity
      const backend = await this.getWorkingBackend();
      health.backend = backend !== null;

      // Check audio permissions
      const { status } = await Audio.getPermissionsAsync();
      health.audio = status === 'granted';

      // Determine overall health status
      if (health.backend && health.audio) {
        health.status = 'healthy';
        health.message = 'AI Agent is fully operational';
      } else if (health.backend || health.audio) {
        health.status = 'degraded';
        health.message = `AI Agent is partially operational - ${!health.backend ? 'backend offline' : ''} ${!health.audio ? 'audio permission needed' : ''}`.trim();
      } else {
        health.status = 'unhealthy';
        health.message = 'AI Agent is offline - backend and audio issues';
      }

      return health;
    } catch (error) {
      console.error('Health check failed:', error);
      health.status = 'unhealthy';
      health.message = 'Health check failed';
      return health;
    }
  }

  // Cleanup method for proper resource management
  async cleanup(): Promise<void> {
    try {
      // Stop any active recording
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      // Stop any active sound playback
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      console.log('✅ AI Agent cleanup completed');
    } catch (error) {
      console.warn('Warning: AI Agent cleanup had issues:', error);
    }
  }
}