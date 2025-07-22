import { Platform } from 'react-native';

// Function to get local IP address (you'll need to update this manually)
const getLocalIP = () => {
  // Update this with your actual local IP address
  // You can find it by running 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)
  return '192.168.1.100'; // Replace with your actual IP
};

// Function to read ngrok URL from file (if available)
const getNgrokURL = async (): Promise<string | null> => {
  try {
    // In a real implementation, you might read this from AsyncStorage
    // or fetch it from a local endpoint
    return null; // Placeholder
  } catch (error) {
    console.log('No ngrok URL available');
    return null;
  }
};

// API Configuration
export const API_CONFIG = {
  // Backend URLs in order of preference
  BACKEND_URLS: [
    'https://your-ngrok-url.ngrok.io', // Replace with actual ngrok URL
    `http://${getLocalIP()}:8000`,     // Local network IP
    'http://localhost:8000',           // Localhost (for emulator)
    'http://10.0.2.2:8000',           // Android emulator host
  ],
  
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

// Helper function to test backend connectivity without timeout property
export const testBackendConnection = async (url: string): Promise<boolean> => {
  try {
    console.log(`Testing connection to: ${url}`);
    
    // Use AbortController for timeout instead of timeout property
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