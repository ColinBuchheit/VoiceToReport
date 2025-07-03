# backend/main.py - Complete fixed version with proper OpenAI integration
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from openai import OpenAI
import base64
import tempfile
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Voice Report Backend",
    description="Backend API for voice report generation with AI agent",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY not found in environment variables!")
    raise ValueError("OPENAI_API_KEY must be set in environment variables")

# Initialize OpenAI client properly
try:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {e}")
    raise

# Request/Response Models
class TranscribeRequest(BaseModel):
    audio: str
    format: str = "m4a"

class TranscribeResponse(BaseModel):
    transcription: str

class SummarizeRequest(BaseModel):
    transcription: str

class SummarizeResponse(BaseModel):
    summary: Dict[str, Any]

class GeneratePDFRequest(BaseModel):
    summary: dict
    transcription: str

class GeneratePDFResponse(BaseModel):
    pdf_url: str

class VoiceCommandRequest(BaseModel):
    audio: str
    format: str = "m4a"
    screenContext: Dict[str, Any]

class VoiceCommandResponse(BaseModel):
    action: str
    target: Optional[str] = None
    value: Optional[str] = None
    confidence: float
    clarification: Optional[str] = None
    confirmation: str
    ttsText: str

class TTSRequest(BaseModel):
    text: str

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "voice-report-backend",
        "version": "1.0.0",
        "config": {
            "gpt_model": "gpt-4",
            "max_audio_size_mb": 25,
            "supported_formats": ["m4a", "mp3", "wav", "ogg"]
        }
    }

# Transcription endpoint
@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio using OpenAI Whisper"""
    try:
        logger.info("Processing transcription request")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)
        logger.info(f"Decoded audio size: {len(audio_bytes)} bytes")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix=f'.{request.format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe with Whisper
            with open(temp_file_path, 'rb') as audio_file:
                transcript = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
            
            transcription_text = transcript.text
            logger.info(f"Transcription successful: '{transcription_text}'")
            
            return TranscribeResponse(transcription=transcription_text)
            
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# Summarization endpoint
@app.post("/summarize", response_model=SummarizeResponse)
async def generate_summary(request: SummarizeRequest):
    """Generate structured summary using OpenAI GPT"""
    try:
        logger.info("Processing summarization request")
        
        prompt = f"""
        Please analyze this voice transcription and extract structured information for a work report.
        
        Transcription: "{request.transcription}"
        
        Extract the following information and return as JSON:
        {{
            "taskDescription": "Brief description of the work performed",
            "location": "Where the work was done",
            "datetime": "When the work was done",
            "outcome": "Results or completion status",
            "notes": "Any additional important details"
        }}
        
        If any information is not mentioned, use null for that field.
        """
        
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured information from work reports. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        # Parse the JSON response
        summary_text = response.choices[0].message.content
        logger.info(f"GPT response: {summary_text}")
        
        # Extract JSON from response
        start_idx = summary_text.find('{')
        end_idx = summary_text.rfind('}') + 1
        json_str = summary_text[start_idx:end_idx]
        summary = json.loads(json_str)
        
        logger.info("Summarization completed successfully")
        return SummarizeResponse(summary=summary)
        
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

# Voice command processing endpoint
@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice command with screen context"""
    try:
        logger.info(f"Processing voice command for screen: {request.screenContext.get('screenName')}")
        
        # First transcribe the audio
        logger.info(f"Received audio data length: {len(request.audio)} characters")
        logger.info(f"Audio format: {request.format}")
        
        try:
            audio_bytes = base64.b64decode(request.audio)
            logger.info(f"Decoded audio size: {len(audio_bytes)} bytes")
        except Exception as e:
            logger.error(f"Failed to decode base64 audio: {e}")
            raise HTTPException(status_code=400, detail="Invalid base64 audio data")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix=f'.{request.format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        logger.info(f"Created temporary audio file: {temp_file_path}")
        
        try:
            # Transcribe with Whisper
            with open(temp_file_path, 'rb') as audio_file:
                logger.info("Calling OpenAI Whisper API...")
                transcript = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
            
            transcription = transcript.text
            logger.info(f"Whisper transcription successful: '{transcription}'")
            
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
        
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
        
        # Check if transcription is empty
        if not transcription or transcription.strip() == "":
            logger.warning("Empty transcription received")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I didn't hear anything. Could you try speaking louder?",
                confirmation="No audio detected",
                ttsText="I didn't hear anything. Could you try speaking louder?"
            )
        
        # Process the command with GPT
        context = request.screenContext
        fields_info = "\n".join([
            f"- {field['label']} ('{field['name']}'): Current='{field['currentValue']}', Editable={field['isEditable']}"
            for field in context.get('visibleFields', [])
        ])
        
        logger.info(f"Screen context: {context.get('screenName')}")
        logger.info(f"Available fields: {len(context.get('visibleFields', []))}")
        
        prompt = f"""
        You are an AI assistant helping a user interact with their mobile voice report app via voice commands.
        
        CURRENT SCREEN: {context.get('screenName', 'unknown')}
        CURRENT MODE: {context.get('mode', 'N/A')}
        
        AVAILABLE FIELDS:
        {fields_info}
        
        USER COMMAND: "{transcription}"
        
        Respond with JSON:
        {{
          "action": "update_field|toggle_mode|execute_action|clarify",
          "target": "field_name_or_action_name",
          "value": "new_value_if_updating_field",
          "confidence": 0.95,
          "clarification": "Question if confidence < 0.7",
          "confirmation": "Brief confirmation",
          "ttsText": "Natural spoken response"
        }}
        
        Rules:
        - If confidence < 0.7, use "clarify" action
        - For field updates, use exact field names from available fields
        - Handle synonyms: "location/place/where", "task/work/job", "time/date/when"
        - Keep responses conversational but brief
        """
        
        logger.info("Calling OpenAI GPT API for command processing...")
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            
            logger.info("GPT API call successful")
            
            # Parse JSON response
            response_text = response.choices[0].message.content
            logger.info(f"GPT response: {response_text}")
            
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            json_str = response_text[start_idx:end_idx]
            result = json.loads(json_str)
            
            logger.info(f"Voice command processed successfully: {result['action']}")
            return VoiceCommandResponse(**result)
            
        except Exception as e:
            logger.error(f"GPT processing failed: {e}")
            raise HTTPException(status_code=500, detail=f"Command processing failed: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        return VoiceCommandResponse(
            action="clarify",
            confidence=0.0,
            clarification="I couldn't understand that command. Could you try again?",
            confirmation="Error processing command",
            ttsText="I didn't catch that. Could you please try again?"
        )

# Text-to-speech endpoint
@app.post("/text-to-speech")
async def generate_speech(request: TTSRequest):
    """Generate speech audio from text using OpenAI TTS"""
    try:
        logger.info(f"Generating TTS for: '{request.text[:50]}...'")
        
        # Validate input
        if not request.text or len(request.text.strip()) == 0:
            logger.error("Empty text provided for TTS")
            raise HTTPException(status_code=400, detail="Empty text provided")
            
        # Limit text length (OpenAI TTS has a 4096 character limit)
        text_to_speak = request.text[:4000]
        
        logger.info(f"Calling OpenAI TTS API with text length: {len(text_to_speak)}")
        logger.info(f"OpenAI API key present: {bool(OPENAI_API_KEY)}")
        
        try:
            # Call OpenAI TTS API
            response = openai_client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text_to_speak,
                response_format="mp3"
            )
            
            logger.info("OpenAI TTS API call successful")
            
            # Get the audio content
            audio_content = response.content
            logger.info(f"Generated audio size: {len(audio_content)} bytes")
            
            return Response(
                content=audio_content,
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": "inline; filename=response.mp3",
                    "Content-Length": str(len(audio_content))
                }
            )
            
        except Exception as e:
            logger.error(f"OpenAI TTS API call failed: {e}")
            logger.error(f"Error type: {type(e)}")
            raise HTTPException(status_code=500, detail=f"OpenAI TTS API failed: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        logger.error(f"Request text: '{request.text}'")
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")

# Simple PDF generation (placeholder for now)
@app.post("/generate-pdf", response_model=GeneratePDFResponse)
async def generate_pdf_report(request: GeneratePDFRequest):
    """Generate PDF report (placeholder for now)"""
    try:
        logger.info("PDF generation requested")
        
        # For now, return a placeholder response
        # You can implement actual PDF generation later
        return GeneratePDFResponse(pdf_url="placeholder_pdf_url")
        
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail="PDF generation failed")

# Debug endpoint to test OpenAI
@app.get("/debug/openai")
async def debug_openai():
    """Debug endpoint to test OpenAI connectivity"""
    try:
        logger.info("Testing OpenAI connectivity...")
        
        # Test GPT
        gpt_response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Say 'test successful'"}],
            max_tokens=10
        )
        gpt_result = gpt_response.choices[0].message.content
        logger.info(f"GPT test result: {gpt_result}")
        
        # Test TTS
        tts_response = openai_client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input="test"
        )
        tts_size = len(tts_response.content)
        logger.info(f"TTS test size: {tts_size} bytes")
        
        return {
            "status": "success",
            "openai_key_present": bool(OPENAI_API_KEY),
            "openai_key_starts_with": OPENAI_API_KEY[:10] if OPENAI_API_KEY else None,
            "gpt_test": gpt_result,
            "tts_test_size": tts_size
        }
        
    except Exception as e:
        logger.error(f"OpenAI debug test failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "openai_key_present": bool(OPENAI_API_KEY),
            "openai_key_starts_with": OPENAI_API_KEY[:10] if OPENAI_API_KEY else None
        }

# AI agent health check endpoint
@app.get("/ai-agent/health")
async def ai_agent_health():
    """Health check for AI agent services"""
    try:
        # Test basic GPT connectivity
        test_context = {
            "screenName": "test",
            "visibleFields": [],
            "currentValues": {},
            "availableActions": ["test"]
        }
        
        # This should not fail if OpenAI is accessible
        result = await process_voice_command(VoiceCommandRequest(
            audio="",
            format="m4a",
            screenContext=test_context
        ))
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "transcription": "available",
                "voice_agent": "available", 
                "tts": "available"
            },
            "ai_response_test": result.action is not None
        }
        
    except Exception as e:
        logger.error(f"AI agent health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Voice Report Backend API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "transcribe": "/transcribe",
            "summarize": "/summarize", 
            "generate_pdf": "/generate-pdf",
            "voice_command": "/voice-command",
            "text_to_speech": "/text-to-speech",
            "ai_agent_health": "/ai-agent/health",
            "debug_openai": "/debug/openai"
        },
        "documentation": "/docs"
    }

# Development server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)