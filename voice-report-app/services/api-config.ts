// Auto-generated API configuration
// This file is automatically updated by ngrok_manager.py
// Last updated: 2025-10-12 13:55:11

import { Platform } from 'react-native';

// Env override support for Azure/prod
const ENV_URLS_RAW: string | undefined = process.env.EXPO_PUBLIC_BACKEND_URLS as any;
const ENV_URL_SINGLE: string | undefined = process.env.EXPO_PUBLIC_BACKEND_URL as any;
const RESOLVED_ENV_URLS: string[] | null = (() => {
  const urls = (ENV_URLS_RAW?.split(/[\s,]+/)?.filter(Boolean) ?? []) as string[];
  if (urls.length > 0) return urls;
  if (ENV_URL_SINGLE && ENV_URL_SINGLE.trim().length > 0) return [ENV_URL_SINGLE.trim()];
  return null;
})();

// API Configuration
export const API_CONFIG = {
  // Backend URLs in order of preference
  BACKEND_URLS: [
    'https://3ddaec053fd3.ngrok-free.app',
    'http://192.168.1.171:8000',
    'http://localhost:8000',
    'http://10.0.2.2:8000'
  ],
  
  // Current ngrok URL (null if not available)
  NGROK_URL: 'https://3ddaec053fd3.ngrok-free.app',
  
  // Local network IP
  LOCAL_IP: '192.168.1.171',
  LOCAL_PORT: 8000,
  
  // Connection settings
  CONNECTION: {
    TIMEOUT: 3000000,
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

// If env overrides are provided, force those
if (RESOLVED_ENV_URLS && RESOLVED_ENV_URLS.length > 0) {
  const normalized = RESOLVED_ENV_URLS.map((u) => u.replace(/\/$/, ''));
  API_CONFIG.BACKEND_URLS = normalized;
  // @ts-ignore
  API_CONFIG.NGROK_URL = null;
  console.log('[api-config] Using backend URL(s) from env:', normalized);
}

// FIXED: Helper function with critical ngrok header
export const testBackendConnection = async (url: string): Promise<boolean> => {
  try {
    console.log(`Testing connection to: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
        // 🚨 CRITICAL: This header prevents ngrok 400 errors
        'ngrok-skip-browser-warning': 'true',
        'Cache-Control': 'no-cache',
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

export const updateNgrokURL = (newUrl: string) => {
  API_CONFIG.BACKEND_URLS[0] = newUrl;
  API_CONFIG.NGROK_URL = newUrl;
  console.log(`Updated ngrok URL to: ${newUrl}`);
};

export const PLATFORM_CONFIG = {
  IS_IOS: Platform.OS === 'ios',
  IS_ANDROID: Platform.OS === 'android',
  IS_WEB: Platform.OS === 'web',
  
  AUDIO_PRESET: Platform.select({
    ios: 'HIGH_QUALITY',
    android: 'HIGH_QUALITY',
    default: 'HIGH_QUALITY',
  }),
};

export const DEBUG_CONFIG = {
  ENABLE_LOGS: __DEV__,
  ENABLE_PERFORMANCE_MONITORING: __DEV__,
  ENABLE_NETWORK_LOGGING: __DEV__,
  LOG_LEVEL: __DEV__ ? 'debug' : 'error',
};
