#!/usr/bin/env python3
"""
FIXED Ngrok URL Manager - Correct JavaScript syntax generation
"""

import json
import requests
import time
import subprocess
import sys
import os
import socket
from pathlib import Path
from typing import Optional, Dict, List

class NgrokManager:
    def __init__(self, backend_port: int = 8000, frontend_dir: str = "voice-report-app"):
        self.backend_port = backend_port
        self.frontend_dir = frontend_dir
        self.ngrok_api_url = "http://localhost:4040/api/tunnels"
        self.config_file = Path(frontend_dir) / "services" / "api-config.ts"
        
    def get_local_ip(self) -> str:
        """Get the actual local IP address"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            try:
                hostname = socket.gethostname()
                return socket.gethostbyname(hostname)
            except Exception:
                return "192.168.1.100"
        
    def get_ngrok_url(self) -> Optional[str]:
        """Get the current ngrok HTTPS URL"""
        try:
            response = requests.get(self.ngrok_api_url, timeout=5)
            response.raise_for_status()
            
            tunnels = response.json().get('tunnels', [])
            
            # Prefer HTTPS tunnel
            for tunnel in tunnels:
                if tunnel.get('proto') == 'https':
                    return tunnel['public_url']
            
            # Fall back to HTTP tunnel if no HTTPS
            for tunnel in tunnels:
                if tunnel.get('proto') == 'http':
                    return tunnel['public_url']
                    
            return None
            
        except requests.RequestException as e:
            print(f"❌ Error getting ngrok URL: {e}")
            return None
    
    def generate_complete_api_config(self, ngrok_url: Optional[str] = None):
        """Generate the FIXED api-config.ts with proper JavaScript syntax"""
        print("📝 Generating complete frontend configuration...")
        
        if ngrok_url is None:
            ngrok_url = self.get_ngrok_url()
        
        local_ip = self.get_local_ip()
        
        # Ensure the services directory exists
        services_dir = Path(self.frontend_dir) / "services"
        services_dir.mkdir(exist_ok=True)
        
        # Build backend URLs - FIXED: Proper array formatting
        backend_urls = []
        
        if ngrok_url:
            backend_urls.append(f"'{ngrok_url}'")
            print(f"✅ Using ngrok URL: {ngrok_url}")
        else:
            backend_urls.append("'https://placeholder-ngrok.ngrok.io'")
            print("⚠️  Ngrok URL not available, using placeholder")
        
        backend_urls.append(f"'http://{local_ip}:{self.backend_port}'")
        backend_urls.append(f"'http://localhost:{self.backend_port}'")
        backend_urls.append(f"'http://10.0.2.2:{self.backend_port}'")
        
        print(f"✅ Using local IP: http://{local_ip}:{self.backend_port}")
        
        # FIXED: Proper JavaScript array formatting with actual newlines
        backend_urls_formatted = ',\n    '.join(backend_urls)
        
        # FIXED: Template with correct JavaScript syntax
        config_content = f'''// Auto-generated API configuration
// This file is automatically updated by ngrok_manager.py
// Last updated: {time.strftime("%Y-%m-%d %H:%M:%S")}

import {{ Platform }} from 'react-native';

// API Configuration
export const API_CONFIG = {{
  // Backend URLs in order of preference
  BACKEND_URLS: [
    {backend_urls_formatted}
  ],
  
  // Current ngrok URL (null if not available)
  NGROK_URL: {f"'{ngrok_url}'" if ngrok_url else 'null'},
  
  // Local network IP
  LOCAL_IP: '{local_ip}',
  LOCAL_PORT: {self.backend_port},
  
  // Connection settings
  CONNECTION: {{
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    HEALTH_CHECK_INTERVAL: 60000,
  }},
  
  // Audio settings
  AUDIO: {{
    MAX_SIZE_MB: 25,
    SUPPORTED_FORMATS: ['m4a', 'mp4', 'wav', 'mp3', 'webm'],
    DEFAULT_FORMAT: 'm4a',
  }},
}};

// FIXED: Helper function with critical ngrok header
export const testBackendConnection = async (url: string): Promise<boolean> => {{
  try {{
    console.log(`Testing connection to: ${{url}}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${{url}}/health`, {{
      method: 'GET',
      signal: controller.signal,
      headers: {{
        'Accept': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
        // 🚨 CRITICAL: This header prevents ngrok 400 errors
        'ngrok-skip-browser-warning': 'true',
        'Cache-Control': 'no-cache',
      }},
    }});
    
    clearTimeout(timeoutId);
    
    if (response.ok) {{
      const data = await response.json();
      console.log(`✅ Backend responding at ${{url}}:`, data);
      return true;
    }} else {{
      console.log(`❌ Backend returned status ${{response.status}} at ${{url}}`);
      return false;
    }}
    
  }} catch (error) {{
    console.log(`❌ Connection failed to ${{url}}:`, error);
    return false;
  }}
}};

export const findWorkingBackend = async (): Promise<string | null> => {{
  console.log('🔍 Testing backend connectivity...');
  
  for (const url of API_CONFIG.BACKEND_URLS) {{
    const isWorking = await testBackendConnection(url);
    if (isWorking) {{
      console.log(`✅ Found working backend: ${{url}}`);
      return url;
    }}
  }}
  
  console.log('❌ No working backend found');
  return null;
}};

export const updateNgrokURL = (newUrl: string) => {{
  API_CONFIG.BACKEND_URLS[0] = newUrl;
  API_CONFIG.NGROK_URL = newUrl;
  console.log(`Updated ngrok URL to: ${{newUrl}}`);
}};

export const PLATFORM_CONFIG = {{
  IS_IOS: Platform.OS === 'ios',
  IS_ANDROID: Platform.OS === 'android',
  IS_WEB: Platform.OS === 'web',
  
  AUDIO_PRESET: Platform.select({{
    ios: 'HIGH_QUALITY',
    android: 'HIGH_QUALITY',
    default: 'HIGH_QUALITY',
  }}),
}};

export const DEBUG_CONFIG = {{
  ENABLE_LOGS: __DEV__,
  ENABLE_PERFORMANCE_MONITORING: __DEV__,
  ENABLE_NETWORK_LOGGING: __DEV__,
  LOG_LEVEL: __DEV__ ? 'debug' : 'error',
}};
'''
        
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                f.write(config_content)
            print(f"✅ Complete configuration generated: {self.config_file}")
            
            if self.config_file.exists() and self.config_file.stat().st_size > 100:
                print(f"✅ Configuration file verified: {self.config_file.stat().st_size} bytes")
                return True
            else:
                print(f"❌ Configuration file appears to be empty or too small")
                return False
                
        except Exception as e:
            print(f"❌ Failed to generate configuration: {e}")
            return False
    
    def verify_api_config(self):
        """Verify the api-config.ts file has all necessary exports"""
        print("🔍 Verifying api-config.ts exports...")
        
        if not self.config_file.exists():
            print(f"❌ Configuration file does not exist: {self.config_file}")
            return False
        
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            required_exports = [
                'export const API_CONFIG',
                'export const testBackendConnection',
                'export const findWorkingBackend',
                'export const updateNgrokURL',
                'export const PLATFORM_CONFIG',
                'export const DEBUG_CONFIG',
                'ngrok-skip-browser-warning'
            ]
            
            missing_exports = []
            for export in required_exports:
                if export not in content:
                    missing_exports.append(export)
            
            if missing_exports:
                print(f"❌ Missing required exports: {missing_exports}")
                return False
            else:
                print("✅ All required exports found in api-config.ts")
                if 'ngrok-skip-browser-warning' in content:
                    print("✅ Critical ngrok header found in template")
                return True
                
        except Exception as e:
            print(f"❌ Error verifying api-config.ts: {e}")
            return False
    
    def test_connectivity(self):
        """Test connectivity to backend through all available URLs"""
        print("🔍 Testing backend connectivity...")
        
        ngrok_url = self.get_ngrok_url()
        local_ip = self.get_local_ip()
        
        urls_to_test = []
        if ngrok_url:
            urls_to_test.append(ngrok_url)
        urls_to_test.extend([
            f"http://{local_ip}:{self.backend_port}",
            f"http://localhost:{self.backend_port}"
        ])
        
        working_count = 0
        for url in urls_to_test:
            try:
                headers = {'ngrok-skip-browser-warning': 'true'} if 'ngrok' in url else {}
                response = requests.get(f"{url}/health", timeout=5, headers=headers)
                if response.status_code == 200:
                    print(f"✅ {url} - OK")
                    working_count += 1
                else:
                    print(f"❌ {url} - Status {response.status_code}")
            except Exception as e:
                print(f"❌ {url} - Failed: {e}")
        
        print(f"\n📊 Summary: {working_count}/{len(urls_to_test)} endpoints working")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='FIXED Ngrok Manager & Frontend Config Generator')
    parser.add_argument('--update', action='store_true', help='Generate complete frontend config with current URLs')
    parser.add_argument('--url', action='store_true', help='Get current ngrok URL')
    parser.add_argument('--verify', action='store_true', help='Verify api-config.ts has all exports')
    parser.add_argument('--test', action='store_true', help='Test connectivity to all backends')
    parser.add_argument('--port', type=int, default=8000, help='Backend port (default: 8000)')
    parser.add_argument('--frontend-dir', default='voice-report-app', help='Frontend directory')
    
    args = parser.parse_args()
    
    manager = NgrokManager(args.port, args.frontend_dir)
    
    if args.update:
        result = manager.generate_complete_api_config()
        if result:
            manager.verify_api_config()
    elif args.url:
        url = manager.get_ngrok_url()
        if url:
            print(url)
        else:
            sys.exit(1)
    elif args.verify:
        manager.verify_api_config()
    elif args.test:
        manager.test_connectivity()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()