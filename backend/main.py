# backend/main.py
import os
import tempfile
import base64
import logging
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

# Initialize services
transcription_service = TranscriptionService(openai_client) if openai_client else None
summarization_service = SummarizationService(openai_client) if openai_client else None
email_service = EmailService()

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

@app.post("/send-email", response_model=EmailResponse)
async def send_closeout_email(request: SendEmailRequest):
    """Send closeout report via email"""
    
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
    
    try:
        result = email_service.test_email_connection()
        return result
    except Exception as e:
        logger.error(f"Email test failed: {e}")
        return {
            "status": "error",
            "message": f"Email test failed: {str(e)}"
        }

# Keep existing voice command endpoint for AI assistant functionality
@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice command with enhanced AI understanding"""
    try:
        if not openai_client:
            raise HTTPException(status_code=500, detail="OpenAI client not configured")
        
        logger.info("Voice command processing started")
        
        # First transcribe the audio
        audio_bytes = base64.b64decode(request.audio)
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        
        if audio_size_mb > 25:
            raise HTTPException(status_code=400, detail="Audio file too large")
        
        # Create temporary file for transcription
        with tempfile.NamedTemporaryFile(delete=False, suffix='.m4a') as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe audio
            with open(temp_file_path, 'rb') as audio_file:
                transcription_response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                transcription = transcription_response.text
            
            # Clean up temp file
            os.unlink(temp_file_path)
            
            logger.info(f"Voice transcribed: '{transcription}'")
            
            # Build enhanced context for GPT
            screen_context = request.screenContext
            screen_name = screen_context.get('screenName', 'unknown')
            visible_fields = screen_context.get('visibleFields', [])
            current_values = screen_context.get('currentValues', {})
            available_actions = screen_context.get('availableActions', [])
            
            # Format fields information
            fields_info = "\n".join([
                f"- {field.get('name', '')}: {field.get('label', '')} (current: '{current_values.get(field.get('name', ''), 'empty')}')"
                for field in visible_fields
            ])
            
            # Enhanced prompt for better understanding
            prompt = f"""You are Sam, an AI assistant helping with voice commands for a field technician's closeout report app.

CONTEXT:
- Current screen: {screen_name}
- User said: "{transcription}"

AVAILABLE FIELDS:
{fields_info}

AVAILABLE ACTIONS: {', '.join(available_actions)}

Your task is to interpret the voice command and respond appropriately:

1. If the user wants to update a field, determine which field and the new value
2. If the user wants to perform an action, identify the action
3. Always provide a natural, helpful response

Respond in JSON format:
{{
    "action": "field_update" or "action_command" or "question",
    "fieldUpdates": {{"fieldName": "newValue"}} or null,
    "confirmation": "Brief confirmation of what you understood",
    "ttsText": "Natural response to speak back to user",
    "success": true
}}"""

            # Process with GPT
            response = openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant for field service reports. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )
            
            import json
            response_data = json.loads(response.choices[0].message.content)
            
            return VoiceCommandResponse(**response_data)
            
        except Exception as file_error:
            # Clean up temp file if it exists
            if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            raise file_error
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice command processing failed: {str(e)}")

# Debug endpoint for OpenAI connectivity
@app.get("/debug/openai")
async def debug_openai():
    """Debug OpenAI connectivity and configuration"""
    try:
        if not openai_client:
            return {
                "status": "error",
                "error": "OpenAI client not configured",
                "openai_key_present": bool(OPENAI_API_KEY)
            }
        
        # Test GPT
        gpt_response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Say 'test successful'"}],
            max_tokens=10
        )
        gpt_result = gpt_response.choices[0].message.content
        
        # Test Whisper (with a small test)
        whisper_status = "available"
        
        return {
            "status": "success",
            "gpt_test": gpt_result,
            "whisper_status": whisper_status,
            "openai_key_present": bool(OPENAI_API_KEY)
        }
        
    except Exception as e:
        return {
            "status": "error", 
            "error": str(e),
            "openai_key_present": bool(OPENAI_API_KEY)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)