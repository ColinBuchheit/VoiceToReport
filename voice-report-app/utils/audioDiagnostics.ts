// Diagnostic utilities to help identify audio recording issues

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface AudioDiagnostics {
  uri: string;
  exists: boolean;
  size: number;
  isEmpty: boolean;
  platform: string;
  isEmulator: boolean;
  timestamp: string;
  readableSize: string;
}

// Get detailed diagnostics about an audio file
export async function getAudioDiagnostics(uri: string): Promise<AudioDiagnostics> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  const exists = !!fileInfo.exists;
  const size = exists && 'size' in fileInfo && typeof (fileInfo as any).size === 'number'
    ? (fileInfo as any).size as number
    : 0;

  const diagnostics: AudioDiagnostics = {
    uri,
    exists,
    size,
    isEmpty: size === 0,
    platform: Platform.OS,
    isEmulator: await isRunningOnEmulator(),
    timestamp: new Date().toISOString(),
    readableSize: formatBytes(size),
  };

  return diagnostics;
}

// Check if running on emulator (best-effort detection)
async function isRunningOnEmulator(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return (
      (Platform as any).constants?.Fingerprint?.includes('generic') ||
      (Platform as any).constants?.Model?.includes('sdk') ||
      (Platform as any).constants?.Model?.includes('Emulator')
    );
  }

  if (Platform.OS === 'ios') {
    return ((Platform as any).constants?.isTesting || false) as boolean;
  }

  return false;
}

// Format bytes to human-readable string
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Validate audio file and provide helpful error message
export async function validateAudioFile(uri: string): Promise<{
  valid: boolean;
  error?: string;
  diagnostics: AudioDiagnostics;
}> {
  const diagnostics = await getAudioDiagnostics(uri);

  if (!diagnostics.exists) {
    return { valid: false, error: 'Audio file does not exist', diagnostics };
  }

  if (diagnostics.isEmpty) {
    return { valid: false, error: 'Audio file is empty (0 bytes)', diagnostics };
  }

  if (diagnostics.size < 1000) {
    return {
      valid: false,
      error: `Audio file is suspiciously small (${diagnostics.readableSize})`,
      diagnostics,
    };
  }

  return { valid: true, diagnostics };
}

// Log audio diagnostics to console with nice formatting
export function logAudioDiagnostics(diagnostics: AudioDiagnostics): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AUDIO FILE DIAGNOSTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Platform: ${diagnostics.platform} ${diagnostics.isEmulator ? '(EMULATOR)' : '(DEVICE)'}`);
  console.log(`File exists: ${diagnostics.exists ? '✅' : '❌'}`);
  console.log(`File size: ${diagnostics.readableSize} (${diagnostics.size} bytes)`);
  console.log(`Is empty: ${diagnostics.isEmpty ? '⚠️ YES' : '✅ NO'}`);
  console.log(`Timestamp: ${diagnostics.timestamp}`);
  console.log(`URI: ${diagnostics.uri}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
