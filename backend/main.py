# backend/main.py - FIXED ASYNC ISSUE
import os
import tempfile
import base64
import logging
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from openai import OpenAI
from dotenv import load_dotenv

# Import models and services
from models import (
    TranscribeRequest, TranscriptionResponse,
    SummarizeRequest, SummaryResponse, 
    SendEmailRequest, EmailResponse,
    VoiceCommandRequest, VoiceCommandResponse,
    HealthResponse,
    BugReportRequest, BugReportResponse
)
from services.transcription import TranscriptionService
from services.summarization import SummarizationService
from services.email_service import EmailService
from services.voice_agent import VoiceAgentService
# Try Azure config first, fall back to local config on any failure
try:
    import config_azure as _config_azure
    settings = _config_azure.settings
    print("✅ Using Azure configuration")
except Exception:
    from config import settings
    print("ℹ️ Using local configuration")

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def cors_origin_validator(origin: str) -> bool:
    """
    Custom origin validator for secure CORS handling
    """
    if not origin:
        return False

    # NEW: Allow Azure domains
    if ".azurewebsites.net" in origin:
        logger.info(f"✅ Allowing Azure origin: {origin}")
        return True
    
    # Allow ngrok domains (they change dynamically)
    ngrok_patterns = [".ngrok.io", ".ngrok-free.app", ".ngrok.app"]
    for pattern in ngrok_patterns:
        if pattern in origin:
            logger.info(f"✅ Allowing ngrok origin: {origin}")
            return True
    
    # Allow local development origins
    local_patterns = [
        "http://localhost:",
        "http://127.0.0.1:",
        "exp://localhost:",
        "exp://127.0.0.1:",
    ]
    for pattern in local_patterns:
        if origin.startswith(pattern):
            logger.info(f"✅ Allowing local development origin: {origin}")
            return True
    
    # Allow local network origins (for mobile testing)
    local_network_patterns = [
        "http://192.168.",
        "http://10.0.",
        "http://172.16.",
    ]
    for pattern in local_network_patterns:
        if origin.startswith(pattern):
            logger.info(f"✅ Allowing local network origin: {origin}")
            return True
    
    # Check against environment-specified origins
    env_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
    if env_origins:
        allowed_list = [o.strip() for o in env_origins.split(",") if o.strip()]
        if origin in allowed_list:
            logger.info(f"✅ Allowing environment-specified origin: {origin}")
            return True
    
    logger.warning(f"❌ Rejecting origin: {origin}")
    return False

# Initialize FastAPI app
app = FastAPI(
    title="Voice-to-Report API",
    description="API for processing voice recordings into structured field service closeout reports",
    version="2.0.0"
)

# SECURE CORS MIDDLEWARE - Custom implementation
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    """
    Custom CORS middleware with secure defaults and development flexibility
    """
    response = await call_next(request)
    
    # Get the origin from the request
    origin = request.headers.get("origin")
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        # Validate origin
        if origin and cors_origin_validator(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            response.headers["Access-Control-Allow-Origin"] = "null"
        
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = (
            "Content-Type, Authorization, X-API-Key, ngrok-skip-browser-warning, "
            "User-Agent, Accept, Cache-Control"
        )
        response.headers["Access-Control-Max-Age"] = "3600"
        response.status_code = 200
        return response
    
    # Handle actual requests
    if origin and cors_origin_validator(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Ngrok-specific headers
    response.headers["ngrok-skip-browser-warning"] = "true"
    
    return response

# Initialize OpenAI client using settings
def _get_openai_api_key() -> str | None:
    """Extract OpenAI API key as a plain string from settings or environment."""
    val = getattr(settings, "openai_api_key", None)
    try:
        # Support SecretStr from pydantic
        if val is not None and hasattr(val, "get_secret_value"):
            val = val.get_secret_value()
    except Exception:
        pass
    # Normalize blanks
    if isinstance(val, str) and not val.strip():
        val = None
    # Fallback to environment
    return val or os.getenv("OPENAI_API_KEY")

openai_client = None
_api_key = _get_openai_api_key()
if _api_key:
    try:
        openai_client = OpenAI(api_key=_api_key)
        logger.info("OpenAI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")
else:
    logger.warning("OpenAI API key not found (OPENAI_API_KEY)")

# Initialize services with proper error handling
try:
    transcription_service = TranscriptionService(openai_client) if openai_client else None
    logger.info("Transcription service initialized")
except Exception as e:
    logger.error(f"Failed to initialize transcription service: {e}")
    transcription_service = None

try:
    summarization_service = SummarizationService(openai_client) if openai_client else None
    logger.info("Summarization service initialized")
except Exception as e:
    logger.error(f"Failed to initialize summarization service: {e}")
    summarization_service = None

try:
    voice_agent_service = VoiceAgentService() if openai_client else None
    logger.info("Voice agent service initialized")
except Exception as e:
    logger.error(f"Failed to initialize voice agent service: {e}")
    voice_agent_service = None

try:
    email_service = EmailService()
    logger.info("Email service initialized")
except Exception as e:
    logger.error(f"Failed to initialize email service: {e}")
    email_service = None

# Helper functions
def validate_audio_format(format_str: str) -> bool:
    """Validate that the audio format is supported"""
    supported_formats = ['m4a', 'mp4', 'wav', 'mp3', 'webm']
    return format_str.lower() in supported_formats

def decode_audio_data(audio_data: str) -> bytes:
    """Decode base64 audio data with error handling"""
    try:
        # Remove data URL prefix if present
        if audio_data.startswith('data:'):
            audio_data = audio_data.split(',', 1)[1]
        
        # Decode base64
        audio_bytes = base64.b64decode(audio_data)
        logger.info(f"Decoded audio: {len(audio_bytes)} bytes")
        
        # Validate size (25MB limit)
        if len(audio_bytes) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")
            
        return audio_bytes
    except Exception as e:
        logger.error(f"Failed to decode audio data: {e}")
        raise HTTPException(status_code=400, detail="Invalid audio data")

# API Endpoints

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Enhanced health check with CORS configuration info"""
    services = {
        "transcription": "available" if transcription_service else "unavailable",
        "summarization": "available" if summarization_service else "unavailable", 
        "voice_agent": "available" if voice_agent_service else "unavailable",
        "email": "available" if email_service else "unavailable",
        "openai": "available" if openai_client else "unavailable"
    }
    
    # Add CORS configuration info for debugging
    services["cors_configured"] = "secure"
    services["ngrok_support"] = "enabled"
    services["local_dev_support"] = "enabled"
    
    return HealthResponse(
        status="healthy" if services["openai"] == "available" else "degraded",
        version="2.0.0",
        services=services
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio_endpoint(request: TranscribeRequest):
    """Transcribe audio to text using OpenAI Whisper - FIXED ASYNC ISSUE"""
    
    if not transcription_service:
        raise HTTPException(status_code=503, detail="Transcription service unavailable")
    
    try:
        # Validate audio format
        if not validate_audio_format(request.format):
            raise HTTPException(status_code=400, detail=f"Unsupported audio format: {request.format}")
        
        # Decode audio data
        audio_bytes = decode_audio_data(request.audio)
        
        # Create temporary file for processing
        temp_filename = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{request.format}") as temp_file:
                temp_file.write(audio_bytes)
                temp_filename = temp_file.name
            
            logger.info(f"Processing audio file: {temp_filename}")
            
            # FIXED: Remove 'await' since transcribe_audio is NOT an async function
            transcription = transcription_service.transcribe_audio(temp_filename)
            
            if not transcription:
                raise HTTPException(status_code=422, detail="Could not transcribe audio - please try speaking more clearly")
            
            logger.info(f"Transcription completed: {len(transcription)} characters")
            
            return TranscriptionResponse(transcription=transcription)
            
        finally:
            # Clean up temporary file
            if temp_filename and os.path.exists(temp_filename):
                os.unlink(temp_filename)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/summarize", response_model=SummaryResponse)
async def summarize_transcription_endpoint(request: SummarizeRequest):
    """Generate structured summary from transcription"""
    
    if not summarization_service:
        raise HTTPException(status_code=503, detail="Summarization service unavailable")
    
    try:
        logger.info(f"Summarizing transcription: {len(request.transcription)} characters")
        
        # Generate structured summary
        summary = summarization_service.generate_closeout_summary(request.transcription)
        
        logger.info("Summarization completed successfully")
        
        return SummaryResponse(summary=summary)
        
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command_endpoint(request: VoiceCommandRequest):
    """Process voice command and return action response - FIXED ASYNC ISSUE"""
    
    if not voice_agent_service:
        raise HTTPException(status_code=503, detail="Voice agent service unavailable")
    
    try:
        # Validate audio format
        if not validate_audio_format(request.format):
            raise HTTPException(status_code=400, detail=f"Unsupported audio format: {request.format}")
        
        # Decode audio data
        audio_bytes = decode_audio_data(request.audio)
        
        # First transcribe the audio
        temp_filename = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{request.format}") as temp_file:
                temp_file.write(audio_bytes)
                temp_filename = temp_file.name
            
            # Transcribe audio
            if not transcription_service:
                raise HTTPException(status_code=503, detail="Transcription service required for voice commands")
            
            # FIXED: Remove 'await' since transcribe_audio is NOT an async function
            transcription = transcription_service.transcribe_audio(temp_filename)
            
            if not transcription:
                return VoiceCommandResponse(
                    action="acknowledge",
                    confirmation="I couldn't understand that. Please try again.",
                    success=False,
                    needs_clarification=True
                )
            
            # Process the voice command
            response = await voice_agent_service.process_voice_command(
                transcription, 
                request.screenContext
            )
            
            return VoiceCommandResponse(**response)
            
        finally:
            # Clean up temporary file
            if temp_filename and os.path.exists(temp_filename):
                os.unlink(temp_filename)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice command processing failed: {str(e)}")

@app.post("/send-email", response_model=EmailResponse)
async def send_email_endpoint(request: SendEmailRequest):
    """Send closeout report via email"""
    
    if not email_service:
        raise HTTPException(status_code=503, detail="Email service unavailable")
    
    try:
        logger.info("Sending closeout report email")
        # Log received summary for debugging
        try:
            # request.summary is a Pydantic model; convert to dict for clearer logs
            summary_dict = request.summary.dict() if hasattr(request.summary, 'dict') else dict(request.summary)
        except Exception:
            summary_dict = getattr(request.summary, '__dict__', str(request.summary))

        logger.info(f"📥 Received summary.work_order (raw): {summary_dict.get('work_order') if isinstance(summary_dict, dict) else getattr(request.summary, 'work_order', None)}")
        logger.info(f"📥 Received summary payload: {summary_dict}")
        if request.attachments:
            logger.info(f"📎 Received {len(request.attachments)} attachment(s)")

        # Send email with summary and transcription
        result = email_service.send_closeout_email(
            request.summary,
            request.transcription,
            None,
            request.technician_email,
            request.attachments,
        )
        
        if result.get("success", False):
            logger.info("Email sent successfully")
            return EmailResponse(
                success=True,
                message="Email sent successfully",
                recipients=result.get("recipients", [])
            )
        else:
            detail_msg = result.get("message", "Failed to send email - check email configuration")
            logger.error(f"Email send reported failure: {detail_msg}")
            raise HTTPException(status_code=500, detail=detail_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email sending failed: {e}")
        raise HTTPException(status_code=500, detail=f"Email sending failed: {str(e)}")

@app.get("/test-email")
async def test_email_configuration():
    """Test email configuration"""
    
    if not email_service:
        return {
            "status": "error",
            "message": "Email service not available"
        }
    
    try:
        result = email_service.test_email_connection()
        return result
    except Exception as e:
        logger.error(f"Email test failed: {e}")
        return {
            "status": "error",
            "message": f"Email test failed: {str(e)}"
        }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {exc}")
    return Response(
        content='{"detail": "Internal server error"}',
        status_code=500,
        media_type="application/json"
    )

# Handle preflight requests for CORS
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle CORS preflight requests"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, ngrok-skip-browser-warning",
        }
    )

@app.post("/bug-report", response_model=BugReportResponse)
async def bug_report_endpoint(request: BugReportRequest):
    """Accept a bug report with optional image attachments and email it to support."""
    if not email_service:
        raise HTTPException(status_code=503, detail="Email service unavailable")
    try:
        logger.info("📨 Received bug report submission")
        result = email_service.send_bug_report(
            description=request.description,
            reporter_email=request.reporter_email,
            images=[img.dict() for img in (request.images or [])]
        )
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("message", "Failed to send bug report"))
        return BugReportResponse(success=True, message="Bug report sent")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bug report failed: {e}")
        raise HTTPException(status_code=500, detail=f"Bug report failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Voice-to-Report API Server...")
    print("🔒 CORS: Secure configuration with development flexibility")
    print("🌐 Origins: Ngrok, localhost, and local network support enabled")
    print("📱 Mobile: Expo tunnel and local IP connectivity supported")
    print("🔧 Voice Agent Service: ENABLED" if voice_agent_service else "🔧 Voice Agent Service: DISABLED")
    print("📧 Email Service: ENABLED" if email_service else "📧 Email Service: NEEDS CONFIGURATION")
    print("🌐 Binding to all network interfaces (0.0.0.0:8000)")
    print("📍 Mobile app and ngrok tunnel support enabled")
    print("📋 API Documentation: http://localhost:8000/docs")
    print("🏥 Health Check: http://localhost:8000/health")
    uvicorn.run(app, host="0.0.0.0", port=8000)