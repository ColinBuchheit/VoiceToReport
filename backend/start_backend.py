import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_python_version():
    """Check if Python version is 3.8+"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        sys.exit(1)
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor}")

def check_env_file():
    """Check and create .env file if needed"""
    env_path = Path(".env")
    env_example_path = Path(".env.example")
    
    if not env_path.exists():
        if env_example_path.exists():
            print("📋 Creating .env from .env.example...")
            shutil.copy(env_example_path, env_path)
            print("⚠️  Please edit .env and add your OPENAI_API_KEY")
            return False
        else:
            print("❌ No .env or .env.example file found!")
            return False
    
    # Check if OPENAI_API_KEY is set
    from dotenv import load_dotenv
    load_dotenv()
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key or api_key == 'your_openai_api_key_here':
        print("❌ OPENAI_API_KEY not configured in .env file!")
        print("Please edit .env and add your OpenAI API key")
        return False
    
    print("✅ Environment configuration found")
    return True

def install_dependencies():
    """Install Python dependencies"""
    print("📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True, capture_output=True)
        print("✅ Dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False

def validate_services():
    """Validate that all services can be imported"""
    print("🔍 Validating services...")
    try:
        # Test imports
        from config import settings
        from services.transcription import TranscriptionService
        from services.summarization import SummarizationService
        from services.pdf_generator import PDFGenerator
        from models import TranscribeRequest, SummarizeRequest, GeneratePDFRequest
        
        print("✅ All services validated")
        return True
    except ImportError as e:
        print(f"❌ Service validation failed: {e}")
        return False

def start_server():
    """Start the FastAPI server"""
    print("🚀 Starting Voice-to-Report Backend...")
    print("📍 Server will be available at: http://localhost:8000")
    print("📋 API docs will be available at: http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop the server\n")
    
    try:
        os.system(f"{sys.executable} -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
    except KeyboardInterrupt:
        print("\n👋 Server stopped")

def main():
    """Main startup sequence"""
    print("Voice-to-Report Backend Startup")
    print("=" * 40)
    
    # Change to backend directory if not already there
    if not Path("main.py").exists():
        backend_path = Path("backend")
        if backend_path.exists():
            os.chdir(backend_path)
            print("📁 Changed to backend directory")
        else:
            print("❌ Cannot find main.py or backend directory!")
            sys.exit(1)
    
    # Run validation steps
    check_python_version()
    
    if not check_env_file():
        sys.exit(1)
    
    if not install_dependencies():
        sys.exit(1)
    
    if not validate_services():
        sys.exit(1)
    
    # Start server
    start_server()

if __name__ == "__main__":
    main()