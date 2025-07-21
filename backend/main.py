# backend/main.py - Complete Enhanced AI Agent with Natural Conversation
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

# Enhanced Pydantic models
class VoiceCommandRequest(BaseModel):
    audio: str  # base64 encoded audio
    screenContext: Dict[str, Any]

class VoiceCommandResponse(BaseModel):
    action: str
    target: Optional[str] = None
    value: Optional[str] = None
    confidence: float
    clarification: Optional[str] = None
    confirmation: str
    ttsText: str

class TextToSpeechRequest(BaseModel):
    text: str

class SummarizeRequest(BaseModel):
    transcription: str

class SummarizeResponse(BaseModel):
    summary: Dict[str, Any]

class GeneratePDFRequest(BaseModel):
    summary: Dict[str, Any]

class GeneratePDFResponse(BaseModel):
    pdf_url: str

# Enhanced AI Agent personality and capabilities
AGENT_PERSONA = """You are Sam, a friendly and efficient AI assistant working for a technology services company. You help field technicians create detailed service reports while they're on the road or at job sites.

Your personality:
- Professional yet conversational and warm
- Understanding that technicians are often busy, driving, or have their hands full
- Patient with voice recognition errors and ready to clarify when needed
- Knowledgeable about technology services: hardware replacement, installations, cable routing, network setup, and various IT services
- Efficient but thorough - you understand the importance of accurate documentation

Your capabilities:
- Process voice commands to update report fields
- Help with wording and suggestions for professional reports
- Ask clarifying questions when something is unclear
- Provide quick confirmations and natural responses
- Understand technical terminology and common abbreviations
- Handle multiple ways of saying the same thing (synonyms, colloquialisms)

Your communication style:
- Use natural, conversational language
- Keep responses brief but complete
- Sound helpful and approachable
- Acknowledge when you understand vs. when you need clarification
- Provide gentle guidance when needed"""

# Enhanced voice command processing endpoint
@app.post("/voice-command", response_model=VoiceCommandResponse)
async def process_voice_command(request: VoiceCommandRequest):
    """Enhanced voice command processing with natural conversation"""
    try:
        logger.info(f"Processing voice command for screen: {request.screenContext.get('screenName')}")
        
        # Validate inputs
        if not request.screenContext:
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I need to know what screen you're on. Can you try again?",
                confirmation="Missing screen context",
                ttsText="Sorry, I can't see what screen you're on. Could you try your command again?"
            )
        
        if not request.audio or len(request.audio) < 100:
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I didn't catch any audio. Please try speaking again.",
                confirmation="No audio received",
                ttsText="I didn't hear anything. Could you try speaking again, maybe a bit louder?"
            )

        # Process audio and get transcription
        try:
            audio_bytes = base64.b64decode(request.audio)
            logger.info(f"Processing audio: {len(audio_bytes)} bytes")
            
            if len(audio_bytes) < 1000:
                return VoiceCommandResponse(
                    action="clarify",
                    confidence=0.0,
                    clarification="That recording was quite short. Could you try speaking longer?",
                    confirmation="Audio too short",
                    ttsText="That was pretty quick. Could you try saying a bit more?"
                )

            # Create temp file for Whisper
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name

            # Transcribe with Whisper
            with open(temp_file_path, 'rb') as audio_file:
                transcription_response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                transcription = transcription_response.text.strip()

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I had trouble understanding the audio. Could you try speaking more clearly?",
                confirmation="Transcription failed",
                ttsText="Sorry, I couldn't quite catch that. Could you try speaking a bit more clearly?"
            )
        
        finally:
            try:
                os.unlink(temp_file_path)
            except:
                pass

        # Check if transcription is meaningful
        if not transcription or len(transcription.strip()) < 3:
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I didn't hear much. Could you try speaking a bit louder?",
                confirmation="No clear speech detected",
                ttsText="I didn't catch much there. Could you try speaking a bit louder?"
            )

        # Build enhanced context for GPT
        context = request.screenContext
        fields_info = []
        
        for field in context.get('visibleFields', []):
            field_desc = f"- {field['label']} ('{field['name']}')"
            field_desc += f": Current='{field.get('currentValue', 'empty')}'"
            field_desc += f", Type={field.get('type', 'text')}"
            if field.get('synonyms'):
                field_desc += f", Synonyms={field['synonyms']}"
            fields_info.append(field_desc)
        
        fields_text = "\n".join(fields_info) if fields_info else "No editable fields available"
        
        logger.info(f"Screen: {context.get('screenName')}, Fields: {len(context.get('visibleFields', []))}")
        logger.info(f"User said: '{transcription}'")

        # Enhanced prompt for more natural conversation
        prompt = f"""{AGENT_PERSONA}

CURRENT CONTEXT:
- Screen: {context.get('screenName', 'unknown')}
- Mode: {context.get('mode', 'N/A')}
- Available Actions: {', '.join(context.get('availableActions', []))}

AVAILABLE FIELDS TO UPDATE:
{fields_text}

TECHNICIAN SAID: "{transcription}"

Your task: Interpret what the technician wants to do and respond naturally. Consider:

1. FIELD UPDATES: If they want to change/update/set a field value
   - Match field names flexibly (location/place/where, task/work/job, notes/comments, etc.)
   - Use exact field names from the list above in your response
   - Be smart about partial matches and synonyms

2. QUESTIONS ABOUT CAPABILITIES: If they ask "what can you do" or similar
   - Use "explain_capabilities" action
   - Give them a helpful overview of your abilities

3. WORDING HELP: If they ask "how does that sound" or want wording suggestions
   - Use "provide_suggestion" action  
   - Look at current field values and suggest improvements

4. CLARIFICATIONS: If unclear (confidence < 0.7)
   - Use "clarify" action
   - Ask specific, helpful questions

5. MODE CHANGES: If they want to switch modes
   - Use "toggle_mode" action

6. GENERAL CONVERSATION: If they're just chatting or checking in
   - Use "acknowledge" action
   - Respond naturally and helpfully

Respond with JSON:
{{
  "action": "update_field|explain_capabilities|provide_suggestion|clarify|toggle_mode|acknowledge",
  "target": "exact_field_name_if_updating",
  "value": "new_value_if_updating_field", 
  "confidence": 0.95,
  "clarification": "specific_question_if_needed",
  "confirmation": "brief_technical_confirmation",
  "ttsText": "natural_conversational_response"
}}

Guidelines for responses:
- Sound like a helpful colleague, not a robot
- Use "Got it", "Sure thing", "No problem" etc.
- For confirmations: "Updated the location to Downtown Office"
- For questions: "I can help you update fields, suggest better wording, or answer questions about your report"
- Keep it conversational but professional
- Remember they might be driving or have their hands full
"""

        logger.info("Calling enhanced GPT for command processing...")
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are Sam, a helpful AI assistant for field technicians. Always respond with valid JSON only. Be conversational and natural in your ttsText responses."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            gpt_response = response.choices[0].message.content
            logger.info(f"GPT response: {gpt_response}")
            
            # Parse JSON response
            try:
                start_idx = gpt_response.find('{')
                end_idx = gpt_response.rfind('}') + 1
                json_str = gpt_response[start_idx:end_idx]
                parsed_response = json.loads(json_str)
                
                # Validate required fields
                required_fields = ['action', 'confidence', 'confirmation', 'ttsText']
                for field in required_fields:
                    if field not in parsed_response:
                        raise ValueError(f"Missing required field: {field}")
                
                # Ensure confidence is a float
                parsed_response['confidence'] = float(parsed_response['confidence'])
                
                # Create response object
                return VoiceCommandResponse(**parsed_response)
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse GPT response: {e}")
                return VoiceCommandResponse(
                    action="clarify",
                    confidence=0.0,
                    clarification="I had a processing error. Could you try that again?",
                    confirmation="Processing error",
                    ttsText="Sorry, I had a technical hiccup. Could you try saying that again?"
                )
                
        except Exception as e:
            logger.error(f"GPT processing failed: {e}")
            return VoiceCommandResponse(
                action="clarify",
                confidence=0.0,
                clarification="I'm having trouble processing that. Could you try again?",
                confirmation="GPT processing failed",
                ttsText="I'm having a bit of trouble right now. Could you try your request again?"
            )

    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        return VoiceCommandResponse(
            action="clarify",
            confidence=0.0,
            clarification="Something went wrong. Please try again.",
            confirmation="System error",
            ttsText="Sorry, something went wrong on my end. Could you try that again?"
        )

# Enhanced Text-to-Speech with better voice selection
@app.post("/text-to-speech")
async def text_to_speech(request: TextToSpeechRequest):
    """Generate natural-sounding speech with improved voice"""
    try:
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Limit text length for reasonable response times
        text_to_speak = request.text[:500]
        
        logger.info(f"Generating TTS for: '{text_to_speak[:50]}...'")
        
        # Use a more natural voice - "nova" is conversational and clear
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice="nova",  # Changed from "alloy" to "nova" for more natural sound
            input=text_to_speak,
            speed=1.0  # Normal speed for clear understanding
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

@app.post("/transcribe")
async def transcribe_audio(audio: str):
    """Transcribe audio to text using Whisper"""
    try:
        logger.info("Transcription request received")
        
        if not audio:
            raise HTTPException(status_code=400, detail="Audio data is required")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio)
        logger.info(f"Audio size: {len(audio_bytes)} bytes")
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe with Whisper
            with open(temp_file_path, 'rb') as audio_file:
                response = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
                transcription = response.text
            
            logger.info(f"Transcription completed: {len(transcription)} characters")
            return {"transcription": transcription}
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_text(request: SummarizeRequest):
    """Generate structured summary from transcription"""
    try:
        if not request.transcription or len(request.transcription.strip()) < 10:
            raise HTTPException(status_code=400, detail="Transcription too short to summarize")
        
        logger.info(f"Summarizing text: {len(request.transcription)} characters")
        
        # Enhanced prompt for field technician summaries
        prompt = f"""You are analyzing a work report from a field technician who provides technology services including hardware replacement, installations, cable routing, and various IT services for businesses.

Extract and organize the following information from this work report:

TRANSCRIPTION:
"{request.transcription}"

Please provide a structured JSON summary with these fields:
{{
  "location": "where the work was performed",
  "client_company": "name of the client/business", 
  "services_performed": ["list of specific services/tasks completed"],
  "equipment_involved": ["any hardware, cables, or equipment mentioned"],
  "issues_encountered": ["any problems or challenges faced"],
  "resolution_status": "completed/partial/pending",
  "additional_notes": "any other relevant details",
  "duration_estimate": "estimated time spent",
  "follow_up_needed": "yes/no and what type if yes"
}}

Focus on extracting factual information that would be important for service documentation, billing, and follow-up scheduling."""

        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts structured information from work reports. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
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

@app.post("/generate-pdf", response_model=GeneratePDFResponse) 
async def generate_pdf(request: GeneratePDFRequest):
    """Generate PDF report"""
    try:
        logger.info("PDF generation requested")
        # Placeholder - implement actual PDF generation as needed
        return GeneratePDFResponse(pdf_url="placeholder_pdf_url")
        
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail="PDF generation failed")

# Health check endpoints
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "Voice Report Backend"
    }

@app.get("/ai-agent/health")
async def ai_agent_health():
    """Enhanced health check for AI agent services"""
    try:
        # Test OpenAI connectivity
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
            "agent_persona": "Sam - Field Technician Assistant",
            "voice_model": "nova",
            "capabilities": [
                "field_updates",
                "wording_suggestions", 
                "capability_explanations",
                "natural_conversation"
            ]
        }
        
    except Exception as e:
        logger.error(f"AI agent health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

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
            voice="nova",
            input="test"
        )
        tts_size = len(tts_response.content)
        logger.info(f"TTS test size: {tts_size} bytes")
        
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