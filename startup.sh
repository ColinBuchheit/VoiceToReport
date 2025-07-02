#!/bin/bash

# Voice-to-Report App Complete Startup Automation
# Place this file in your project root directory
# Make executable with: chmod +x startup.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="voice-report-app"
BACKEND_PORT=8000
NGROK_CONFIG_FILE=".ngrok_url"
API_CONFIG_FILE="${FRONTEND_DIR}/services/api-config.ts"

echo -e "${BLUE}🚀 Voice-to-Report App Startup Automation${NC}"
echo "================================================"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command_exists python3; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command_exists ngrok; then
        print_error "ngrok is not installed. Please install it from https://ngrok.com/"
        exit 1
    fi
    
    print_status "All prerequisites are installed"
}

# Function to start backend
start_backend() {
    print_info "Starting backend server..."
    
    cd "$BACKEND_DIR"
    
    # Check if virtual environment exists, create if not
    if [ ! -d "venv" ]; then
        print_info "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    print_info "Installing Python dependencies..."
    pip install -r requirements.txt > /dev/null 2>&1
    
    # Check .env file
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env from .env.example. Please configure your OPENAI_API_KEY"
        else
            print_error ".env file is missing"
            exit 1
        fi
    fi
    
    # Start the backend server in background
    print_info "Starting FastAPI server on port $BACKEND_PORT..."
    nohup python -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload > backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    
    # Wait for backend to start
    print_info "Waiting for backend to start..."
    sleep 5
    
    # Check if backend is running
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
        print_status "Backend server started successfully (PID: $BACKEND_PID)"
    else
        print_error "Failed to start backend server"
        exit 1
    fi
    
    cd ..
}

# Function to start ngrok and get the URL
start_ngrok() {
    print_info "Starting ngrok tunnel..."
    
    # Kill any existing ngrok processes
    pkill -f ngrok || true
    sleep 2
    
    # Start ngrok in background
    nohup ngrok http $BACKEND_PORT > ngrok.log 2>&1 &
    NGROK_PID=$!
    echo $NGROK_PID > ngrok.pid
    
    # Wait for ngrok to start and get URL
    print_info "Waiting for ngrok to establish tunnel..."
    sleep 5
    
    # Use Python script to get ngrok URL
    python3 ngrok_manager.py --url > /dev/null
    if [ $? -eq 0 ]; then
        NGROK_URL=$(python3 ngrok_manager.py --url)
        echo "$NGROK_URL" > "$NGROK_CONFIG_FILE"
        print_status "Ngrok tunnel established: $NGROK_URL"
    else
        print_error "Failed to get ngrok URL"
        exit 1
    fi
}

# Function to update frontend configuration
update_frontend_config() {
    print_info "Updating frontend configuration with ngrok URL..."
    
    # Use Python script to update configuration
    python3 ngrok_manager.py --update
    
    print_status "Frontend configuration updated"
}

# Function to update the main API service file
update_api_service() {
    print_info "Updating API service to use dynamic configuration..."
    
    # Backup original file if it doesn't have .backup extension
    if [ -f "${FRONTEND_DIR}/services/api.ts" ] && [ ! -f "${FRONTEND_DIR}/services/api.ts.backup" ]; then
        cp "${FRONTEND_DIR}/services/api.ts" "${FRONTEND_DIR}/services/api.ts.backup"
    fi
    
    # Create updated api.ts file
    cat > "${FRONTEND_DIR}/services/api.ts" << 'EOF'
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from './api-config';

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
  
  for (const url of API_CONFIG.BACKEND_URLS) {
    try {
      console.log(`Testing: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VoiceReportApp/1.0',
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
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'audio.m4a',
  } as any);

  try {
    console.log(`🎙️ Transcribing audio using: ${workingBackendUrl}`);
    const response = await axios.post(`${workingBackendUrl}/transcribe`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    console.error('Transcription failed:', error);
    throw new Error('Failed to transcribe audio. Please check your connection and try again.');
  }
}

export async function summarizeText(transcription: string): Promise<SummaryResponse> {
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📝 Summarizing text using: ${workingBackendUrl}`);
    const response = await axios.post(`${workingBackendUrl}/summarize`, {
      text: transcription
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error('Summarization failed:', error);
    throw new Error('Failed to summarize text. Please check your connection and try again.');
  }
}

export async function generatePDF(summary: any): Promise<{ pdf_url: string }> {
  const workingBackendUrl = await findWorkingBackend();
  
  if (!workingBackendUrl) {
    throw new Error(`No backend server found! Tried: ${API_CONFIG.BACKEND_URLS.join(', ')}`);
  }

  try {
    console.log(`📄 Generating PDF using: ${workingBackendUrl}`);
    const response = await axios.post(`${workingBackendUrl}/generate-pdf`, summary, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF. Please check your connection and try again.');
  }
}
EOF
    
    print_status "API service updated with dynamic configuration"
}

# Function to start frontend
start_frontend() {
    print_info "Starting frontend application..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_info "Installing frontend dependencies..."
        npm install
    fi
    
    # Start the frontend in TUNNEL mode for mobile connectivity
    print_info "Starting Expo development server in TUNNEL mode..."
    print_info "This enables mobile device connectivity through Expo's tunneling service"
    npx expo start --tunnel &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    
    cd ..
    print_status "Frontend started in tunnel mode (PID: $FRONTEND_PID)"
}

# Function to display connection info
display_info() {
    echo ""
    echo -e "${GREEN}🎉 Startup Complete!${NC}"
    echo "=================================="
    echo -e "${BLUE}Backend:${NC} http://localhost:$BACKEND_PORT"
    echo -e "${BLUE}Ngrok URL:${NC} $NGROK_URL"
    echo -e "${BLUE}Frontend:${NC} Expo DevTools (tunnel mode enabled)"
    echo -e "${BLUE}Ngrok Dashboard:${NC} http://localhost:4040"
    echo ""
    echo -e "${YELLOW}📱 Mobile Connection Setup:${NC}"
    echo "1. Wait for Expo tunnel to establish (may take 30-60 seconds)"
    echo "2. Open Expo Go app on your phone"
    echo "3. Scan the QR code from the Expo DevTools"
    echo "4. The app will connect through Expo's tunnel service"
    echo "5. Your app will automatically use the ngrok URL for API calls"
    echo ""
    echo -e "${YELLOW}⚠️ Note: First tunnel connection may be slow, please be patient${NC}"
    echo ""
    echo -e "${YELLOW}🔄 To restart ngrok tunnel:${NC}"
    echo "./startup.sh --restart-ngrok"
    echo ""
    echo -e "${YELLOW}🛑 To stop all services:${NC}"
    echo "./startup.sh --stop"
}

# Function to stop all services
stop_services() {
    print_info "Stopping all services..."
    
    # Stop backend
    if [ -f "backend.pid" ]; then
        kill $(cat backend.pid) 2>/dev/null || true
        rm backend.pid
    fi
    
    # Stop ngrok
    if [ -f "ngrok.pid" ]; then
        kill $(cat ngrok.pid) 2>/dev/null || true
        rm ngrok.pid
    fi
    
    # Stop frontend
    if [ -f "frontend.pid" ]; then
        kill $(cat frontend.pid) 2>/dev/null || true
        rm frontend.pid
    fi
    
    # Kill any remaining processes
    pkill -f "uvicorn main:app" || true
    pkill -f ngrok || true
    pkill -f "expo start" || true
    
    print_status "All services stopped"
}

# Function to restart ngrok only
restart_ngrok() {
    print_info "Restarting ngrok tunnel..."
    
    # Stop ngrok
    if [ -f "ngrok.pid" ]; then
        kill $(cat ngrok.pid) 2>/dev/null || true
        rm ngrok.pid
    fi
    pkill -f ngrok || true
    
    # Start ngrok again
    start_ngrok
    update_frontend_config
    
    print_status "Ngrok tunnel restarted with new URL: $NGROK_URL"
}

# Main execution
case "${1:-}" in
    --stop)
        stop_services
        exit 0
        ;;
    --restart-ngrok)
        restart_ngrok
        exit 0
        ;;
    --help)
        echo "Usage: $0 [--stop|--restart-ngrok|--help]"
        echo "  --stop          Stop all running services"
        echo "  --restart-ngrok Restart ngrok tunnel with new URL"
        echo "  --help          Show this help message"
        exit 0
        ;;
esac

# Stop any existing services first
stop_services

# Run the startup sequence
check_prerequisites
start_backend
start_ngrok
update_frontend_config
update_api_service
start_frontend
display_info

# Keep script running
print_info "Press Ctrl+C to stop all services"
trap stop_services INT TERM

# Wait for user interrupt
while true; do
    sleep 1
done