#!/usr/bin/env python3
"""
Ngrok URL Manager
Place this file in your project root directory
This script helps manage ngrok tunnels and automatically updates frontend configuration
"""

import json
import requests
import time
import subprocess
import sys
import os
from pathlib import Path
from typing import Optional, Dict, List

class NgrokManager:
    def __init__(self, backend_port: int = 8000, frontend_dir: str = "voice-report-app"):
        self.backend_port = backend_port
        self.frontend_dir = frontend_dir
        self.ngrok_api_url = "http://localhost:4040/api/tunnels"
        self.config_file = Path(frontend_dir) / "services" / "api-config.ts"
        
    def get_ngrok_url(self) -> Optional[str]:
        """Get the current ngrok HTTPS URL"""
        try:
            response = requests.get(self.ngrok_api_url, timeout=5)
            response.raise_for_status()
            
            tunnels = response.json().get('tunnels', [])
            
            for tunnel in tunnels:
                if tunnel.get('proto') == 'https':
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
    
    def update_frontend_config(self, ngrok_url: str):
        """Update the frontend configuration with the new ngrok URL"""
        print("📝 Updating frontend configuration...")
        
        # Ensure the services directory exists
        services_dir = Path(self.frontend_dir) / "services"
        services_dir.mkdir(exist_ok=True)
        
        config_content = f'''// Auto-generated API configuration
// This file is automatically updated by the startup script
// Last updated: {time.strftime("%Y-%m-%d %H:%M:%S")}

export const API_CONFIG = {{
  NGROK_URL: '{ngrok_url}',
  LOCAL_URL: 'http://localhost:{self.backend_port}',
  BACKEND_URLS: [
    '{ngrok_url}',
    'http://localhost:{self.backend_port}'
  ]
}};

// Function to get the current backend URL
export const getCurrentBackendUrl = (): string => {{
  // In development, prefer ngrok URL for mobile testing
  if (__DEV__) {{
    return API_CONFIG.NGROK_URL;
  }}
  return API_CONFIG.LOCAL_URL;
}};

// Helper function to test if a URL is reachable
export const testBackendConnection = async (url: string): Promise<boolean> => {{
  try {{
    const response = await fetch(`${{url}}/health`, {{
      method: 'GET',
      timeout: 5000,
      headers: {{
        'Accept': 'application/json',
        'User-Agent': 'VoiceReportApp/1.0',
      }},
    }});
    return response.ok;
  }} catch {{
    return false;
  }}
}};
'''
        
        try:
            with open(self.config_file, 'w') as f:
                f.write(config_content)
            print(f"✅ Configuration updated: {self.config_file}")
        except Exception as e:
            print(f"❌ Failed to update configuration: {e}")
    
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

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Ngrok URL Manager for Voice Report App")
    parser.add_argument("--port", type=int, default=8000, help="Backend port (default: 8000)")
    parser.add_argument("--frontend-dir", default="voice-report-app", help="Frontend directory")
    parser.add_argument("--start", action="store_true", help="Start ngrok and update config")
    parser.add_argument("--update", action="store_true", help="Update config with current ngrok URL")
    parser.add_argument("--status", action="store_true", help="Show current tunnel status")
    parser.add_argument("--url", action="store_true", help="Get current ngrok URL")
    
    args = parser.parse_args()
    
    manager = NgrokManager(backend_port=args.port, frontend_dir=args.frontend_dir)
    
    if args.start:
        url = manager.start_ngrok()
        if url:
            manager.update_frontend_config(url)
            print(f"🎉 Ngrok started successfully: {url}")
        else:
            print("❌ Failed to start ngrok")
            sys.exit(1)
    
    elif args.update:
        url = manager.get_ngrok_url()
        if url:
            manager.update_frontend_config(url)
            print(f"✅ Configuration updated with URL: {url}")
        else:
            print("❌ No ngrok URL found")
            sys.exit(1)
    
    elif args.status:
        manager.print_tunnel_status()
    
    elif args.url:
        url = manager.get_ngrok_url()
        if url:
            print(url)
        else:
            print("No ngrok URL found")
            sys.exit(1)
    
    else:
        print("Please specify an action: --start, --update, --status, or --url")
        parser.print_help()

if __name__ == "__main__":
    main()