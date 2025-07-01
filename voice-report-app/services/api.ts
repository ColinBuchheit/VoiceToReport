// mobile-app/services/api.ts - WITH MOCKS FOR TESTING
import axios from 'axios';
import * as FileSystem from 'expo-file-system';

// Configure your backend URL here
const API_BASE_URL = 'https://your-backend-api.com'; // Replace with your actual backend URL
const USE_MOCKS = true; // Set to false when backend is ready

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export async function transcribeAudio(audioUri: string): Promise<TranscriptionResponse> {
  if (USE_MOCKS) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      transcription: "Today I completed the mobile app interface for the voice-to-report system. I implemented the recording functionality, created all the necessary screens including home, transcript, summary, and PDF preview. The app uses React Native with TypeScript and integrates with Expo AV for audio recording. The UI is clean and user-friendly with a modern design."
    };
  }

  try {
    const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const response = await api.post<TranscriptionResponse>('/transcribe', {
      audio: base64Audio,
      format: 'm4a',
    });

    return response.data;
  } catch (error) {
    console.error('API Error - Transcribe:', error);
    throw new Error('Failed to transcribe audio');
  }
}

export async function generateSummary(transcription: string): Promise<SummaryResponse> {
  if (USE_MOCKS) {
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

  try {
    const response = await api.post<SummaryResponse>('/summarize', {
      transcription,
    });

    return response.data;
  } catch (error) {
    console.error('API Error - Summary:', error);
    throw new Error('Failed to generate summary');
  }
}

export async function generatePDF(data: {
  summary: any;
  transcription: string;
}): Promise<string> {
  if (USE_MOCKS) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a mock PDF file
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
    
    const fileUri = `${FileSystem.documentDirectory}report_${Date.now()}.txt`; // Using .txt for mock
    await FileSystem.writeAsStringAsync(fileUri, mockPdfContent);
    
    return fileUri;
  }

  try {
    const response = await api.post('/generate-pdf', data, {
      responseType: 'arraybuffer',
    });

    const base64 = btoa(
      new Uint8Array(response.data)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const fileUri = `${FileSystem.documentDirectory}report_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  } catch (error) {
    console.error('API Error - Generate PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}

export function handleApiError(error: any): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return error.response.data?.message || 'Server error occurred';
    } else if (error.request) {
      return 'No response from server. Please check your connection.';
    }
  }
  return 'An unexpected error occurred';
}

//test