// voice-report-app/services/api.ts - COMPLETE HYBRID VERSION (PRODUCTION READY)
import axios, { AxiosError } from 'axios';
import { File, Paths } from 'expo-file-system'; // ✅ Modern API for file objects & paths
import * as FileSystemLegacy from 'expo-file-system/legacy'; // ✅ Legacy API for base64 operations
import { API_CONFIG } from './api-config';
import { TranscriptionResponse, SummaryResponse, EmailResponse, CloseoutSummary, ApiError } from '../types/api';

// Simple backend connection cache
let cachedBackendUrl: string | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

// Core backend discovery function
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

// Common request configuration
const createRequestConfig = (timeout: number = API_CONFIG.CONNECTION.TIMEOUT) => ({
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'VoiceReportApp/2.0',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout,
});

// Enhanced error handling
const handleApiError = (error: any, operation: string): Error => {
  console.error(`${operation} failed:`, error);
  cachedBackendUrl = null; // Clear cache on error
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    
    // Handle specific HTTP status codes
    if (axiosError.response?.status === 503) {
      return new Error(`${operation} service unavailable - check OpenAI API configuration`);
    }
    if (axiosError.response?.status === 400) {
      return new Error(`Invalid request - ${axiosError.response.data?.detail || 'bad request'}`);
    }
    if (axiosError.response?.status === 413) {
      return new Error('File too large (max 25MB)');
    }
    if (axiosError.response?.status === 500) {
      return new Error(`Server error during ${operation} - please try again`);
    }
    
    // Handle detailed error responses
    if (axiosError.response?.data?.detail) {
      return new Error(`${operation} error: ${axiosError.response.data.detail}`);
    }
    
    // Handle network errors
    if (axiosError.code === 'NETWORK_ERROR' || axiosError.code === 'ECONNREFUSED') {
      return new Error('Network connection failed - check your internet connection');
    }
  }
  
  return new Error(`Failed to ${operation}. Please check your connection and try again.`);
};

// =============================================================================
// CORE API FUNCTIONS
// =============================================================================

export async function transcribeAudio(audioUri: string): Promise<TranscriptionResponse> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`🎙️ Transcribing audio using: ${workingBackendUrl}`);
    
    // ✅ HYBRID - Use modern API for file info, legacy for base64 reading
    const audioFile = new File(audioUri);
    const base64Audio = await FileSystemLegacy.readAsStringAsync(audioUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    console.log(`📁 Audio file: ${audioFile.name} (${audioFile.size} bytes), base64: ${base64Audio.length} chars`);

    // Extract format from filename
    const format = audioFile.name.split('.').pop()?.toLowerCase() || 'm4a';
    
    console.log('📤 Sending transcription request...');

    const response = await axios.post(
      `${workingBackendUrl}/transcribe`,
      {
        audio: base64Audio,
        format: format,
      },
      createRequestConfig()
    );

    console.log('✅ Transcription successful');
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Audio transcription');
  }
}

export async function summarizeTranscription(transcription: string): Promise<SummaryResponse> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`📝 Summarizing transcription using: ${workingBackendUrl}`);
    console.log(`📋 Transcription length: ${transcription.length} characters`);

    const response = await axios.post(
      `${workingBackendUrl}/summarize`,
      { transcription },
      createRequestConfig()
    );

    console.log('✅ Summarization successful');
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Transcription summarization');
  }
}

export async function generateSummary(transcription: string): Promise<CloseoutSummary> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`🔄 Generating summary from transcription: ${transcription.substring(0, 50)}...`);
    
    const response = await axios.post(`${workingBackendUrl}/summarize`, {
      transcription: transcription
    }, createRequestConfig());

    console.log('✅ Summary generation successful');
    return response.data.summary || response.data;
  } catch (error) {
    throw handleApiError(error, 'summary generation');
  }
}

export async function generatePDF(summary: CloseoutSummary, transcription: string): Promise<string> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`📄 Generating PDF using: ${workingBackendUrl}`);

    const response = await axios.post(
      `${workingBackendUrl}/generate-pdf`,
      {
        summary,
        transcription,
      },
      {
        ...createRequestConfig(),
        responseType: 'arraybuffer',
      }
    );

    console.log('✅ PDF generation successful');
    console.log(`📁 PDF size: ${response.data.byteLength} bytes`);

    // ✅ HYBRID - Convert ArrayBuffer to base64, use modern API for file path, legacy for writing
    const base64Pdf = btoa(
      new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Create file path using modern API
    const pdfFile = new File(Paths.cache, `closeout_report_${Date.now()}.pdf`);
    
    // Write using legacy API for reliable base64 support
    await FileSystemLegacy.writeAsStringAsync(pdfFile.uri, base64Pdf, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });

    console.log(`📁 PDF saved to: ${pdfFile.uri}`);
    return pdfFile.uri;
  } catch (error) {
    throw handleApiError(error, 'PDF generation');
  }
}

export async function sendEmail(
  recipients: string[],
  subject: string,
  body: string,
  pdfUri?: string
): Promise<EmailResponse> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`📧 Sending email using: ${workingBackendUrl}`);

    let pdfBase64: string | undefined;
    if (pdfUri) {
      // ✅ HYBRID - Use legacy API for reliable base64 reading
      pdfBase64 = await FileSystemLegacy.readAsStringAsync(pdfUri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
    }

    const response = await axios.post(
      `${workingBackendUrl}/send-email`,
      {
        recipients,
        subject,
        body,
        pdf_attachment: pdfBase64,
      },
      createRequestConfig()
    );

    console.log('✅ Email sent successfully');
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'Email sending');
  }
}

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
    
    const response = await axios.post(`${workingBackendUrl}/send-email`, {
      summary: summary,
      transcription: transcription,
      technician_name: technician_name || 'Field Technician'
    }, createRequestConfig());

    console.log('✅ Closeout email sent successfully');
    return {
      success: true,
      message: response.data.message || 'Email sent successfully',
      recipients: response.data.recipients || ['colbol42@gmail.com']
    };
  } catch (error) {
    throw handleApiError(error, 'email sending');
  }
}

export async function processVoiceCommand(
  audioUri: string, 
  screenContext: any
): Promise<any> {
  const workingBackendUrl = await getWorkingBackend();

  try {
    console.log(`🤖 Processing voice command using: ${workingBackendUrl}`);
    
    // ✅ HYBRID - Use modern API for file info, legacy for base64 reading
    const audioFile = new File(audioUri);
    const base64Audio = await FileSystemLegacy.readAsStringAsync(audioUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    console.log(`📁 Audio file: ${audioFile.name} (${audioFile.size} bytes), base64: ${base64Audio.length} chars`);

    // Extract format from filename
    const format = audioFile.name.split('.').pop()?.toLowerCase() || 'm4a';
    
    const response = await axios.post(`${workingBackendUrl}/voice-command`, {
      audio: base64Audio,
      format: format,
      screenContext: screenContext
    }, createRequestConfig());

    console.log('✅ Voice command processed successfully');
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'voice command processing');
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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

export function clearBackendCache(): void {
  cachedBackendUrl = null;
  lastCacheTime = 0;
  console.log('🗑️ Backend cache cleared');
}

// =============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// =============================================================================

// Backward compatibility aliases
export const summarizeText = generateSummary;

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