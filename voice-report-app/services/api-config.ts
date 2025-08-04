// Auto-generated API configuration
// This file is automatically updated by ngrok_manager.py
// Last updated: 2025-07-30 13:21:08

import { Platform } from 'react-native';

// API Configuration
export const API_CONFIG = {
  // Backend URLs in order of preference
  BACKEND_URLS: [
    'https://76b10bafebb8.ngrok-free.app',
    'http://192.168.1.171:8000',
    'http://localhost:8000',
    'http://10.0.2.2:8000'
  ],
  
  // Current ngrok URL (null if not available)
  NGROK_URL: 'https://76b10bafebb8.ngrok-free.app',
  
  // Local network IP
  LOCAL_IP: '192.168.1.171',
  LOCAL_PORT: 8000,
  
  // Connection settings
  CONNECTION: {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    HEALTH_CHECK_INTERVAL: 60000,
  },
  
  // Audio settings
  AUDIO: {
    MAX_SIZE_MB: 25,
    SUPPORTED_FORMATS: ['m4a', 'mp4', 'wav', 'mp3', 'webm'],
    DEFAULT_FORMAT: 'm4a',
  },
};

// Helper function to test backend connectivity
export const testBackendConnection = async (url: string): Promise<boolean> => {
  try {
    console.log(`Testing connection to: ${url}`);
    
    // Use AbortController for timeout
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
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Backend responding at ${url}:`, data);
      return true;
    } else {
      console.log(`❌ Backend returned status ${response.status} at ${url}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Connection failed to ${url}:`, error);
    return false;
  }
};

// Function to find working backend
export const findWorkingBackend = async (): Promise<string | null> => {
  console.log('🔍 Testing backend connectivity...');
  
  for (const url of API_CONFIG.BACKEND_URLS) {
    const isWorking = await testBackendConnection(url);
    if (isWorking) {
      console.log(`✅ Found working backend: ${url}`);
      return url;
    }
  }
  
  console.log('❌ No working backend found');
  return null;
};

// Function to update ngrok URL dynamically
export const updateNgrokURL = (newUrl: string) => {
  // Update the first URL in the array with new ngrok URL
  API_CONFIG.BACKEND_URLS[0] = newUrl;
  API_CONFIG.NGROK_URL = newUrl;
  console.log(`Updated ngrok URL to: ${newUrl}`);
};

// Platform-specific configuration
export const PLATFORM_CONFIG = {
  IS_IOS: Platform.OS === 'ios',
  IS_ANDROID: Platform.OS === 'android',
  IS_WEB: Platform.OS === 'web',
  
  // Audio recording presets based on platform
  AUDIO_PRESET: Platform.select({
    ios: 'HIGH_QUALITY',
    android: 'HIGH_QUALITY',
    default: 'HIGH_QUALITY',
  }),
};

// Debug configuration
export const DEBUG_CONFIG = {
  ENABLE_LOGS: __DEV__,
  ENABLE_PERFORMANCE_MONITORING: __DEV__,
  ENABLE_NETWORK_LOGGING: __DEV__,
  LOG_LEVEL: __DEV__ ? 'debug' : 'error',
};
