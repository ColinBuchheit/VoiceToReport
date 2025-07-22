import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from './api-config';

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

// Updated summary structure for closeout reports
interface CloseoutSummary {
  // Closeout Notes
  onsite_contact?: string;
  support_contact?: string;
  work_completed?: string;
  delays?: string;
  troubleshooting_steps?: string;
  scope_completed?: string;
  released_by?: string;
  release_code?: string;
  return_tracking?: string;
  
  // Expenses
  expenses?: string;
  materials_used?: string;
  
  // Out of Scope
  out_of_scope_work?: string;
  
  // Photos
  photos_uploaded?: string;
  
  // Additional context
  location?: string;
  datetime?: string;
  technician_name?: string;
  
  // Legacy fields for backward compatibility
  taskDescription?: string;
  outcome?: string;
  notes?: string;
}

interface EmailResponse {
  success: boolean;
  message: string;
  recipients: string[];
}

// Test network connectivity to all possible backends
async function findWorkingBackend(): Promise<string | null> {
  console.log('🔍 Testing backend connectivity...');
  
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
          'User-Agent': 'VoiceReportApp/2.0',
        },
      });
      
      clearTimeout(timeoutId);
      
      console.log(`📡 ${url} responded with status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Backend found at ${url}:`, data);
        return url;
      } else {
        console.log(`❌ ${url} returned status ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${url} failed:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log('❌ No working backend found');
  return null;
}

export async function transcribeAudio(audioUri: string): Promise<TranscriptionResponse> {
  const workingBackendUrl = await findWorkingBackend();
  
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
      timeout: 60000,
    });

    console.log('✅ Transcription successful');
    return response.data;
  } catch (error) {
    console.error('Transcription failed:', error);
    
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

export async function generateSummary(transcription: string): Promise<SummaryResponse> {
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📝 Generating summary using: ${workingBackendUrl}`);
    
    // Create request payload matching backend expectations (/summarize endpoint)
    const payload = {
      transcription: transcription
    };
    
    const response = await axios.post(`${workingBackendUrl}/summarize`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
      },
      timeout: 30000,
    });

    console.log('✅ Summary generation successful');
    return response.data;
  } catch (error) {
    console.error('Summary generation failed:', error);
    throw new Error('Failed to generate summary. Please check your connection and try again.');
  }
}

// Alias for backward compatibility
export async function summarizeText(transcription: string): Promise<SummaryResponse> {
  return generateSummary(transcription);
}

export async function generatePDF(data: {
  summary: any;
  transcription: string;
}): Promise<string> {
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📄 Generating PDF using: ${workingBackendUrl}`);
    
    // Create request payload matching backend expectations (/generate-pdf endpoint)
    const payload = {
      summary: data.summary,
      transcription: data.transcription
    };
    
    const response = await axios.post(`${workingBackendUrl}/generate-pdf`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
      },
      timeout: 30000,
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
    throw new Error('Failed to generate PDF. Please check your connection and try again.');
  }
}

// NEW: Send closeout email function
export async function sendCloseoutEmail(data: {
  summary: CloseoutSummary;
  transcription: string;
  technician_name?: string;
}): Promise<EmailResponse> {
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📧 Sending closeout email using: ${workingBackendUrl}`);
    
    // Create request payload matching backend expectations (/send-email endpoint)
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
      timeout: 30000,
    });

    console.log(`📧 Email sent successfully to ${response.data.recipients.length} recipients`);
    return response.data;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send closeout email. Please check your connection and try again.');
  }
}

// Additional utility functions for debugging
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const workingBackendUrl = await findWorkingBackend();
    return workingBackendUrl !== null;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

export async function getBackendInfo(): Promise<any> {
  const workingBackendUrl = await findWorkingBackend();
  
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
    throw new Error('Failed to get backend information');
  }
}

export async function testEmailConfiguration(): Promise<any> {
  const workingBackendUrl = await findWorkingBackend();
  
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
    throw new Error('Failed to test email configuration');
  }
}

// Export the current configuration for debugging
export const getAPIConfig = () => API_CONFIG;