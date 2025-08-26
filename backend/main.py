# backend/main.py - COMPLETE FIXED VERSION
import os
import tempfile
import base64
import logging
import json
import re
from datetime import datetime
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File
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
    HealthResponse
)
from services.transcription import TranscriptionService
from services.summarization import SummarizationService
from services.email_service import EmailService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Voice-to-Report API",
    description="API for processing voice recordings into structured field service closeout reports",
    version="2.0.0"
)

# Configure CORS for mobile app and ngrok
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize OpenAI client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = None

if OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")
else:
    logger.warning("OpenAI API key not found")

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
    email_service = EmailService()
    logger.info("Email service initialized")
except Exception as e:
    logger.error(f"Failed to initialize email service: {e}")
    email_service = None

# Helper function for audio format validation
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
        return audio_bytes
    except Exception as e:
        logger.error(f"Failed to decode audio data: {e}")
        raise HTTPException(status_code=400, detail="Invalid audio data format")

# Root endpoint
@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint with service status"""
    return await health_check()

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        services_status = {
            "transcription": "available" if transcription_service else "unavailable",
            "summarization": "available" if summarization_service else "unavailable", 
            "email": "available" if email_service else "unavailable",
            "openai": "available" if openai_client else "unavailable"
        }
        
        return HealthResponse(
            status="healthy",
            version="2.0.0",
            services=services_status
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")

# FIXED: Transcribe endpoint with correct file handling
@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio to text - optimized for mobile uploads"""
    
    if not transcription_service:
        raise HTTPException(status_code=503, detail="Transcription service unavailable - check OpenAI API key")
    
    try:
        logger.info("Processing transcription request")
        logger.info(f"Audio format: {request.format}")
        logger.info(f"Audio data length: {len(request.audio)} characters")
        
        # Validate audio format
        if not validate_audio_format(request.format):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported audio format: {request.format}. Supported formats: m4a, mp4, wav, mp3, webm"
            )
        
        # Decode audio data
        audio_bytes = decode_audio_data(request.audio)
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        logger.info(f"Audio size: {audio_size_mb:.2f} MB")
        
        # Validate audio size (25MB limit)
        if audio_size_mb > 25:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")
        
        # FIXED: Create temporary file and pass file path to transcription service
        with tempfile.NamedTemporaryFile(suffix=f'.{request.format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # FIXED: Pass file path to transcription service (not bytes)
            transcription = transcription_service.transcribe_audio(temp_file_path)
            
            logger.info("Transcription completed successfully")
            logger.info(f"Transcription length: {len(transcription)} characters")
            
            return TranscriptionResponse(
                transcription=transcription,
                success=True,
                message="Audio transcribed successfully"
            )
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temp file: {e}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Transcription failed: {str(e)}"
        )

# Voice command endpoint for AI agent
@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice command for AI agent - handles mobile app requests"""
    
    if not transcription_service or not summarization_service:
        raise HTTPException(status_code=503, detail="AI services unavailable - check OpenAI API key")
    
    try:
        logger.info("Processing voice command request")
        
        # Decode audio data
        audio_bytes = decode_audio_data(request.audio)
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix=f'.{request.format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe the voice command
            transcription = transcription_service.transcribe_audio(temp_file_path)
            
            # Process the command based on screen context
            screen_context = request.screenContext
            
            # Generate AI response based on command and context
            response_text = f"I heard: '{transcription}'. "
            
            # Simple command processing logic
            command_lower = transcription.lower()
            
            if any(word in command_lower for word in ['help', 'what can you do', 'capabilities']):
                response_text += "I can help you fill out reports by voice, improve your wording, and answer questions about your work."
            elif any(word in command_lower for word in ['set', 'change', 'update', 'fill']):
                response_text += f"I can help you update fields on the {screen_context.get('screenName', 'current')} screen. What would you like to change?"
            elif any(word in command_lower for word in ['improve', 'better', 'professional']):
                response_text += "I can help improve your text. Please tell me what you'd like me to make sound more professional."
            else:
                response_text += "I'm ready to help with your field service report. You can ask me to update fields, improve wording, or explain my capabilities."
            
            return VoiceCommandResponse(
                action="respond",
                confirmation=transcription,
                response=response_text,
                success=True
            )
            
        finally:
            # Clean up
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temp file: {e}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        return VoiceCommandResponse(
            action="error",
            confirmation="Sorry, I couldn't process that command.",
            response="There was an error processing your voice command. Please try again.",
            success=False
        )

@app.post("/summarize", response_model=SummaryResponse)
async def summarize_transcription(request: SummarizeRequest):
    """Summarize transcription into structured closeout report"""
    
    if not summarization_service:
        raise HTTPException(status_code=503, detail="Summarization service unavailable - check OpenAI API key")
    
    try:
        logger.info("Processing summarization request")
        
        # Generate structured summary
        summary = summarization_service.generate_closeout_summary(request.transcription)
        
        logger.info("Summarization completed successfully")
        return SummaryResponse(
            summary=summary,
            success=True,
            message="Transcription summarized successfully"
        )
        
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        return SummaryResponse(
            summary={},
            success=False,
            message=f"Summarization failed: {str(e)}. Please try again.",
        )

@app.post("/send-email", response_model=EmailResponse)
async def send_closeout_email(request: SendEmailRequest):
    """Send closeout report via email"""
    
    if not email_service:
        raise HTTPException(status_code=500, detail="Email service not available")
    
    try:
        logger.info("Processing email send request")
        
        # Send email using email service
        success = email_service.send_closeout_email(
            closeout_data=request.summary.dict(),
            transcription=request.transcription,
            technician_name=request.technician_name
        )
        
        if success:
            logger.info("Email sent successfully")
            return EmailResponse(
                success=True,
                message="Closeout report sent successfully",
                recipients=email_service.recipients
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
            
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

@app.post("/text-to-speech")
async def text_to_speech(request: Dict[str, str]):
    """Convert text to speech (placeholder endpoint)"""
    try:
        logger.info("Processing text-to-speech request")
        text = request.get("text", "")
        
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        # TODO: Implement actual text-to-speech functionality
        # For now, return a placeholder response
        return {
            "success": True,
            "message": "Text-to-speech functionality not yet implemented",
            "audio_url": None
        }
        
    except Exception as e:
        logger.error(f"Text-to-speech failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {str(e)}")

# Add middleware to handle ngrok browser warnings
@app.middleware("http")
async def add_ngrok_headers(request, call_next):
    """Add headers to handle ngrok browser warnings and mobile app requests"""
    response = await call_next(request)
    
    # Add headers for ngrok compatibility
    response.headers["ngrok-skip-browser-warning"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Handle preflight requests for CORS
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle CORS preflight requests"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("Starting Voice-to-Report API Server...")
    print("Binding to all network interfaces (0.0.0.0:8000)")
    print("Mobile app and ngrok tunnel support enabled")
    print("API Documentation: http://localhost:8000/docs")
    print("Health Check: http://localhost:8000/health")
    uvicorn.run(app, host="0.0.0.0", port=8000)