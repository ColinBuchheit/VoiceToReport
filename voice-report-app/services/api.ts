// voice-report-app/services/api.ts - CLEAN & FIXED VERSION
import axios, { AxiosError } from 'axios';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { API_CONFIG } from './api-config';
import { TranscriptionResponse, SummaryResponse, EmailResponse, CloseoutSummary, ApiError } from '../types/api';

// =============================================================================
// BACKEND CONNECTION MANAGEMENT
// =============================================================================

let cachedBackendUrl: string | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

async function getWorkingBackend(): Promise<string> {
  const now = Date.now();
  
  // Return cached URL if still fresh
  if (cachedBackendUrl && (now - lastCacheTime) < CACHE_DURATION) {
    return cachedBackendUrl;
  }
  
  console.log('🔍 Testing backend connectivity...');
  
  // Test each backend URL
  for (const url of API_CONFIG.BACKEND_URLS) {
    try {
      console.log(`📡 Testing: ${url}`);
      
      const response = await axios.get(`${url}/health`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VoiceReportApp/2.0',
          'ngrok-skip-browser-warning': 'true',
          'Cache-Control': 'no-cache',
        },
      });
      
      if (response.status === 200) {
        console.log(`✅ Backend healthy: ${url}`);
        cachedBackendUrl = url;
        lastCacheTime = now;
        return url;
      }
    } catch (error) {
      console.log(`❌ Backend failed: ${url}`);
      continue;
    }
  }
  
  cachedBackendUrl = null;
  throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
}

// =============================================================================
// REQUEST CONFIGURATION
// =============================================================================

const createRequestConfig = (timeout: number = 120000) => ({
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'VoiceReportApp/2.0',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout,
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

const handleApiError = (error: any, operation: string): Error => {
  console.error(`❌ ${operation} failed:`, error);
  cachedBackendUrl = null; // Clear cache on error
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    
    // Handle timeout specifically
    if (axiosError.code === 'ECONNABORTED' && axiosError.message.includes('timeout')) {
      return new Error(`${operation} is taking longer than expected. The AI is still processing your request - please wait and try again in a moment.`);
    }
    
    // Handle specific HTTP status codes
    if (axiosError.response?.status === 503) {
      return new Error(`${operation} service unavailable. Please check that OpenAI API is configured correctly.`);
    }
    if (axiosError.response?.status === 400) {
      return new Error(`Invalid request: ${axiosError.response.data?.detail || 'bad request'}`);
    }
    if (axiosError.response?.status === 413) {
      return new Error('File too large. Maximum file size is 25MB.');
    }
    if (axiosError.response?.status === 500) {
      return new Error(`Server error during ${operation}. Please try again.`);
    }
    
    // Handle detailed error responses
    if (axiosError.response?.data?.detail) {
      return new Error(`${operation}: ${axiosError.response.data.detail}`);
    }
    
    // Handle network errors
    if (axiosError.code === 'NETWORK_ERROR' || axiosError.code === 'ECONNREFUSED') {
      return new Error('Network connection failed. Please check your internet connection.');
    }
  }
  
  return new Error(`Failed to ${operation}. Please check your connection and try again.`);
};

// =============================================================================
// CORE API FUNCTIONS
// =============================================================================

/**
 * Transcribe audio file to text using OpenAI Whisper
 * Timeout: 60 seconds
 */
export async function transcribeAudio(audioUri: string): Promise<TranscriptionResponse> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`🎙️ Transcribing audio using: ${workingBackendUrl}`);
    
    // Read audio file
    const audioFile = new File(audioUri);
    const base64Audio = await FileSystemLegacy.readAsStringAsync(audioUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    
    console.log(`📁 Audio file: ${audioFile.name} (${audioFile.size} bytes)`);

    // Extract format from filename
    const format = audioFile.name.split('.').pop()?.toLowerCase() || 'm4a';
    
    const response = await axios.post(
      `${workingBackendUrl}/transcribe`,
      {
        audio: base64Audio,
        format: format,
      },
      createRequestConfig(60000) // 60 seconds for transcription
    );

    console.log('✅ Transcription completed successfully');
    return response.data;
    
  } catch (error) {
    throw handleApiError(error, 'audio transcription');
  }
}

/**
 * Generate structured closeout summary from transcription using GPT
 * Timeout: 180 seconds (3 minutes) - CRITICAL for GPT processing
 */
export async function generateSummary(transcription: string): Promise<CloseoutSummary> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`📊 Generating summary using: ${workingBackendUrl}`);
    console.log(`📝 Transcription length: ${transcription.length} characters`);
    console.log(`⏱️ Using 180 second timeout for GPT processing`);
    
    const response = await axios.post(
      `${workingBackendUrl}/summarize`,
      {
        transcription: transcription
      },
      createRequestConfig(180000) // ⚡ 180 seconds (3 minutes) - CRITICAL FIX
    );

    console.log('✅ Summary generation completed successfully');
    
    // Handle both response formats
    return response.data.summary || response.data;
    
  } catch (error) {
    throw handleApiError(error, 'summary generation');
  }
}

/**
 * Send closeout email with summary and transcription
 * Timeout: 30 seconds
 */
export async function sendCloseoutEmail({
  summary,
  transcription,
  technician_name
}: {
  summary: CloseoutSummary;
  transcription: string;
  technician_name?: string;
}): Promise<EmailResponse> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`📧 Sending closeout email using: ${workingBackendUrl}`);
    
    const response = await axios.post(
      `${workingBackendUrl}/send-email`,
      {
        summary: summary,
        transcription: transcription,
        technician_name: technician_name || 'Field Technician'
      },
      createRequestConfig(30000) // 30 seconds for email
    );

    console.log('✅ Closeout email sent successfully');
    
    return {
      success: true,
      message: response.data.message || 'Email sent successfully',
      recipients: response.data.recipients || []
    };
    
  } catch (error) {
    throw handleApiError(error, 'email sending');
  }
}

/**
 * Process voice command for AI assistant
 * Timeout: 90 seconds (includes transcription + GPT processing)
 */
export async function processVoiceCommand(
  audioUri: string, 
  screenContext: any
): Promise<any> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`🤖 Processing voice command using: ${workingBackendUrl}`);
    
    // Read audio file
    const audioFile = new File(audioUri);
    const base64Audio = await FileSystemLegacy.readAsStringAsync(audioUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    
    console.log(`📁 Audio file: ${audioFile.name} (${audioFile.size} bytes)`);

    // Extract format from filename
    const format = audioFile.name.split('.').pop()?.toLowerCase() || 'm4a';
    
    const response = await axios.post(
      `${workingBackendUrl}/voice-command`,
      {
        audio: base64Audio,
        format: format,
        screenContext: screenContext
      },
      createRequestConfig(90000) // 90 seconds for voice commands
    );

    console.log('✅ Voice command processed successfully');
    return response.data;
    
  } catch (error) {
    throw handleApiError(error, 'voice command processing');
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Test backend connection health
 */
export async function testBackendConnection(): Promise<boolean> {
  try {
    const workingBackendUrl = await getWorkingBackend();
    console.log(`✅ Backend connection test successful: ${workingBackendUrl}`);
    return true;
  } catch (error) {
    console.log('❌ Backend connection test failed:', error);
    return false;
  }
}

/**
 * Clear cached backend URL (useful for troubleshooting)
 */
export function clearBackendCache(): void {
  cachedBackendUrl = null;
  lastCacheTime = 0;
  console.log('🗑️ Backend cache cleared');
}

// =============================================================================
// LEGACY COMPATIBILITY (for backward compatibility with old code)
// =============================================================================

/**
 * @deprecated Use generateSummary() instead
 */
export const summarizeText = generateSummary;

/**
 * @deprecated Use sendCloseoutEmail() instead
 */
export async function sendEmailLegacy(
  summary: CloseoutSummary,
  transcription: string,
  technicianName: string
): Promise<EmailResponse> {
  return sendCloseoutEmail({
    summary,
    transcription,
    technician_name: technicianName
  });
}