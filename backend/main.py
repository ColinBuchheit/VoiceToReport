# backend/main.py
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
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

# Helper function for parsing AI responses
def parse_ai_response(response) -> Dict[str, Any]:
    """Robust AI response parsing with better error handling"""
    try:
        # Log the raw response for debugging
        logger.info(f"Raw AI response type: {type(response)}")
        
        # Handle different response types
        if hasattr(response, 'choices') and response.choices:
            content = response.choices[0].message.content
        elif isinstance(response, dict):
            content = response.get('content', str(response))
        else:
            content = str(response)
        
        logger.info(f"Extracted content preview: {content[:200]}...")
        
        # Try to extract JSON from markdown code blocks
        if '```json' in content:
            json_start = content.find('```json') + 7
            json_end = content.find('```', json_start)
            if json_end != -1:
                json_content = content[json_start:json_end].strip()
            else:
                json_content = content[json_start:].strip()
        elif content.strip().startswith('{'):
            json_content = content.strip()
        else:
            # If no JSON markers, try to find JSON-like content
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_content = json_match.group()
            else:
                raise ValueError("No JSON content found in response")
        
        # Parse the JSON
        parsed_data = json.loads(json_content)
        return parsed_data
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        logger.error(f"Content that failed to parse: {content}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error parsing AI response: {e}")
        return None

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    services_status = {
        "transcription": "available" if transcription_service else "unavailable",
        "summarization": "available" if summarization_service else "unavailable", 
        "email": "available" if email_service else "unavailable",
        "openai": "connected" if openai_client else "not configured"
    }
    
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        services=services_status
    )

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio to text using OpenAI Whisper"""
    
    if not transcription_service:
        raise HTTPException(status_code=500, detail="Transcription service not available")
    
    try:
        logger.info("Processing transcription request")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        
        logger.info(f"Audio size: {audio_size_mb:.2f} MB")
        
        if audio_size_mb > 25:
            raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
        
        # Transcribe audio
        transcription = await transcription_service.transcribe_audio(audio_bytes, request.format)
        
        logger.info("Transcription completed successfully")
        return TranscriptionResponse(transcription=transcription)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/summarize", response_model=SummaryResponse)
async def summarize_transcription(request: SummarizeRequest):
    """Extract structured closeout data from transcription"""
    
    if not summarization_service:
        raise HTTPException(status_code=500, detail="Summarization service not available")
    
    try:
        logger.info("Processing summarization request")
        
        # Extract closeout data
        closeout_summary = summarization_service.extract_closeout_data(request.transcription)
        
        logger.info("Summarization completed successfully")
        return SummaryResponse(summary=closeout_summary)
        
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice commands for editing text"""
    
    if not transcription_service:
        raise HTTPException(status_code=500, detail="Transcription service not available")
    
    try:
        logger.info("Processing voice command request")
        
        # Decode and transcribe audio
        audio_bytes = base64.b64decode(request.audio)
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        
        logger.info(f"Voice command audio size: {audio_size_mb:.2f} MB")
        
        if audio_size_mb > 10:  # Smaller limit for voice commands
            raise HTTPException(status_code=400, detail="Voice command audio too large (max 10MB)")
        
        # Transcribe the voice command
        transcription = await transcription_service.transcribe_audio(audio_bytes, request.format)
        logger.info(f"Voice command transcribed: '{transcription}...'")
        
        # Log screen context for debugging
        screen_context = request.screenContext
        logger.info(f"Screen context keys: {list(screen_context.keys())}")
        if 'visibleFields' in screen_context:
            field_count = len(screen_context['visibleFields'])
            logger.info(f"Visible fields count: {field_count}")
            if field_count > 0:
                field_names = [f.get('name', 'unknown') for f in screen_context['visibleFields']]
                logger.info(f"Field names: {field_names}")
        
        # Process the voice command using the transcription service
        result = await transcription_service.process_voice_command(transcription, request.screenContext)
        
        logger.info(f"Voice command result: {result}")
        
        # Convert the result to match our VoiceCommandResponse model and frontend expectations
        response = VoiceCommandResponse(
            action=result.get("action", "clarify"),
            target=result.get("target", ""),
            value=result.get("value", ""),  # Frontend expects this field
            replacement=result.get("value", ""),  # Also set replacement for compatibility
            fieldUpdates=result.get("fieldUpdates", {}),
            needs_clarification=not result.get("success", False),
            clarification=result.get("ttsText", "") if not result.get("success", False) else "",
            clarification_question=result.get("ttsText", "") if not result.get("success", False) else "",
            confirmation=result.get("confirmation", ""),
            ttsText=result.get("ttsText", ""),
            confidence=result.get("confidence", 0.0),
            success=result.get("success", False),
            metadata={}
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        return VoiceCommandResponse(
            action="error",
            target="",
            replacement="",
            needs_clarification=True,
            clarification_question="I encountered an error processing your request. Please try again.",
            confirmation="Error occurred",
            ttsText="I encountered an error processing your request. Please try again.",
            confidence=0.0,
            success=False
        )

@app.post("/text-to-speech")
async def text_to_speech(request: Dict[str, str]):
    """Convert text to speech (placeholder endpoint)"""
    # This endpoint was missing and causing 404 errors
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