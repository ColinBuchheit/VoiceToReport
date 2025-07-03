// Auto-generated API configuration
// This file is automatically updated by the startup script
// Last updated: 2025-07-02 21:27:10

export const API_CONFIG = {
  NGROK_URL: 'https://d0c5-173-230-76-87.ngrok-free.app',
  LOCAL_URL: 'http://localhost:8000',
  BACKEND_URLS: [
    'https://d0c5-173-230-76-87.ngrok-free.app',
    'http://localhost:8000'
  ]
};

// Function to get the current backend URL
export const getCurrentBackendUrl = (): string => {
  // In development, prefer ngrok URL for mobile testing
  if (__DEV__) {
    return API_CONFIG.NGROK_URL;
  }
  return API_CONFIG.LOCAL_URL;
};

// Helper function to test if a URL is reachable
export const testBackendConnection = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VoiceReportApp/1.0',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};
