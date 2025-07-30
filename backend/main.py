# backend/main.py
import os
import tempfile
import base64
import logging
import json
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

@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice command with enhanced AI understanding"""
    try:
        if not openai_client:
            raise HTTPException(status_code=500, detail="OpenAI client not available")
        
        logger.info("Processing voice command request")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        
        logger.info(f"Voice command audio size: {audio_size_mb:.2f} MB")
        
        if audio_size_mb > 25:
            raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
        
        # Step 1: Transcribe the audio
        if not transcription_service:
            raise HTTPException(status_code=500, detail="Transcription service not available")
        
        transcription = await transcription_service.transcribe_audio(audio_bytes, request.format)
        logger.info(f"Voice command transcribed: '{transcription[:100]}...'")
        
        # Step 2: Process the voice command with screen context
        screen_context = request.screenContext
        screen_name = screen_context.get('screenName', 'unknown')
        available_actions = screen_context.get('availableActions', [])
        visible_fields = screen_context.get('visibleFields', [])
        
        # Format field information for the AI
        fields_info = ""
        if visible_fields:
            field_descriptions = []
            for field in visible_fields:
                synonyms = ', '.join(field.get('synonyms', []))
                field_descriptions.append(
                    f"- {field['label']} ('{field['name']}'): "
                    f"Current='{field.get('currentValue', '')}', "
                    f"Editable={field.get('isEditable', False)}, "
                    f"Synonyms=[{synonyms}]"
                )
            fields_info = '\n'.join(field_descriptions)
        else:
            fields_info = "No editable fields available"
        
        # Create a detailed prompt for the AI
        prompt = f"""You are an AI assistant helping a user interact with their mobile voice report app via voice commands.

CURRENT SCREEN: {screen_name}
USER COMMAND: "{transcription}"

AVAILABLE FIELDS:
{fields_info}

AVAILABLE ACTIONS: {', '.join(available_actions)}

Your task is to interpret the voice command and respond appropriately:

1. If the user wants to update a field, determine which field and the new value
2. If the user wants to perform an action, identify the action
3. If unclear, ask for clarification
4. Always provide a natural, helpful response

Respond in JSON format:
{{
    "action": "field_update" or "action_command" or "clarify",
    "fieldUpdates": {{"fieldName": "newValue"}} or null,
    "confirmation": "Brief confirmation of what you understood",
    "ttsText": "Natural response to speak back to user",
    "success": true
}}

Examples:
- User says "set location to downtown office" → {{"action": "field_update", "fieldUpdates": {{"location": "downtown office"}}, "confirmation": "Updated location to downtown office", "ttsText": "Location set to downtown office", "success": true}}
- User says "save the report" → {{"action": "action_command", "fieldUpdates": null, "confirmation": "Saving report", "ttsText": "Saving your report now", "success": true}}
- User says unclear command → {{"action": "clarify", "fieldUpdates": null, "confirmation": "Could you please clarify?", "ttsText": "I didn't understand that. Could you please try again?", "success": false}}
"""

        # Step 3: Get AI response
        response = openai_client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a helpful AI assistant for field service reports. Always respond with valid JSON."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.3
        )
        
        # Step 4: Parse the response
        try:
            response_data = json.loads(response.choices[0].message.content)
            
            # Ensure all required fields are present
            voice_response = VoiceCommandResponse(
                action=response_data.get('action', 'clarify'),
                fieldUpdates=response_data.get('fieldUpdates'),
                confirmation=response_data.get('confirmation', 'Command processed'),
                ttsText=response_data.get('ttsText', 'Command processed'),
                success=response_data.get('success', True)
            )
            
            logger.info(f"Voice command processed successfully: {voice_response.action}")
            return voice_response
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            # Return a fallback response
            return VoiceCommandResponse(
                action="clarify",
                fieldUpdates=None,
                confirmation="Could not process command",
                ttsText="Sorry, I didn't understand that. Please try again.",
                success=False
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        # Return error response instead of raising exception
        return VoiceCommandResponse(
            action="clarify",
            fieldUpdates=None,
            confirmation="Error processing command",
            ttsText="Sorry, there was an error processing your command. Please try again.",
            success=False
        )

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
        
        # Test Whisper status
        whisper_status = "available" if transcription_service else "unavailable"
        
        return {
            "status": "success",
            "gpt_test": gpt_result,
            "whisper_status": whisper_status,
            "transcription_service": "available" if transcription_service else "unavailable",
            "summarization_service": "available" if summarization_service else "unavailable",
            "email_service": "available" if email_service else "unavailable",
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