# backend/main.py - Complete fixed version with proper OpenAI integration and AI Agent improvements
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from openai import OpenAI
import base64
import tempfile

# CRITICAL FIX: Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

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

# Get API key from environment (now properly loaded from .env)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY not found in environment variables!")
    logger.error("Please check that your .env file exists and contains OPENAI_API_KEY=your_key_here")
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
            "notes": "Any additional important details",
            "workType": "Type or category of work",
            "duration": "How long the work took",
            "clientName": "Client or customer name if mentioned",
            "priority": "Priority level if mentioned",
            "nextSteps": "Follow-up actions needed"
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

# IMPROVED: Voice command processing endpoint with enhanced validation
@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Process voice command with improved error handling and validation"""
    try:
        logger.info(f"Processing voice command for screen: {request.screenContext.get('screenName')}")
        
        # ADDED: Validate screen context first
        if not request.screenContext:
            logger.warning("No screen context provided")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="Screen context missing. Please try again.",
                confirmation="Error: No screen context",
                ttsText="There was a technical issue. Please try your command again."
            )
        
        # ADDED: Validate audio data early
        if not request.audio or len(request.audio) < 100:
            logger.warning("Audio data too small or missing")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="No audio received. Please try again.",
                confirmation="No audio detected",
                ttsText="I didn't receive any audio. Please try speaking again."
            )
        
        # Enhanced audio processing with better validation
        try:
            audio_bytes = base64.b64decode(request.audio)
            logger.info(f"Decoded audio size: {len(audio_bytes)} bytes")
            
            # ADDED: Minimum audio size validation
            if len(audio_bytes) < 1000:
                logger.warning(f"Audio too small: {len(audio_bytes)} bytes")
                return VoiceCommandResponse(
                    action="clarify",
                    confidence=0.0,
                    clarification="Audio recording too short. Please speak longer.",
                    confirmation="Audio too brief",
                    ttsText="I need you to speak a bit longer. Please try again."
                )
                
        except Exception as e:
            logger.error(f"Failed to decode base64 audio: {e}")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="Invalid audio format. Please try again.",
                confirmation="Audio format error",
                ttsText="I had trouble with your audio format. Please try recording again."
            )
        
        # Create temporary file for Whisper
        with tempfile.NamedTemporaryFile(suffix=f'.{request.format}', delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        logger.info(f"Created temporary audio file: {temp_file_path}")
        
        transcription = ""
        try:
            # Transcribe with Whisper
            with open(temp_file_path, 'rb') as audio_file:
                logger.info("Calling OpenAI Whisper API...")
                transcript = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"  # Specify English for better accuracy
                )
            
            transcription = transcript.text.strip()
            logger.info(f"Whisper transcription successful: '{transcription}'")
            
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="Could not understand the audio. Please try again.",
                confirmation="Transcription failed",
                ttsText="I couldn't understand what you said. Please try speaking more clearly."
            )
        
        finally:
            # Always clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        # IMPROVED: Check if transcription is meaningful
        if not transcription or len(transcription.strip()) < 3:
            logger.warning("Empty or very short transcription received")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I didn't hear anything clear. Could you try speaking louder?",
                confirmation="No clear speech detected",
                ttsText="I didn't catch that. Could you try speaking a bit louder and clearer?"
            )
        
        # Enhanced GPT processing with better context
        context = request.screenContext
        
        # Build more comprehensive field information
        fields_info = []
        for field in context.get('visibleFields', []):
            field_desc = f"- {field['label']} ('{field['name']}')"
            field_desc += f": Current='{field.get('currentValue', '')}'"
            field_desc += f", Editable={field.get('isEditable', True)}"
            if field.get('synonyms'):
                field_desc += f", Synonyms={field['synonyms']}"
            fields_info.append(field_desc)
        
        fields_text = "\n".join(fields_info) if fields_info else "No editable fields available"
        
        logger.info(f"Screen context: {context.get('screenName')}")
        logger.info(f"Available fields: {len(context.get('visibleFields', []))}")
        logger.info(f"User said: '{transcription}'")
        
        # IMPROVED: More comprehensive prompt for GPT
        prompt = f"""You are an AI assistant helping a user interact with their mobile voice report app via voice commands while driving.

CURRENT SCREEN: {context.get('screenName', 'unknown')}
CURRENT MODE: {context.get('mode', 'N/A')}

AVAILABLE FIELDS:
{fields_text}

AVAILABLE ACTIONS:
{', '.join(context.get('availableActions', []))}

USER COMMAND: "{transcription}"

Context: The user is likely driving and needs hands-free interaction. They want to update their after-work report.

Respond with JSON only:
{{
  "action": "update_field|toggle_mode|execute_action|clarify",
  "target": "exact_field_name_or_action_name",
  "value": "new_value_if_updating_field",
  "confidence": 0.95,
  "clarification": "Question if confidence < 0.7",
  "confirmation": "Brief confirmation of what was done",
  "ttsText": "Natural spoken response for driving user"
}}

Rules:
- If confidence < 0.7, use "clarify" action and ask for clarification
- For field updates, use EXACT field names from available fields
- Handle common synonyms: "location/place/where", "task/work/job", "time/date/when", "notes/additional notes"
- For unclear commands, ask specific questions
- Keep TTS responses brief and conversational for driving safety
- If user says "change that" or "update the location", map to appropriate fields

Examples of good responses:
- "Updated! Location is now Downtown Office"
- "Got it! Task description updated"
- "I heard 'place' - did you mean the location field?"
"""
        
        logger.info("Calling OpenAI GPT API for command processing...")
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful AI assistant for a voice-controlled mobile app. Always respond with valid JSON only. The user is driving and needs brief, clear responses."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistent responses
                max_tokens=300    # Limit response length
            )
            
            logger.info("GPT API call successful")
            
            # Parse JSON response with better error handling
            response_text = response.choices[0].message.content.strip()
            logger.info(f"GPT response: {response_text}")
            
            # Extract JSON from response (handle cases where GPT adds extra text)
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON found in GPT response")
                raise ValueError("Invalid JSON response from GPT")
                
            json_str = response_text[start_idx:end_idx]
            
            try:
                result = json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed: {e}")
                logger.error(f"JSON string: {json_str}")
                raise ValueError(f"Invalid JSON from GPT: {e}")
            
            # ADDED: Validate required fields in response
            required_fields = ['action', 'confidence', 'confirmation', 'ttsText']
            for field in required_fields:
                if field not in result:
                    logger.error(f"Missing required field in GPT response: {field}")
                    raise ValueError(f"Missing field: {field}")
            
            # ADDED: Ensure confidence is a valid number
            try:
                result['confidence'] = float(result['confidence'])
            except (ValueError, TypeError):
                logger.warning("Invalid confidence value, setting to 0.5")
                result['confidence'] = 0.5
            
            logger.info(f"Voice command processed successfully: {result['action']} (confidence: {result['confidence']})")
            return VoiceCommandResponse(**result)
            
        except Exception as e:
            logger.error(f"GPT processing failed: {e}")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I had trouble processing your command. Could you try rephrasing?",
                confirmation="Processing error",
                ttsText="I had trouble understanding that. Could you try saying it differently?"
            )
        
    except HTTPException:
        # Re-raise HTTP exceptions (they're already handled)
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed with unexpected error: {e}")
        return VoiceCommandResponse(
            action="clarify",
            confidence=0.0,
            clarification="Something went wrong. Please try again.",
            confirmation="System error",
            ttsText="Sorry, something went wrong. Please try your command again."
        )

# IMPROVED: Text-to-speech endpoint with better error handling
@app.post("/text-to-speech")
async def generate_speech(request: TTSRequest):
    """Generate speech from text with improved error handling"""
    try:
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text is required for TTS")
        
        # Limit text length for TTS
        text = request.text.strip()[:500]  # Max 500 characters
        
        logger.info(f"Generating TTS for: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        
        try:
            # Generate speech with OpenAI TTS
            tts_response = openai_client.audio.speech.create(
                model="tts-1",
                voice="alloy",  # Good for clear speech while driving
                input=text,
                speed=1.0  # Normal speed for driving safety
            )
            
            audio_content = tts_response.content
            logger.info(f"TTS generated successfully: {len(audio_content)} bytes")
            
            return Response(
                content=audio_content,
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": "attachment; filename=speech.mp3",
                    "Content-Length": str(len(audio_content))
                }
            )
            
        except Exception as e:
            logger.error(f"OpenAI TTS API call failed: {e}")
            raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
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

# ADDED: AI Agent specific health check endpoint
@app.get("/ai-agent/health")
async def ai_agent_health():
    """Health check specifically for AI agent services"""
    try:
        # Test OpenAI connectivity with a minimal request
        test_response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=5
        )
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "transcription": "available",
                "voice_agent": "available", 
                "tts": "available",
                "gpt": "available"
            },
            "openai_test": "success"
        }
        
    except Exception as e:
        logger.error(f"AI agent health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "services": {
                "transcription": "unknown",
                "voice_agent": "unknown", 
                "tts": "unknown",
                "gpt": "unknown"
            }
        }

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