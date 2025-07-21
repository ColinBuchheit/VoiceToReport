// services/aiAgentService.ts - Fixed TypeScript Errors
import * as FileSystem from 'expo-file-system';
import { Audio, AVPlaybackStatus } from 'expo-av';
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
  
  // Enhanced connection management
  private static workingBackendUrl: string | null = null;
  private static lastConnectionTest: number = 0;
  private static readonly CONNECTION_CACHE_DURATION = 60000; // 1 minute
  
  // Conversation context for better continuity
  private conversationHistory: Array<{
    userInput: string;
    agentResponse: string;
    timestamp: number;
    screenContext: string;
  }> = [];
  
  // Agent capabilities for self-explanation
  private readonly capabilities = {
    field_updates: "I can update any field in your report by voice - just say something like 'set location to downtown office' or 'change the task description'",
    wording_help: "I can help improve the wording of your reports. Ask me 'how does that sound?' or 'can you make this sound more professional?'",
    questions: "You can ask me what I can do, check my capabilities, or just have a conversation about your work",
    voice_control: "I work completely hands-free - perfect when you're driving or have your hands full on a job site",
    context_aware: "I understand which screen you're on and what fields are available, so I know what you're talking about"
  };

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

    // Set audio mode for recording - simplified to avoid deprecated constants
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
    console.log('✅ Bear AI Agent recording started with HIGH_QUALITY preset');
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

      console.log('✅ Bear AI Agent recording stopped successfully');
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

        const response = await fetch(`${url}/ai-agent/health`, {
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

  // Enhanced voice command processing with conversation context
  async processVoiceCommand(audioUri: string, screenContext: ScreenContext): Promise<VoiceCommandResponse> {
    try {
      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available. Please check your internet connection and try again.');
      }

      console.log(`🤖 Bear AI processing command on ${screenContext.screenName} screen`);

      // Read and validate audio file
      const audioInfo = await FileSystem.getInfoAsync(audioUri);
      if (!audioInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      if (audioInfo.size && audioInfo.size < 500) {
        throw new Error('Recording too short - please speak for a few seconds');
      }

      // Convert audio to base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📤 Sending ${audioBase64.length} character audio to Bear AI`);

      // Enhanced screen context with conversation history
      const enhancedContext = {
        ...screenContext,
        conversationHistory: this.getRecentConversationContext(),
        agentCapabilities: Object.keys(this.capabilities),
        timestamp: new Date().toISOString(),
      };

      // Send request to enhanced backend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${workingBackendUrl}/voice-command`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          audio: audioBase64,
          screenContext: enhancedContext,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Sam AI API error: ${response.status} - ${errorText}`);
        throw new Error(`AI service error: ${response.status}`);
      }

      const result: VoiceCommandResponse = await response.json();
      console.log('📋 Bear AI response:', result);

      // Store conversation for context
      this.addToConversationHistory(
        result.clarification || 'Voice command', // We don't have the exact transcription here
        result.ttsText,
        screenContext.screenName
      );

      // Validate response format
      if (!result.action || !result.confirmation || !result.ttsText) {
        throw new Error('Invalid response format from AI service');
      }

      return result;

    } catch (error) {
      console.error('❌ Sam AI command processing failed:', error);
      
      // Enhanced error handling with specific messages
      if (error instanceof Error) {
        if (error.message.includes('abort') || error.message.includes('timeout')) {
          throw new Error('Request timed out. Please check your internet connection and try again.');
        } else if (error.message.includes('too short')) {
          throw new Error('Please speak for a longer duration and try again.');
        } else if (error.message.includes('No backend server')) {
          throw new Error('Cannot connect to Bear AI service. Please check your internet connection.');
        } else if (error.message.includes('Invalid audio format')) {
          throw new Error('Audio format error. Please try recording again.');
        }
      }
      
      throw new Error('Failed to process voice command. Please try again.');
    }
  }

  // Enhanced TTS playback with proper TypeScript types
  async playTTSResponse(text: string): Promise<void> {
    try {
      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available for text-to-speech');
      }

      console.log(`🔊 Bear AI generating speech: "${text.substring(0, 50)}..."`);

      // Sanitize and limit text for TTS
      const cleanText = text.trim().substring(0, 500);
      if (!cleanText) {
        throw new Error('No text to speak');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${workingBackendUrl}/text-to-speech`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ text: cleanText }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ TTS API error: ${response.status} - ${errorText}`);
        throw new Error(`TTS failed with status: ${response.status}`);
      }

      // Get audio data and save to temporary file
      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = this.arrayBufferToBase64(audioBuffer);
      
      console.log(`📁 Bear AI received TTS audio: ${audioBuffer.byteLength} bytes`);
      
      const tempUri = `${FileSystem.cacheDirectory}bear_ai_tts_${Date.now()}.mp3`;
      
      await FileSystem.writeAsStringAsync(tempUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`🎵 Playing Bear AI response from: ${tempUri}`);

      // Enhanced audio playback with proper type handling
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { 
          shouldPlay: true,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );
      
      this.sound = sound;
      
      return new Promise<void>((resolve, reject) => {
        let resolved = false;
        
        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            sound.unloadAsync().catch(() => {}); // Ignore cleanup errors
            // Clean up temp file
            FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
          }
        };

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!resolved) {
            if (status.isLoaded) {
              if (status.didJustFinish) {
                console.log('🎵 Bear AI speech completed successfully');
                cleanup();
                resolve();
              }
            } else {
              // Handle error case - when isLoaded becomes false, it usually means an error
              console.error('🔇 Bear AI speech playback error: Audio failed to load');
              cleanup();
              reject(new Error('Audio playback failed'));
            }
          }
        });

        // Fallback timeout
        setTimeout(() => {
          if (!resolved) {
            console.log('🕐 Bear AI speech timeout, completing anyway');
            cleanup();
            resolve();
          }
        }, 15000);
      });

    } catch (error) {
      console.error('❌ Bear AI TTS failed:', error);
      throw new Error('Text-to-speech failed. The message will be shown as text instead.');
    }
  }

  // Conversation history management
  private addToConversationHistory(userInput: string, agentResponse: string, screenContext: string) {
    this.conversationHistory.push({
      userInput,
      agentResponse,
      timestamp: Date.now(),
      screenContext,
    });

    // Keep only recent conversation (last 5 exchanges)
    if (this.conversationHistory.length > 5) {
      this.conversationHistory = this.conversationHistory.slice(-5);
    }
  }

  private getRecentConversationContext(): string[] {
    return this.conversationHistory
      .slice(-3) // Last 3 exchanges
      .map(entry => `User: "${entry.userInput}" | Sam: "${entry.agentResponse}"`);
  }

  // Get agent capabilities for self-explanation
  getCapabilities(): Record<string, string> {
    return { ...this.capabilities };
  }

  // Clear conversation history (for privacy/reset)
  clearConversationHistory(): void {
    this.conversationHistory = [];
    console.log('🧹 Bear AI conversation history cleared');
  }

  // Check agent health and capabilities
  async checkHealth(): Promise<{
    status: string;
    capabilities: string[];
    backendAvailable: boolean;
    agentPersona: string;
  }> {
    try {
      const workingBackendUrl = await this.getWorkingBackend();
      
      if (!workingBackendUrl) {
        return {
          status: 'offline',
          capabilities: [],
          backendAvailable: false,
          agentPersona: 'Bear AI Assistant (Offline)',
        };
      }

      const response = await fetch(`${workingBackendUrl}/ai-agent/health`);
      const healthData = await response.json();

      return {
        status: healthData.status || 'unknown',
        capabilities: healthData.capabilities || Object.keys(this.capabilities),
        backendAvailable: true,
        agentPersona: healthData.agent_persona || 'Bear - Field Technician Assistant',
      };

    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'error',
        capabilities: [],
        backendAvailable: false,
        agentPersona: 'Bear AI Assistant (Error)',
      };
    }
  }

  // Utility: Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Enhanced cleanup method
  async cleanup(): Promise<void> {
    try {
      // Stop any ongoing recording
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      // Stop any playing sound
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      console.log('🧹 Bear AI Agent cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }

  // Test method for debugging
  async testConnectivity(): Promise<{
    backendReachable: boolean;
    audioPermissions: boolean;
    lastError?: string;
  }> {
    try {
      // Test backend connectivity
      const backendUrl = await this.getWorkingBackend();
      const backendReachable = !!backendUrl;

      // Test audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      const audioPermissions = status === 'granted';

      return {
        backendReachable,
        audioPermissions,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        backendReachable: false,
        audioPermissions: false,
        lastError: errorMessage,
      };
    }
  }
}

export default AIAgentService;