#!/bin/bash

# Enhanced Voice-to-Report App Startup Script
# This script ensures proper gateway routing and API configuration

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="voice-report-app"
BACKEND_PORT=8000
NGROK_CONFIG_FILE="ngrok_url.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_status() {
    echo -e "${GREEN}🟢 $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    local missing=false
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        missing=true
    fi
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        missing=true
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        missing=true
    fi
    
    if ! command -v ngrok &> /dev/null; then
        print_error "ngrok is not installed"
        missing=true
    fi
    
    if [ "$missing" = true ]; then
        print_error "Missing prerequisites. Please install the required software."
        exit 1
    fi
    
    print_success "All prerequisites found"
}

# Function to stop existing services
stop_existing_services() {
    print_info "Stopping existing services..."
    
    # Kill existing processes
    pkill -f "uvicorn main:app" || true
    pkill -f "ngrok" || true
    pkill -f "expo start" || true
    
    # Remove PID files
    rm -f backend.pid ngrok.pid frontend.pid
    
    print_success "Existing services stopped"
}

# Function to start backend
start_backend() {
    print_info "Starting backend server..."
    
    cd "$BACKEND_DIR"
    
    # Check for Python virtual environment
    if [ ! -d "venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install requirements
    if [ -f "requirements.txt" ]; then
        print_info "Installing Python dependencies..."
        pip install -r requirements.txt > /dev/null 2>&1
    fi
    
    # Check for .env file
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
    nohup python -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    
    # Wait for backend to start
    print_info "Waiting for backend to start..."
    sleep 5
    
    # Check if backend is running
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
        print_success "Backend server started successfully (PID: $BACKEND_PID)"
    else
        print_error "Failed to start backend server. Check backend.log for details."
        cat ../backend.log
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
    sleep 8
    
    # Use Python script to get ngrok URL and update config
    python3 ngrok_manager.py --update
    if [ $? -eq 0 ]; then
        NGROK_URL=$(python3 ngrok_manager.py --url)
        if [ ! -z "$NGROK_URL" ]; then
            echo "$NGROK_URL" > "$NGROK_CONFIG_FILE"
            print_success "Ngrok tunnel established: $NGROK_URL"
        else
            print_warning "Ngrok tunnel started but URL not yet available"
        fi
    else
        print_warning "Failed to get ngrok URL immediately - it may still be starting"
    fi
}

# Function to update frontend configuration
update_frontend_config() {
    print_info "Updating frontend configuration with current URLs..."
    
    # Ensure frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Frontend directory '$FRONTEND_DIR' not found"
        exit 1
    fi
    
    # Use Python script to update configuration
    python3 ngrok_manager.py --update
    
    if [ $? -eq 0 ]; then
        print_success "Frontend configuration updated"
    else
        print_warning "Frontend configuration update had issues"
    fi
}

# Function to start frontend
start_frontend() {
    print_info "Starting frontend application..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_info "Installing frontend dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            print_error "Failed to install frontend dependencies"
            exit 1
        fi
    fi
    
    # Check if Expo CLI is available
    if ! command -v expo &> /dev/null && ! npx expo --version &> /dev/null; then
        print_info "Installing Expo CLI..."
        npm install -g @expo/cli
    fi
    
    # Start the frontend in TUNNEL mode for mobile connectivity
    print_info "Starting Expo development server in TUNNEL mode..."
    print_info "This enables mobile device connectivity through Expo's tunneling service"
    
    # Start expo in background
    nohup npx expo start --tunnel --clear > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    
    cd ..
    print_success "Frontend started in tunnel mode (PID: $FRONTEND_PID)"
}

# Function to test connectivity
test_connectivity() {
    print_info "Testing backend connectivity..."
    
    # Use the Python script to test all URLs
    python3 ngrok_manager.py --test
}

# Function to display connection info
display_info() {
    echo ""
    echo -e "${GREEN}🎉 Startup Complete!${NC}"
    echo "=================================="
    echo -e "${BLUE}Backend:${NC} http://localhost:$BACKEND_PORT"
    
    # Try to get ngrok URL
    NGROK_URL=$(python3 ngrok_manager.py --url 2>/dev/null)
    if [ ! -z "$NGROK_URL" ]; then
        echo -e "${BLUE}Ngrok URL:${NC} $NGROK_URL"
    else
        echo -e "${YELLOW}Ngrok URL:${NC} Still establishing..."
    fi
    
    echo -e "${BLUE}Frontend:${NC} Expo DevTools (tunnel mode enabled)"
    echo -e "${BLUE}Ngrok Dashboard:${NC} http://localhost:4040"
    echo ""
    echo -e "${YELLOW}📱 Mobile Connection Setup:${NC}"
    echo "1. Wait for Expo tunnel to establish (may take 30-60 seconds)"
    echo "2. Open Expo Go app on your phone"
    echo "3. Scan the QR code from the Expo DevTools"
    echo "4. The app will automatically find the working backend URL"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting:${NC}"
    echo "• Check backend.log if backend issues occur"
    echo "• Check frontend.log if Expo issues occur" 
    echo "• Check ngrok.log if tunnel issues occur"
    echo "• Visit http://localhost:4040 for ngrok dashboard"
    echo "• Run 'python3 ngrok_manager.py --test' to test connectivity"
    echo ""
    echo -e "${BLUE}🛑 To stop all services:${NC}"
    echo "./startup.sh --stop"
}

# Function to stop all services
stop_services() {
    print_info "Stopping all services..."
    
    # Stop backend
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        kill $BACKEND_PID 2>/dev/null || true
        rm -f backend.pid
        print_success "Backend stopped"
    fi
    
    # Stop ngrok
    if [ -f "ngrok.pid" ]; then
        NGROK_PID=$(cat ngrok.pid)
        kill $NGROK_PID 2>/dev/null || true
        rm -f ngrok.pid
        print_success "Ngrok stopped"
    fi
    
    # Stop frontend
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        kill $FRONTEND_PID 2>/dev/null || true
        rm -f frontend.pid
        print_success "Frontend stopped"
    fi
    
    # Kill any remaining processes
    pkill -f "uvicorn main:app" || true
    pkill -f "ngrok" || true
    pkill -f "expo start" || true
    
    print_success "All services stopped"
}

# Function to restart just ngrok
restart_ngrok() {
    print_info "Restarting ngrok tunnel..."
    
    # Stop ngrok
    if [ -f "ngrok.pid" ]; then
        NGROK_PID=$(cat ngrok.pid)
        kill $NGROK_PID 2>/dev/null || true
        rm -f ngrok.pid
    fi
    pkill -f ngrok || true
    sleep 2
    
    # Start ngrok
    start_ngrok
    update_frontend_config
    
    print_success "Ngrok restarted and configuration updated"
}

# Function to show help
show_help() {
    echo ""
    echo -e "${BLUE}Voice-to-Report App Startup Script${NC}"
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --stop              Stop all running services"
    echo "  --restart-ngrok     Restart ngrok tunnel with new URL"
    echo "  --test              Test backend connectivity"
    echo "  --status            Show service status"
    echo "  --help              Show this help message"
    echo ""
    echo "Default (no options): Start all services"
    echo ""
}

# Function to show service status
show_status() {
    echo ""
    echo -e "${BLUE}Service Status:${NC}"
    echo "=============="
    
    # Check backend
    if [ -f "backend.pid" ] && kill -0 $(cat backend.pid) 2>/dev/null; then
        echo -e "${GREEN}Backend: Running (PID: $(cat backend.pid))${NC}"
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
            echo -e "  └─ Health check: ${GREEN}OK${NC}"
        else
            echo -e "  └─ Health check: ${RED}Failed${NC}"
        fi
    else
        echo -e "${RED}Backend: Not running${NC}"
    fi
    
    # Check ngrok
    if [ -f "ngrok.pid" ] && kill -0 $(cat ngrok.pid) 2>/dev/null; then
        echo -e "${GREEN}Ngrok: Running (PID: $(cat ngrok.pid))${NC}"
        NGROK_URL=$(python3 ngrok_manager.py --url 2>/dev/null)
        if [ ! -z "$NGROK_URL" ]; then
            echo -e "  └─ URL: ${GREEN}$NGROK_URL${NC}"
        else
            echo -e "  └─ URL: ${YELLOW}Not available yet${NC}"
        fi
    else
        echo -e "${RED}Ngrok: Not running${NC}"
    fi
    
    # Check frontend
    if [ -f "frontend.pid" ] && kill -0 $(cat frontend.pid) 2>/dev/null; then
        echo -e "${GREEN}Frontend: Running (PID: $(cat frontend.pid))${NC}"
    else
        echo -e "${RED}Frontend: Not running${NC}"
    fi
    
    echo ""
}

# Main execution logic
main() {
    echo ""
    echo -e "${BLUE}🚀 Voice-to-Report App Manager${NC}"
    echo "==============================="
    
    case "${1:-}" in
        --stop)
            stop_services
            exit 0
            ;;
        --restart-ngrok)
            restart_ngrok
            display_info
            exit 0
            ;;
        --test)
            test_connectivity
            exit 0
            ;;
        --status)
            show_status
            exit 0
            ;;
        --help)
            show_help
            exit 0
            ;;
        "")
            # Default: start all services
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
    
    # Start all services
    check_prerequisites
    stop_existing_services
    start_backend
    start_ngrok
    update_frontend_config
    start_frontend
    
    # Wait a moment for services to fully initialize
    sleep 3
    
    # Test connectivity
    test_connectivity
    
    # Display final information
    display_info
    
    # Keep script running to show real-time status
    echo ""
    echo -e "${YELLOW}⏳ Services are starting up...${NC}"
    echo "Press Ctrl+C to stop monitoring (services will continue running)"
    echo ""
    
    # Monitor for the first 60 seconds
    for i in {1..12}; do
        sleep 5
        echo -ne "${BLUE}⏱️  Monitoring... (${i}0s)${NC}\r"
        
        # Check if ngrok URL is available now
        if [ $i -eq 6 ]; then  # After 30 seconds
            NGROK_URL=$(python3 ngrok_manager.py --url 2>/dev/null)
            if [ ! -z "$NGROK_URL" ]; then
                echo ""
                print_success "Ngrok URL now available: $NGROK_URL"
                python3 ngrok_manager.py --update
                print_success "Frontend configuration refreshed"
            fi
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ All services should now be fully operational!${NC}"
    echo ""
    show_status
}

# Run main function with all arguments
main "$@"