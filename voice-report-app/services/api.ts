// voice-report-app/services/api.ts - FIXED VERSION (TypeScript Errors Resolved)
import axios, { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from './api-config';
import { TranscriptionResponse, SummaryResponse, EmailResponse, CloseoutSummary, ApiError } from '../types/api';

// Cache for working backend URL
let cachedBackendUrl: string | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

// FIXED: Helper function to get working backend with proper error handling
async function getWorkingBackend(): Promise<string | null> {
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
          // FIXED: Add ngrok headers to prevent browser warning
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Backend failed: ${url} - ${errorMessage}`);
      continue;
    }
  }
  
  cachedBackendUrl = null;
  return null;
}

// FIXED: Transcribe audio with proper mobile app support
export async function transcribeAudio(audioUri: string): Promise<TranscriptionResponse> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`🎙️ Transcribing audio using: ${workingBackendUrl}`);
    
    // Read audio file as base64
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`📁 Audio file size: ${base64Audio.length} characters (base64)`);

    // Determine audio format from file extension
    const format = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
    
    // FIXED: Create request payload matching backend expectations
    const payload = {
      audio: base64Audio,
      format: format
    };
    
    const response = await axios.post(`${workingBackendUrl}/transcribe`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
        // FIXED: Add ngrok headers
        'ngrok-skip-browser-warning': 'true',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log('✅ Transcription successful');
    return response.data;
  } catch (error) {
    console.error('Transcription failed:', error);
    // Clear cache on error to force re-discovery
    cachedBackendUrl = null;
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiError>;
      
      // Handle specific error codes
      if (axiosError.response?.status === 400) {
        throw new Error('Invalid audio format or corrupted audio file');
      }
      if (axiosError.response?.status === 413) {
        throw new Error('Audio file too large (max 25MB)');
      }
      if (axiosError.response?.status === 500) {
        throw new Error('Server error during transcription - please try again');
      }
      if (axiosError.response?.status === 503) {
        throw new Error('Transcription service unavailable - check OpenAI API configuration');
      }
      
      // FIXED: Handle detailed error responses with proper typing
      if (axiosError.response?.data?.detail) {
        throw new Error(`Backend error: ${axiosError.response.data.detail}`);
      }
      
      // Handle network errors
      if (axiosError.code === 'NETWORK_ERROR' || axiosError.code === 'ECONNREFUSED') {
        throw new Error('Network connection failed - check your internet connection');
      }
    }
    
    throw new Error('Failed to transcribe audio. Please check your connection and try again.');
  }
}

export async function summarizeText(transcription: string): Promise<SummaryResponse> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📝 Summarizing text using: ${workingBackendUrl}`);
    
    // FIXED: Create request payload matching backend expectations
    const payload = {
      transcription: transcription
    };
    
    const response = await axios.post(`${workingBackendUrl}/summarize`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
        'ngrok-skip-browser-warning': 'true',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log('✅ Summary generation successful');
    return response.data;
  } catch (error) {
    console.error('Summarization failed:', error);
    // Clear cache on error
    cachedBackendUrl = null;
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiError>;
      
      if (axiosError.response?.status === 503) {
        throw new Error('Summarization service unavailable - check OpenAI API configuration');
      }
      // FIXED: Handle detailed error responses with proper typing
      if (axiosError.response?.data?.detail) {
        throw new Error(`Backend error: ${axiosError.response.data.detail}`);
      }
    }
    
    throw new Error('Failed to summarize text. Please check your connection and try again.');
  }
}

// FIXED: Send email with proper error handling
export async function sendEmail(
  summary: CloseoutSummary,
  transcription: string,
  technicianName: string
): Promise<EmailResponse> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📧 Sending email using: ${workingBackendUrl}`);
    
    const payload = {
      summary: summary,
      transcription: transcription,
      technician_name: technicianName
    };
    
    const response = await axios.post(`${workingBackendUrl}/send-email`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
        'ngrok-skip-browser-warning': 'true',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log('✅ Email sent successfully');
    return response.data;
  } catch (error) {
    console.error('Email sending failed:', error);
    cachedBackendUrl = null;
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiError>;
      
      // FIXED: Handle detailed error responses with proper typing
      if (axiosError.response?.data?.detail) {
        throw new Error(`Email error: ${axiosError.response.data.detail}`);
      }
    }
    
    throw new Error('Failed to send email. Please check your connection and try again.');
  }
}

// FIXED: Process voice command for AI agent
export async function processVoiceCommand(
  audioUri: string, 
  screenContext: any
): Promise<any> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`🤖 Processing voice command using: ${workingBackendUrl}`);
    
    // Read audio file as base64
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine audio format
    const format = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
    
    const payload = {
      audio: base64Audio,
      format: format,
      screenContext: screenContext
    };
    
    const response = await axios.post(`${workingBackendUrl}/voice-command`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
        'ngrok-skip-browser-warning': 'true',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log('✅ Voice command processed successfully');
    return response.data;
  } catch (error) {
    console.error('Voice command failed:', error);
    cachedBackendUrl = null;
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiError>;
      
      // FIXED: Handle detailed error responses with proper typing
      if (axiosError.response?.data?.detail) {
        throw new Error(`Voice command error: ${axiosError.response.data.detail}`);
      }
    }
    
    throw new Error('Failed to process voice command. Please try again.');
  }
}

// FIXED: Test backend connection
export async function testBackendConnection(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const workingUrl = await getWorkingBackend();
    if (workingUrl) {
      return { success: true, url: workingUrl };
    } else {
      return { success: false, error: 'No working backend found' };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection test failed' 
    };
  }
}