# Voice-to-Report App Startup Automation (Windows PowerShell)
# Simplified version to avoid PowerShell execution issues
param(
    [switch]$Stop,
    [switch]$RestartNgrok,
    [switch]$Help
)

# Configuration
$BackendDir = "backend"
$FrontendDir = "voice-report-app"
$BackendPort = 8000

# Helper function to write colored output
function WriteStatus($Message) {
    Write-Host "✅ $Message" -ForegroundColor Green
}

function WriteInfo($Message) {
    Write-Host "ℹ️ $Message" -ForegroundColor Blue
}

function WriteError($Message) {
    Write-Host "❌ $Message" -ForegroundColor Red
}

function WriteWarning($Message) {
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

# Function to stop all services
function StopAllServices {
    WriteInfo "Stopping all services..."
    
    # Stop backend
    if (Test-Path "backend.pid") {
        try {
            $BackendPid = Get-Content "backend.pid"
            Stop-Process -Id $BackendPid -Force -ErrorAction SilentlyContinue
            Remove-Item "backend.pid" -ErrorAction SilentlyContinue
            WriteInfo "Backend process stopped"
        }
        catch {
            WriteWarning "Could not stop backend process"
        }
    }
    
    # Stop ngrok
    if (Test-Path "ngrok.pid") {
        try {
            $NgrokPid = Get-Content "ngrok.pid"
            Stop-Process -Id $NgrokPid -Force -ErrorAction SilentlyContinue
            Remove-Item "ngrok.pid" -ErrorAction SilentlyContinue
            WriteInfo "Ngrok process stopped"
        }
        catch {
            WriteWarning "Could not stop ngrok process"
        }
    }
    
    # Stop frontend
    if (Test-Path "frontend.pid") {
        try {
            $FrontendPid = Get-Content "frontend.pid"
            Stop-Process -Id $FrontendPid -Force -ErrorAction SilentlyContinue
            Remove-Item "frontend.pid" -ErrorAction SilentlyContinue
            WriteInfo "Frontend process stopped"
        }
        catch {
            WriteWarning "Could not stop frontend process"
        }
    }
    
    # Kill any remaining processes
    Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    WriteStatus "All services stopped"
}

# Main execution logic
if ($Help) {
    Write-Host ""
    Write-Host "Voice-to-Report App Startup Script" -ForegroundColor Blue
    Write-Host "Usage: .\startup.ps1 [-Stop] [-RestartNgrok] [-Help]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Stop          Stop all running services"
    Write-Host "  -RestartNgrok  Restart ngrok tunnel with new URL"
    Write-Host "  -Help          Show this help message"
    Write-Host ""
    exit 0
}

if ($Stop) {
    StopAllServices
    exit 0
}

if ($RestartNgrok) {
    WriteInfo "Restarting ngrok tunnel..."
    
    # Stop ngrok
    Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if (Test-Path "ngrok.pid") {
        Remove-Item "ngrok.pid" -ErrorAction SilentlyContinue
    }
    
    # Start ngrok
    WriteInfo "Starting new ngrok tunnel..."
    Start-Process -FilePath "ngrok" -ArgumentList "http", $BackendPort -WindowStyle Hidden
    Start-Sleep 3
    
    # Update config using Python script
    try {
        & python ngrok_manager.py --update
        WriteStatus "Ngrok tunnel restarted and configuration updated"
    }
    catch {
        WriteError "Failed to update configuration"
    }
    
    exit 0
}

# Main startup sequence
Write-Host "🚀 Voice-to-Report App Startup Automation" -ForegroundColor Blue
Write-Host "================================================"

# Stop any existing services first
StopAllServices

# Check prerequisites
WriteInfo "Checking prerequisites..."
$missing = @()

try { Get-Command "python" -ErrorAction Stop | Out-Null } catch { $missing += "Python 3" }
try { Get-Command "node" -ErrorAction Stop | Out-Null } catch { $missing += "Node.js" }
try { Get-Command "npm" -ErrorAction Stop | Out-Null } catch { $missing += "npm" }
try { Get-Command "ngrok" -ErrorAction Stop | Out-Null } catch { $missing += "ngrok" }

if ($missing.Count -gt 0) {
    WriteError "Missing prerequisites: $($missing -join ', ')"
    WriteError "Please install the missing software and try again"
    exit 1
}
WriteStatus "All prerequisites are installed"

# Start backend
WriteInfo "Starting backend server..."
try {
    Set-Location $BackendDir
    
    # Create virtual environment if it doesn't exist
    if (-not (Test-Path "venv")) {
        WriteInfo "Creating virtual environment..."
        python -m venv venv
    }
    
    # Activate virtual environment and install dependencies
    WriteInfo "Installing Python dependencies..."
    & "venv\Scripts\python.exe" -m pip install -r requirements.txt | Out-Null
    
    # Check .env file
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            WriteWarning "Created .env from .env.example. Please configure your OPENAI_API_KEY"
        }
        else {
            WriteError ".env file is missing"
            Set-Location ..
            exit 1
        }
    }
    
    # Start backend server
    WriteInfo "Starting FastAPI server on port $BackendPort..."
    $BackendProcess = Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", $BackendPort, "--reload" -PassThru -WindowStyle Hidden
    
    if ($BackendProcess) {
        $BackendProcess.Id | Out-File "..\backend.pid"
        WriteStatus "Backend server started (Process ID: $($BackendProcess.Id))"
    }
    else {
        WriteError "Failed to start backend server"
        Set-Location ..
        exit 1
    }
    
    Set-Location ..
    
    # Wait for backend to start
    WriteInfo "Waiting for backend to start..."
    Start-Sleep 8
    
    # Test backend
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$BackendPort/health" -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            WriteStatus "Backend health check passed"
        }
        else {
            WriteWarning "Backend health check returned status $($response.StatusCode)"
        }
    }
    catch {
        WriteWarning "Backend health check failed, but continuing..."
    }
}
catch {
    WriteError "Failed to start backend: $($_.Exception.Message)"
    Set-Location .. -ErrorAction SilentlyContinue
    exit 1
}

# Start ngrok
WriteInfo "Starting ngrok tunnel..."
try {
    $NgrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http", $BackendPort -PassThru -WindowStyle Hidden
    if ($NgrokProcess) {
        $NgrokProcess.Id | Out-File "ngrok.pid"
        WriteStatus "Ngrok tunnel started (Process ID: $($NgrokProcess.Id))"
    }
    
    # Wait for ngrok to establish tunnel
    WriteInfo "Waiting for ngrok to establish tunnel..."
    Start-Sleep 8
    
    # Update frontend configuration
    WriteInfo "Updating frontend configuration..."
    try {
        & python ngrok_manager.py --update
        WriteStatus "Frontend configuration updated"
    }
    catch {
        WriteWarning "Failed to update frontend configuration automatically"
        WriteInfo "You may need to update the ngrok URL manually"
    }
}
catch {
    WriteError "Failed to start ngrok: $($_.Exception.Message)"
}

# Start frontend
WriteInfo "Starting frontend application..."
try {
    Set-Location $FrontendDir
    
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        WriteInfo "Installing frontend dependencies..."
        npm install
    }
    
    # Start frontend
    WriteInfo "Starting Expo development server..."
    $FrontendProcess = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru
    if ($FrontendProcess) {
        $FrontendProcess.Id | Out-File "..\frontend.pid"
        WriteStatus "Frontend started (Process ID: $($FrontendProcess.Id))"
    }
    
    Set-Location ..
}
catch {
    WriteError "Failed to start frontend: $($_.Exception.Message)"
    Set-Location .. -ErrorAction SilentlyContinue
}

# Show completion info
Write-Host ""
WriteStatus "🎉 Startup Complete!"
Write-Host "=================================="
Write-Host "Backend: http://localhost:$BackendPort" -ForegroundColor Blue

# Try to get ngrok URL
try {
    $NgrokUrl = & python ngrok_manager.py --url 2>$null
    if ($NgrokUrl) {
        Write-Host "Ngrok URL: $NgrokUrl" -ForegroundColor Blue
    }
    else {
        Write-Host "Ngrok URL: Check ngrok dashboard at http://localhost:4040" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Ngrok URL: Check ngrok dashboard at http://localhost:4040" -ForegroundColor Yellow
}

Write-Host "Frontend: Check the Expo DevTools" -ForegroundColor Blue
Write-Host ""
Write-Host "📱 To test on mobile:" -ForegroundColor Yellow
Write-Host "1. Open Expo Go app on your phone"
Write-Host "2. Scan the QR code from the terminal"
Write-Host "3. The app will automatically use the ngrok URL"
Write-Host ""
Write-Host "🔄 To restart ngrok tunnel:" -ForegroundColor Yellow
Write-Host ".\startup.ps1 -RestartNgrok"
Write-Host ""
Write-Host "🛑 To stop all services:" -ForegroundColor Yellow
Write-Host ".\startup.ps1 -Stop"
Write-Host ""
WriteInfo "Press Ctrl+C to stop all services"

# Keep script running
try {
    while ($true) {
        Start-Sleep 1
    }
}
finally {
    WriteInfo "Stopping services..."
    StopAllServices
}