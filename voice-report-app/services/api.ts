// voice-report-app/services/api.ts - DEBUG VERSION
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

// Backend URLs using ngrok (Colin's actual URL)
const BACKEND_URLS = [
  'https://7cce-173-230-76-186.ngrok-free.app', // Colin's ngrok URL
  'http://localhost:8000',                      // Local fallback
];

const USE_MOCKS = false; // Temporarily enable while debugging tunnel

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

// Test network connectivity to all possible backends
async function findWorkingBackend(): Promise<string | null> {
  console.log('🔍 Testing backend connectivity...');
  
  for (const url of BACKEND_URLS) {
    try {
      console.log(`Testing: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15 seconds
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VoiceReportApp/1.0', // Custom User-Agent to bypass localtunnel security
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
  if (USE_MOCKS) {
    console.log('🎭 Using mock transcription data');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      transcription: "Today I completed the mobile app interface for the voice-to-report system. I implemented the recording functionality, created all the necessary screens including home, transcript, summary, and PDF preview. The app uses React Native with TypeScript and integrates with Expo AV for audio recording. The UI is clean and user-friendly with a modern design."
    };
  }

  // Find a working backend first
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried:\n${BACKEND_URLS.join('\n')}\n\nMake sure your backend is running on one of these URLs.`);
  }

  try {
    console.log(`🎤 Transcribing audio with backend: ${workingBackendUrl}`);
    
    // Read audio file as base64
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`📁 Audio file size: ${base64Audio.length} characters (base64)`);

    // Determine audio format from file extension
    const format = audioUri.split('.').pop()?.toLowerCase() || 'm4a';
    
    // Create API client for the working backend
    const api = axios.create({
      baseURL: workingBackendUrl,
      timeout: 60000, // 60 seconds for AI processing
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceReportApp/1.0', // Bypass localtunnel security
      },
    });
    
    const response = await api.post<TranscriptionResponse>('/transcribe', {
      audio: base64Audio,
      format: format,
    });

    console.log('✅ Transcription successful');
    return response.data;
    
  } catch (error) {
    console.error('❌ Transcription failed:', error);
    
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
    
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function generateSummary(transcription: string): Promise<SummaryResponse> {
  if (USE_MOCKS) {
    console.log('🎭 Using mock summary data');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      summary: {
        taskDescription: "Developed mobile app interface for voice-to-report system with recording functionality and screen navigation",
        location: "Remote - Home Office",
        datetime: new Date().toLocaleDateString() + " at " + new Date().toLocaleTimeString(),
        outcome: "Successfully implemented all core features including audio recording, transcription display, and PDF generation flow",
        notes: "Ready for backend integration. UI tested on both iOS and Android devices."
      }
    };
  }

  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error('No backend server available for summary generation');
  }

  try {
    console.log(`🤖 Generating summary with backend: ${workingBackendUrl}`);
    
    const api = axios.create({
      baseURL: workingBackendUrl,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
    
    const response = await api.post<SummaryResponse>('/summarize', {
      transcription,
    });

    console.log('✅ Summary generation successful');
    return response.data;
    
  } catch (error) {
    console.error('❌ Summary generation failed:', error);
    throw new Error(`Summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function generatePDF(data: {
  summary: any;
  transcription: string;
}): Promise<string> {
  if (USE_MOCKS) {
    console.log('🎭 Using mock PDF generation');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockPdfContent = `
Mock PDF Report
===============

Task: ${data.summary.taskDescription}
Location: ${data.summary.location || 'N/A'}
Date/Time: ${data.summary.datetime || 'N/A'}
Outcome: ${data.summary.outcome || 'N/A'}
Notes: ${data.summary.notes || 'N/A'}

Full Transcription:
${data.transcription}
    `;
    
    const fileUri = `${FileSystem.documentDirectory}report_${Date.now()}.txt`;
    await FileSystem.writeAsStringAsync(fileUri, mockPdfContent);
    
    return fileUri;
  }

  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error('No backend server available for PDF generation');
  }

  try {
    console.log(`📄 Generating PDF with backend: ${workingBackendUrl}`);
    
    const api = axios.create({
      baseURL: workingBackendUrl,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
    
    const response = await api.post('/generate-pdf', data, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'application/pdf',
      },
    });

    console.log(`📁 PDF received: ${response.data.byteLength} bytes`);
    
    const bytes = new Uint8Array(response.data);
    const base64 = btoa(String.fromCharCode(...bytes));

    const fileUri = `${FileSystem.documentDirectory}report_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('✅ PDF saved to:', fileUri);
    return fileUri;
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function handleApiError(error: any): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return error.response.data?.detail || error.response.data?.message || 'Server error occurred';
    } else if (error.request) {
      return 'No response from server. Please check your connection and backend URL.';
    }
  }
  return 'An unexpected error occurred';
}

// Manual network test function
export async function testNetworkConnectivity(): Promise<void> {
  console.log('🧪 Testing network connectivity...');
  
  // Test basic internet connectivity
  try {
    const response = await fetch('https://httpbin.org/status/200', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    console.log('✅ Internet connectivity: OK');
  } catch (error) {
    console.log('❌ Internet connectivity: FAILED');
    throw new Error('No internet connection');
  }
  
  // Test backend connectivity
  const workingBackend = await findWorkingBackend();
  if (workingBackend) {
    console.log(`✅ Backend connectivity: ${workingBackend}`);
  } else {
    console.log('❌ Backend connectivity: FAILED');
    throw new Error('No backend server accessible');
  }
}