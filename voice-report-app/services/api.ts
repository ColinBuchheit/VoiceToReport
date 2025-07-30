import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { findWorkingBackend, testBackendConnection, API_CONFIG } from './api-config';

interface TranscriptionResponse {
  transcription: string;
}

interface SummaryResponse {
  summary: {
    taskDescription: string;
    location?: string;
    datetime?: string;
    outcome?: string;
    notes?: string;
  };
}

interface EmailResponse {
  success: boolean;
  message: string;
  recipients: string[];
}

// Cache for working backend URL to reduce redundant testing
let cachedBackendUrl: string | null = null;
let lastConnectivityCheck = 0;
const CONNECTIVITY_CACHE_DURATION = 30000; // 30 seconds

async function getWorkingBackend(): Promise<string | null> {
  const now = Date.now();
  
  // Use cached URL if it's recent and still working
  if (cachedBackendUrl && (now - lastConnectivityCheck) < CONNECTIVITY_CACHE_DURATION) {
    const isStillWorking = await testBackendConnection(cachedBackendUrl);
    if (isStillWorking) {
      return cachedBackendUrl;
    } else {
      console.log('🔄 Cached backend URL no longer working, finding new one...');
      cachedBackendUrl = null;
    }
  }
  
  // Use the function from api-config.ts to find working backend
  const workingUrl = await findWorkingBackend();
  if (workingUrl) {
    cachedBackendUrl = workingUrl;
    lastConnectivityCheck = now;
  }
  
  return workingUrl;
}

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
    
    // Create request payload matching backend expectations
    const payload = {
      audio: base64Audio,
      format: format
    };
    
    const response = await axios.post(`${workingBackendUrl}/transcribe`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
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
      if (error.response?.status === 400) {
        throw new Error('Invalid audio format or data');
      }
      if (error.response?.status === 500) {
        throw new Error('Server error during transcription');
      }
      if (error.response?.data?.detail) {
        throw new Error(`Backend error: ${error.response.data.detail}`);
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
    
    // Create request payload matching backend expectations
    const payload = {
      transcription: transcription
    };
    
    const response = await axios.post(`${workingBackendUrl}/summarize`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log('✅ Summary generation successful');
    return response.data;
  } catch (error) {
    console.error('Summarization failed:', error);
    // Clear cache on error
    cachedBackendUrl = null;
    throw new Error('Failed to summarize text. Please check your connection and try again.');
  }
}

// Export generateSummary function (alias for summarizeText) - FIXES THE MISSING FUNCTION ERROR
export async function generateSummary(transcription: string): Promise<SummaryResponse> {
  return await summarizeText(transcription);
}

export async function generatePDF(data: {
  summary: any;
  transcription: string;
}): Promise<string> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📄 Generating PDF using: ${workingBackendUrl}`);
    
    // Create request payload matching backend expectations
    const payload = {
      summary: data.summary,
      transcription: data.transcription
    };
    
    const response = await axios.post(`${workingBackendUrl}/generate-pdf`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
      responseType: 'arraybuffer', // Important: PDF comes as binary data
    });

    console.log(`📁 PDF received: ${response.data.byteLength} bytes`);
    
    // Convert binary data to base64 and save to file
    const bytes = new Uint8Array(response.data);
    const base64 = btoa(String.fromCharCode(...bytes));

    const fileUri = `${FileSystem.documentDirectory}report_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✅ PDF saved to:', fileUri);
    return fileUri;
  } catch (error) {
    console.error('PDF generation failed:', error);
    cachedBackendUrl = null;
    throw new Error('Failed to generate PDF. Please check your connection and try again.');
  }
}

export async function sendEmail(emailData: any): Promise<EmailResponse> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📧 Sending email using: ${workingBackendUrl}`);
    const response = await axios.post(`${workingBackendUrl}/send-email`, emailData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log(`📧 Email sent successfully`);
    return response.data;
  } catch (error) {
    console.error('Email sending failed:', error);
    cachedBackendUrl = null;
    throw new Error('Failed to send email. Please check your connection and try again.');
  }
}

// Send closeout email function
export async function sendCloseoutEmail(data: {
  summary: any;
  transcription: string;
  technician_name?: string;
}): Promise<EmailResponse> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📧 Sending closeout email using: ${workingBackendUrl}`);
    
    // Create request payload matching backend expectations
    const payload = {
      summary: data.summary,
      transcription: data.transcription,
      technician_name: data.technician_name
    };
    
    const response = await axios.post(`${workingBackendUrl}/send-email`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
      },
      timeout: API_CONFIG.CONNECTION.TIMEOUT,
    });

    console.log(`📧 Email sent successfully to ${response.data.recipients.length} recipients`);
    return response.data;
  } catch (error) {
    console.error('Email sending failed:', error);
    cachedBackendUrl = null;
    throw new Error('Failed to send closeout email. Please check your connection and try again.');
  }
}

// Additional utility functions for debugging
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const workingBackendUrl = await getWorkingBackend();
    return workingBackendUrl !== null;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

export async function getBackendInfo(): Promise<any> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error('No backend server available');
  }

  try {
    const response = await axios.get(`${workingBackendUrl}/health`, {
      timeout: 5000,
    });
    return {
      url: workingBackendUrl,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error('Failed to get backend info:', error);
    cachedBackendUrl = null;
    throw new Error('Failed to get backend information');
  }
}

export async function testEmailConfiguration(): Promise<any> {
  const workingBackendUrl = await getWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error('No backend server available');
  }

  try {
    const response = await axios.get(`${workingBackendUrl}/test-email`, {
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error('Email test failed:', error);
    cachedBackendUrl = null;
    throw new Error('Failed to test email configuration');
  }
}

// Function to manually refresh backend connection
export async function refreshBackendConnection(): Promise<string | null> {
  console.log('🔄 Manually refreshing backend connection...');
  cachedBackendUrl = null;
  lastConnectivityCheck = 0;
  return await getWorkingBackend();
}

// Export the current configuration for debugging
export const getAPIConfig = () => ({
  ...API_CONFIG,
  cachedBackendUrl,
  lastConnectivityCheck: new Date(lastConnectivityCheck).toISOString(),
});