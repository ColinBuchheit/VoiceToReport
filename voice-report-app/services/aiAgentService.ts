// services/aiAgentService.ts - FIXED TTS ERRORS & REDUCED NOTIFICATIONS
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

  // FIXED: Voice command processing to match exact API format
  async processVoiceCommand(audioUri: string, screenContext: ScreenContext): Promise<VoiceCommandResponse> {
    try {
      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        throw new Error('No backend server available. Please check your internet connection and try again.');
      }

      console.log('🤖 Processing voice command with backend:', workingBackendUrl);

      // Read audio file exactly like the working transcribeAudio function
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📁 Audio file size: ${audioBase64.length} characters (base64)`);

      // Determine audio format from file extension (just like api.ts)
      const format = audioUri.split('.').pop()?.toLowerCase() || 'm4a';

      // FIXED: Use exact same payload format as working transcribeAudio
      const payload = {
        audio: audioBase64,
        format: format,
        screenContext: screenContext,
        conversationHistory: this.conversationHistory.slice(-3) // Last 3 entries
      };

      console.log('📤 Sending voice command to backend...');

      // FIXED: Use AbortController for timeout instead of timeout property
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // FIXED: Send to voice-command endpoint with JSON (not FormData)
      const response = await fetch(`${workingBackendUrl}/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // FIXED: Use JSON like working API
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'VoiceReportApp/1.0',
        },
        body: JSON.stringify(payload), // FIXED: Send JSON payload like working API
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend responded with error:', response.status, errorText);
        
        // Parse error details if available
        let errorDetail = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorText;
        } catch {}
        
        throw new Error(`Backend error: ${response.status} - ${errorDetail}`);
      }

      const result: VoiceCommandResponse = await response.json();
      console.log('📥 Received AI response:', result);

      // Add to conversation history using confirmation field
      const userInput = result.confirmation || 'Unknown command';
      
      this.conversationHistory.push({
        userInput,
        agentResponse: result.confirmation,
        timestamp: Date.now(),
        screenContext: screenContext.screenName,
      });

      // Keep only last 10 conversation entries
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return result;

    } catch (error) {
      console.error('❌ Voice command processing failed:', error);
      
      // Return a fallback response for common errors
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          return this.createErrorResponse('Network connection failed. Please check your internet connection.');
        } else if (error.message.includes('timeout') || error.name === 'AbortError') {
          return this.createErrorResponse('Request timed out. Please try again.');
        } else if (error.message.includes('server') || error.message.includes('backend')) {
          return this.createErrorResponse('Server is currently unavailable. Please try again later.');
        } else if (error.message.includes('422')) {
          return this.createErrorResponse('Audio format not supported. Please try recording again.');
        } else if (error.message.includes('400')) {
          return this.createErrorResponse('Invalid audio data. Please try recording again.');
        }
      }
      
      return this.createErrorResponse('Could not process voice command. Please try again.');
    }
  }

  // Create a standardized error response
  private createErrorResponse(message: string): VoiceCommandResponse {
    return {
      action: 'clarify',
      confidence: 0,
      clarification: message,
      confirmation: message,
      ttsText: message,
      metadata: {
        processingTime: 0,
        modelUsed: 'error',
      },
    };
  }

  // FIXED: Play TTS response with enhanced error handling and shorter timeout
  async playTTSResponse(text: string): Promise<void> {
    try {
      console.log('🔊 Playing TTS response:', text);

      // Clean up any existing sound
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      const workingBackendUrl = await this.getWorkingBackend();
      if (!workingBackendUrl) {
        console.warn('🔇 No backend available for TTS - skipping voice response');
        return;
      }

      // FIXED: Shorter timeout for TTS to prevent blocking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⏰ TTS request timed out, continuing without voice');
        controller.abort();
      }, 8000); // REDUCED: 8 second timeout instead of 15

      // Request TTS audio from backend
      const response = await fetch(`${workingBackendUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ text: text.substring(0, 200) }), // FIXED: Limit text length
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`🔇 TTS request failed: ${response.status} - continuing without voice`);
        return;
      }

      const audioBlob = await response.blob();
      const audioBase64 = await this.blobToBase64(audioBlob);
      
      // Create temporary audio file
      const tempAudioUri = `${FileSystem.documentDirectory}temp_tts_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(tempAudioUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempAudioUri },
        { shouldPlay: true, volume: 1.0 }
      );

      this.sound = sound;

      // FIXED: Shorter timeout for playback completion
      return new Promise<void>((resolve, reject) => {
        const playbackTimeout = setTimeout(() => {
          console.warn('⏰ TTS playback timed out, cleaning up');
          sound.unloadAsync().catch(console.warn);
          FileSystem.deleteAsync(tempAudioUri, { idempotent: true }).catch(console.warn);
          resolve(); // FIXED: Resolve instead of reject to prevent blocking
        }, 10000); // 10 second max playback time

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            clearTimeout(playbackTimeout);
            console.log('✅ TTS playback completed');
            sound.unloadAsync().then(() => {
              // Clean up temp file
              FileSystem.deleteAsync(tempAudioUri, { idempotent: true }).catch(console.warn);
              resolve();
            }).catch(() => {
              // Even if cleanup fails, resolve to prevent blocking
              resolve();
            });
          } else if (status.isLoaded === false) {
            clearTimeout(playbackTimeout);
            console.warn('⚠️ TTS playback failed, continuing anyway');
            FileSystem.deleteAsync(tempAudioUri, { idempotent: true }).catch(console.warn);
            resolve(); // FIXED: Resolve instead of reject
          }
        });
      });

    } catch (error) {
      // FIXED: Never throw errors from TTS - just log and continue
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('⏰ TTS request was cancelled due to timeout');
      } else {
        console.warn('🔇 TTS playback failed, continuing without voice:', error);
      }
      // Always resolve - TTS failure should never block the UI
    }
  }

  // Helper method to convert blob to base64
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
      health.backend = !!backend;

      // Check audio permissions
      const { status } = await Audio.getPermissionsAsync();
      health.audio = status === 'granted';

      // Determine overall status
      if (!health.backend && !health.audio) {
        health.status = 'unhealthy';
        health.message = 'Backend and microphone unavailable';
      } else if (!health.backend) {
        health.status = 'degraded';
        health.message = 'Backend unavailable - voice commands disabled';
      } else if (!health.audio) {
        health.status = 'degraded';
        health.message = 'Microphone permission required';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.message = `Health check failed: ${error}`;
    }

    return health;
  }

  // Get conversation history for debugging
  getConversationHistory() {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearConversationHistory() {
    this.conversationHistory = [];
    console.log('🧹 Conversation history cleared');
  }

  // Get available capabilities
  getCapabilities() {
    return { ...this.capabilities };
  }

  // Cleanup method
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

      console.log('🧹 AI Agent service cleaned up');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }
}