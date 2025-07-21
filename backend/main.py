# backend/main.py - Complete Enhanced AI Agent with Natural Conversation - FIXED
import logging
import os
import base64
import tempfile
import json
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from openai import OpenAI

# CRITICAL FIX: Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Voice Report Backend",
    description="Backend API for voice report generation with Sam AI agent",
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

# Get API key from environment (now properly loaded from .env)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY not found in environment variables!")

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# FIXED: Enhanced Pydantic models
class TranscribeRequest(BaseModel):
    audio: str  # base64 encoded audio
    format: str = "m4a"  # audio format

class VoiceCommandRequest(BaseModel):
    audio: str  # base64 encoded audio
    screenContext: Dict[str, Any]
    conversationHistory: Optional[list] = []

class VoiceCommandResponse(BaseModel):
    action: str
    target: Optional[str] = None
    value: Optional[str] = None
    confidence: float
    clarification: Optional[str] = None
    confirmation: str
    ttsText: str
    metadata: Optional[Dict[str, Any]] = None

class TextToSpeechRequest(BaseModel):
    text: str

class SummarizeRequest(BaseModel):
    transcription: str

class SummarizeResponse(BaseModel):
    summary: Dict[str, Any]

class GeneratePDFRequest(BaseModel):
    summary: Dict[str, Any]
    transcription: str

class GeneratePDFResponse(BaseModel):
    pdf_url: str

# Enhanced AI Agent personality and capabilities
AGENT_PERSONA = """You are Sam, a friendly and efficient AI assistant working for a technology services company. You help field technicians create detailed service reports while they're on the road or at job sites.

Your personality:
- Professional but conversational
- Patient and understanding  
- Helpful and proactive
- Clear in explanations
- Encouraging and supportive

You excel at:
- Understanding natural voice commands
- Updating report fields accurately
- Suggesting better wording
- Answering questions about capabilities
- Providing context-aware help

Key behaviors:
- Always confirm what you've done
- Ask for clarification when unsure
- Offer helpful suggestions
- Keep responses conversational but professional
- Remember the context of the current screen
"""

# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Voice Report Backend",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "agent": "Sam AI Assistant",
        "openai_configured": bool(OPENAI_API_KEY)
    }

@app.get("/ai-agent/health") 
async def ai_agent_health():
    """AI Agent specific health check"""
    try:
        if not openai_client:
            return {
                "status": "unhealthy",
                "error": "OpenAI client not configured",
                "capabilities": []
            }
        
        # Test OpenAI connection
        test_response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=5
        )
        
        return {
            "status": "healthy",
            "agent": "Sam AI Assistant",
            "capabilities": [
                "voice_command_processing",
                "field_updates", 
                "wording_help",
                "text_to_speech",
                "conversational_ai"
            ],
            "models": {
                "chat": "gpt-4",
                "transcription": "whisper-1", 
                "tts": "tts-1"
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"AI Agent health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "capabilities": []
        }

# FIXED: Transcribe endpoint to match frontend format
@app.post("/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    """Transcribe audio to text using Whisper - FIXED to match frontend format"""
    try:
        logger.info(f"Transcription request received - format: {request.format}")
        
        if not request.audio:
            raise HTTPException(status_code=400, detail="Audio data is required")
        
        if not openai_client:
            raise HTTPException(status_code=500, detail="OpenAI client not configured")
        
        # Decode base64 audio
        try:
            audio_bytes = base64.b64decode(request.audio)
            logger.info(f"Audio decoded successfully: {len(audio_bytes)} bytes")
        except Exception as e:
            logger.error(f"Failed to decode base64 audio: {e}")
            raise HTTPException(status_code=400, detail="Invalid base64 audio data")
        
        # Validate file size
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        if audio_size_mb > 25:  # 25MB limit
            raise HTTPException(status_code=400, detail=f"Audio file too large: {audio_size_mb:.1f}MB (max: 25MB)")
        
        # Create temporary file with correct extension
        file_extension = request.format if request.format in ['m4a', 'mp3', 'wav', 'mp4', 'webm'] else 'm4a'
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe with Whisper
            logger.info(f"Transcribing {file_extension} audio with Whisper...")
            with open(temp_file_path, 'rb') as audio_file:
                response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                transcription = response.text
            
            logger.info(f"Transcription completed: {len(transcription)} characters")
            
            # Clean up temp file
            os.unlink(temp_file_path)
            
            return {
                "transcription": transcription,
                "audio_format": file_extension,
                "audio_size_mb": round(audio_size_mb, 2),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as whisper_error:
            # Clean up temp file on error
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            
            logger.error(f"Whisper transcription failed: {whisper_error}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(whisper_error)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription service error: {str(e)}")

# Enhanced voice command processing
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
            prompt = f"""You are Sam, an AI assistant helping with voice commands for a field technician's report app.

CONTEXT:
- Current screen: {screen_name}
- User said: "{transcription}"

AVAILABLE FIELDS:
{fields_info}

AVAILABLE ACTIONS: {', '.join(available_actions)}

Your task is to interpret the voice command and respond appropriately:

1. FIELD UPDATES: If they want to change/update/set a field value
   - Use "update_field" action
   - Match field names flexibly (synonyms, partial matches)
   - Extract the new value they want to set

2. MODE CHANGES: If they want to edit/preview/toggle mode  
   - Use "toggle_mode" action

3. ACTIONS: If they want to generate, save, etc.
   - Use "execute_action" action with the specific action name

4. QUESTIONS ABOUT CAPABILITIES: If they ask "what can you do" or similar
   - Use "explain_capabilities" action

5. WORDING HELP: If they ask "how does that sound" or want suggestions
   - Use "provide_suggestion" action

6. UNCLEAR/UNSURE: If confidence < 0.7
   - Use "clarify" action with a helpful question

7. GENERAL CONVERSATION: If just chatting
   - Use "acknowledge" action

Respond with JSON:
{{
  "action": "update_field|execute_action|toggle_mode|explain_capabilities|provide_suggestion|clarify|acknowledge",
  "target": "field_name_or_action_name",
  "value": "new_value_if_updating_field", 
  "confidence": 0.95,
  "clarification": "question_if_unclear",
  "confirmation": "Brief confirmation of what you did",
  "ttsText": "Natural, conversational response"
}}

Be conversational and helpful in your ttsText responses!"""

            # Get GPT response
            gpt_response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": AGENT_PERSONA},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )
            
            response_text = gpt_response.choices[0].message.content
            logger.info(f"GPT raw response: {response_text}")
            
            # Parse JSON response
            try:
                response_data = json.loads(response_text)
                
                # Validate required fields
                if 'action' not in response_data:
                    raise ValueError("Missing 'action' field")
                
                return VoiceCommandResponse(
                    action=response_data.get('action', 'acknowledge'),
                    target=response_data.get('target'),
                    value=response_data.get('value'),
                    confidence=response_data.get('confidence', 0.8),
                    clarification=response_data.get('clarification'),
                    confirmation=response_data.get('confirmation', 'Command processed'),
                    ttsText=response_data.get('ttsText', 'Got it!'),
                    metadata={
                        "transcription": transcription,
                        "processingTime": 1.0,
                        "modelUsed": "gpt-4"
                    }
                )
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse GPT JSON response: {e}")
                return VoiceCommandResponse(
                    action="clarify",
                    confidence=0.0,
                    clarification="I had trouble understanding that. Could you try again?",
                    confirmation="Processing error",
                    ttsText="Sorry, I had trouble understanding that. Could you try again?"
                )
                
        except Exception as processing_error:
            # Clean up temp file on error
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            raise processing_error
            
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        return VoiceCommandResponse(
            action="clarify",
            confidence=0.0,
            clarification="Something went wrong. Please try again.",
            confirmation="System error",
            ttsText="Sorry, something went wrong on my end. Could you try that again?"
        )

# Enhanced Text-to-Speech
@app.post("/text-to-speech")
async def text_to_speech(request: TextToSpeechRequest):
    """Generate natural-sounding speech"""
    try:
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text is required")
        
        if not openai_client:
            raise HTTPException(status_code=500, detail="OpenAI client not configured")
        
        # Limit text length for reasonable response times
        text_to_speak = request.text[:500]
        
        logger.info(f"Generating TTS for: '{text_to_speak[:50]}...'")
        
        # Use a natural voice - "nova" is conversational and clear
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=text_to_speak,
            speed=1.0
        )
        
        audio_content = response.content
        logger.info(f"Generated TTS audio: {len(audio_content)} bytes")
        
        return Response(
            content=audio_content,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
        
    except Exception as e:
        logger.error(f"TTS generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

# Summarization endpoint
@app.post("/summarize")
async def summarize_text(request: SummarizeRequest):
    """Generate structured summary from transcription"""
    try:
        if not request.transcription:
            raise HTTPException(status_code=400, detail="Transcription is required")
        
        if not openai_client:
            raise HTTPException(status_code=500, detail="OpenAI client not configured")
        
        logger.info(f"Generating summary for {len(request.transcription)} character transcription")
        
        prompt = f"""Analyze this field technician's voice recording and extract key information into a structured summary.

Transcription: "{request.transcription}"

Extract and format the following information:
- taskDescription: What work was performed (be specific and professional)
- location: Where the work took place 
- datetime: When the work was done (extract any time/date mentions)
- outcome: How the task went, completion status, success/issues
- notes: Any additional important details, follow-up needed, etc.

Format as JSON with these exact field names. Be professional but natural. If information isn't mentioned, use null.

Example:
{{
  "taskDescription": "Replaced faulty network switch in server room",
  "location": "Downtown Office Building, Server Room",
  "datetime": "March 15, 2024 at 2:30 PM", 
  "outcome": "Successfully completed. All network connections restored.",
  "notes": "Switch was overheating due to blocked ventilation. Recommended quarterly cleaning."
}}"""

        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.3
        )
        
        summary_text = response.choices[0].message.content
        
        try:
            summary_data = json.loads(summary_text)
            logger.info("Summary generated successfully")
            
            return {"summary": summary_data}
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "summary": {
                    "taskDescription": request.transcription[:200] + "..." if len(request.transcription) > 200 else request.transcription,
                    "location": None,
                    "datetime": None,
                    "outcome": None,
                    "notes": "Auto-generated from transcription"
                }
            }
            
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

# PDF Generation endpoint  
@app.post("/generate-pdf")
async def generate_pdf(request: GeneratePDFRequest):
    """Generate PDF report from summary and transcription"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        
        # Create temporary PDF file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            pdf_path = temp_file.name
        
        # Create PDF document
        doc = SimpleDocTemplate(pdf_path, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title = Paragraph("Field Service Report", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 0.2*inch))
        
        # Summary sections
        summary = request.summary
        
        if summary.get('taskDescription'):
            story.append(Paragraph("<b>Task Description:</b>", styles['Heading2']))
            story.append(Paragraph(summary['taskDescription'], styles['Normal']))
            story.append(Spacer(1, 0.1*inch))
        
        if summary.get('location'):
            story.append(Paragraph("<b>Location:</b>", styles['Heading2']))
            story.append(Paragraph(summary['location'], styles['Normal']))
            story.append(Spacer(1, 0.1*inch))
        
        if summary.get('datetime'):
            story.append(Paragraph("<b>Date/Time:</b>", styles['Heading2']))
            story.append(Paragraph(summary['datetime'], styles['Normal']))
            story.append(Spacer(1, 0.1*inch))
        
        if summary.get('outcome'):
            story.append(Paragraph("<b>Outcome:</b>", styles['Heading2']))
            story.append(Paragraph(summary['outcome'], styles['Normal']))
            story.append(Spacer(1, 0.1*inch))
        
        if summary.get('notes'):
            story.append(Paragraph("<b>Notes:</b>", styles['Heading2']))
            story.append(Paragraph(summary['notes'], styles['Normal']))
            story.append(Spacer(1, 0.2*inch))
        
        # Original transcription
        story.append(Paragraph("<b>Original Transcription:</b>", styles['Heading2']))
        story.append(Paragraph(request.transcription, styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        # Read PDF content
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
        
        # Clean up temp file
        os.unlink(pdf_path)
        
        logger.info(f"PDF generated successfully: {len(pdf_content)} bytes")
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=field_report.pdf"}
        )
        
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

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
        
        # Test TTS
        tts_response = openai_client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input="test"
        )
        tts_size = len(tts_response.content)
        
        return {
            "status": "success",
            "openai_key_present": bool(OPENAI_API_KEY),
            "openai_key_starts_with": OPENAI_API_KEY[:10] if OPENAI_API_KEY else None,
            "gpt_test": gpt_result,
            "tts_test_size": tts_size,
            "voice_model": "nova"
        }
        
    except Exception as e:
        logger.error(f"OpenAI debug test failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "openai_key_present": bool(OPENAI_API_KEY),
            "openai_key_starts_with": OPENAI_API_KEY[:10] if OPENAI_API_KEY else None
        }

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Enhanced Voice Report Backend API with Sam AI Agent",
        "version": "2.0.0",
        "agent": "Sam - Your AI Assistant for Field Reports",
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