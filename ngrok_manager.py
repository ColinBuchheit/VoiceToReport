#!/usr/bin/env python3
"""
Fixed Ngrok URL Manager - Complete api-config.ts Generation
This script properly generates the complete api-config.ts file with all necessary exports
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
            # Connect to a remote server to get local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            # Fallback methods
            try:
                hostname = socket.gethostname()
                return socket.gethostbyname(hostname)
            except Exception:
                return "192.168.1.100"  # Last resort fallback
        
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
    
    def wait_for_ngrok(self, max_attempts: int = 15, delay: int = 2) -> Optional[str]:
        """Wait for ngrok to start and return the URL"""
        print("🔄 Waiting for ngrok to establish tunnel...")
        
        for attempt in range(1, max_attempts + 1):
            print(f"   Attempt {attempt}/{max_attempts}")
            
            url = self.get_ngrok_url()
            if url:
                print(f"✅ Ngrok tunnel found: {url}")
                return url
              
            time.sleep(delay)
        
        print("❌ Failed to get ngrok URL after maximum attempts")
        return None
    
    def start_ngrok(self) -> Optional[str]:
        """Start ngrok and return the URL"""
        print("🚀 Starting ngrok tunnel...")
        
        # Kill existing ngrok processes
        try:
            subprocess.run(["pkill", "-f", "ngrok"], check=False)
            time.sleep(2)
        except:
            pass
        
        # Start ngrok
        try:
            subprocess.Popen([
                "ngrok", "http", str(self.backend_port)
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            return self.wait_for_ngrok()
            
        except Exception as e:
            print(f"❌ Failed to start ngrok: {e}")
            return None
    
    def generate_complete_api_config(self, ngrok_url: Optional[str] = None):
        """Generate the complete api-config.ts file with all necessary exports"""
        print("📝 Generating complete frontend configuration...")
        
        # Get ngrok URL if not provided
        if ngrok_url is None:
            ngrok_url = self.get_ngrok_url()
        
        # Get local IP
        local_ip = self.get_local_ip()
        
        # Ensure the services directory exists
        services_dir = Path(self.frontend_dir) / "services"
        services_dir.mkdir(exist_ok=True)
        
        # Build the URL list in order of preference
        backend_urls = []
        
        # Add ngrok URL if available
        if ngrok_url:
            backend_urls.append(f"'{ngrok_url}'")
            print(f"✅ Using ngrok URL: {ngrok_url}")
        else:
            # Add placeholder that will be replaced when ngrok becomes available
            backend_urls.append("'https://placeholder-ngrok.ngrok.io'")
            print("⚠️  Ngrok URL not available, using placeholder")
        
        # Add local network URL
        backend_urls.append(f"'http://{local_ip}:{self.backend_port}'")
        print(f"✅ Using local IP: http://{local_ip}:{self.backend_port}")
        
        # Add localhost (for emulator/development)
        backend_urls.append(f"'http://localhost:{self.backend_port}'")
        
        # Add Android emulator URL
        backend_urls.append(f"'http://10.0.2.2:{self.backend_port}'")
        
        # Create the complete configuration content with ALL exports
        config_content = f'''// Auto-generated API configuration
// This file is automatically updated by ngrok_manager.py
// Last updated: {time.strftime("%Y-%m-%d %H:%M:%S")}

import {{ Platform }} from 'react-native';

// API Configuration
export const API_CONFIG = {{
  // Backend URLs in order of preference
  BACKEND_URLS: [
    {',\n    '.join(backend_urls)}
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

// Helper function to test backend connectivity
export const testBackendConnection = async (url: string): Promise<boolean> => {{
  try {{
    console.log(`Testing connection to: ${{url}}`);
    
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${{url}}/health`, {{
      method: 'GET',
      signal: controller.signal,
      headers: {{
        'Accept': 'application/json',
        'User-Agent': 'VoiceReportApp/2.0',
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

// Function to find working backend
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

// Function to update ngrok URL dynamically
export const updateNgrokURL = (newUrl: string) => {{
  // Update the first URL in the array with new ngrok URL
  API_CONFIG.BACKEND_URLS[0] = newUrl;
  API_CONFIG.NGROK_URL = newUrl;
  console.log(`Updated ngrok URL to: ${{newUrl}}`);
}};

// Platform-specific configuration
export const PLATFORM_CONFIG = {{
  IS_IOS: Platform.OS === 'ios',
  IS_ANDROID: Platform.OS === 'android',
  IS_WEB: Platform.OS === 'web',
  
  // Audio recording presets based on platform
  AUDIO_PRESET: Platform.select({{
    ios: 'HIGH_QUALITY',
    android: 'HIGH_QUALITY',
    default: 'HIGH_QUALITY',
  }}),
}};

// Debug configuration
export const DEBUG_CONFIG = {{
  ENABLE_LOGS: __DEV__,
  ENABLE_PERFORMANCE_MONITORING: __DEV__,
  ENABLE_NETWORK_LOGGING: __DEV__,
  LOG_LEVEL: __DEV__ ? 'debug' : 'error',
}};
'''
        
        try:
            # Write the complete file
            with open(self.config_file, 'w', encoding='utf-8') as f:
                f.write(config_content)
            print(f"✅ Complete configuration generated: {self.config_file}")
            
            # Verify the file was written correctly
            if self.config_file.exists() and self.config_file.stat().st_size > 100:
                print(f"✅ Configuration file verified: {self.config_file.stat().st_size} bytes")
                return True
            else:
                print(f"❌ Configuration file appears to be empty or too small")
                return False
                
        except Exception as e:
            print(f"❌ Failed to generate configuration: {e}")
            return False
    
    def update_frontend_config(self, ngrok_url: Optional[str] = None):
        """Update the frontend configuration - alias for generate_complete_api_config"""
        return self.generate_complete_api_config(ngrok_url)
    
    def get_tunnel_info(self) -> Dict:
        """Get detailed information about all tunnels"""
        try:
            response = requests.get(self.ngrok_api_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except:
            return {"tunnels": []}
    
    def print_tunnel_status(self):
        """Print the current status of ngrok tunnels"""
        info = self.get_tunnel_info()
        tunnels = info.get('tunnels', [])
        
        if not tunnels:
            print("❌ No ngrok tunnels found")
            return
        
        print("🌐 Ngrok Tunnel Status:")
        print("=" * 50)
        
        for tunnel in tunnels:
            proto = tunnel.get('proto', 'unknown')
            public_url = tunnel.get('public_url', 'unknown')
            config = tunnel.get('config', {})
            addr = config.get('addr', 'unknown')
            
            print(f"  Protocol: {proto}")
            print(f"  Public URL: {public_url}")
            print(f"  Local Address: {addr}")
            print("-" * 30)
    
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
                response = requests.get(f"{url}/health", timeout=5)
                if response.status_code == 200:
                    print(f"✅ {url} - OK")
                    working_count += 1
                else:
                    print(f"❌ {url} - Status {response.status_code}")
            except Exception as e:
                print(f"❌ {url} - Failed: {e}")
        
        print(f"\n📊 Summary: {working_count}/{len(urls_to_test)} URLs working")
        return working_count > 0
    
    def verify_api_config(self):
        """Verify that the generated api-config.ts file has all required exports"""
        print("🔍 Verifying api-config.ts exports...")
        
        if not self.config_file.exists():
            print("❌ api-config.ts file does not exist")
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
                'export const DEBUG_CONFIG'
            ]
            
            missing_exports = []
            for export in required_exports:
                if export not in content:
                    missing_exports.append(export)
            
            if missing_exports:
                print(f"❌ Missing exports: {missing_exports}")
                return False
            else:
                print("✅ All required exports found in api-config.ts")
                return True
                
        except Exception as e:
            print(f"❌ Error reading api-config.ts: {e}")
            return False

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Ngrok URL Manager - Complete Config Generator')
    parser.add_argument('--start', action='store_true', help='Start ngrok and generate complete config')
    parser.add_argument('--update', action='store_true', help='Generate complete frontend config with current URLs')
    parser.add_argument('--url', action='store_true', help='Get current ngrok URL')
    parser.add_argument('--status', action='store_true', help='Show tunnel status')
    parser.add_argument('--test', action='store_true', help='Test connectivity')
    parser.add_argument('--verify', action='store_true', help='Verify api-config.ts has all exports')
    parser.add_argument('--port', type=int, default=8000, help='Backend port (default: 8000)')
    parser.add_argument('--frontend-dir', default='voice-report-app', help='Frontend directory')
    
    args = parser.parse_args()
    
    manager = NgrokManager(args.port, args.frontend_dir)
    
    if args.start:
        url = manager.start_ngrok()
        manager.generate_complete_api_config(url)
        manager.verify_api_config()
    elif args.update:
        result = manager.generate_complete_api_config()
        if result:
            manager.verify_api_config()
    elif args.url:
        url = manager.get_ngrok_url()
        if url:
            print(url)
        else:
            sys.exit(1)
    elif args.status:
        manager.print_tunnel_status()
    elif args.test:
        manager.test_connectivity()
    elif args.verify:
        manager.verify_api_config()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()