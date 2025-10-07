# backend/services/transcription.py - COMPLETE FIXED FILE FOR GPT-5
import base64
import tempfile
import os
import logging
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional
from openai import OpenAI

from config import settings

logger = logging.getLogger(__name__)

class TranscriptionService:
    """Service for handling audio transcription using OpenAI Whisper"""
    
    def __init__(self, openai_client: OpenAI = None):
        """
        Initialize transcription service
        
        Args:
            openai_client: OpenAI client instance, if None will create from settings
        """
        if openai_client:
            self.client = openai_client
        else:
            self.client = OpenAI(api_key=settings.openai_api_key)
        
        logger.info("TranscriptionService initialized successfully")
    
    def transcribe_audio(self, audio_file_path: str) -> str:
        """
        Transcribe audio file to text using OpenAI Whisper API
        
        Args:
            audio_file_path: Path to the audio file
            
        Returns:
            Transcribed text
        """
        try:
            logger.info(f"Starting transcription for audio file: {audio_file_path}")
            
            # Check file size
            file_size = os.path.getsize(audio_file_path)
            file_size_mb = file_size / (1024 * 1024)
            logger.info(f"Audio file size: {file_size_mb:.2f} MB")
            
            # OpenAI Whisper has a 25MB limit
            if file_size_mb > 25:
                raise Exception("Audio file too large. Maximum size is 25MB")
            
            # Open and transcribe the audio file
            logger.info("Calling OpenAI Whisper API...")
            with open(audio_file_path, 'rb') as audio_file:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            # Get transcription text
            if isinstance(response, str):
                transcription_text = response
            else:
                transcription_text = response.text if hasattr(response, 'text') else str(response)
            
            transcription_text = transcription_text.strip()
            
            logger.info(f"Transcription completed. Length: {len(transcription_text)} characters")
            logger.info(f"Transcription preview: {transcription_text[:100]}...")
            
            return transcription_text
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            # Log more details about the error
            if hasattr(e, 'response'):
                logger.error(f"OpenAI API response: {e.response}")
            raise Exception(f"Failed to transcribe audio: {str(e)}")
    
    def process_voice_command(self, transcription: str, screen_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process voice commands for editing text with better context understanding
        NOTE: This method is deprecated - use VoiceAgentService instead
        """
        logger.warning("Using deprecated process_voice_command in TranscriptionService. Use VoiceAgentService instead.")
        
        try:
            # Build context from screen data
            context_description = self._build_context_description(screen_context)
            
            # Create prompt for GPT-5 - FIXED: Remove temperature parameter
            prompt = self._build_command_prompt(transcription, context_description)
            
            # Process with GPT-5 - NO TEMPERATURE PARAMETER
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command processor. Interpret commands and return structured JSON responses."
                    },
                    {"role": "user", "content": prompt}
                ]
                # NO temperature parameter for GPT-5
            )
            
            # Parse the response
            return self.parse_ai_response(response)
            
        except Exception as e:
            logger.error(f"Voice command processing failed: {e}")
            return self._create_error_response(str(e))
    
    def _build_context_description(self, screen_context: Optional[Dict[str, Any]]) -> str:
        """Build context description from screen data"""
        if not screen_context:
            return "No context available"
        
        context_parts = []
        
        # Add form data
        form_data = screen_context.get('currentValues', {})
        if form_data:
            context_parts.append(f"Current form data keys: {list(form_data.keys())}")
        
        # Add current field
        current_field = screen_context.get('currentField', '')
        if current_field:
            context_parts.append(f"Currently focused field: {current_field}")
        
        # Add visible fields
        visible_fields = screen_context.get('visibleFields', [])
        if visible_fields:
            field_descriptions = []
            for field in visible_fields:
                field_name = field.get('name', '')
                field_label = field.get('label', '')
                field_type = field.get('type', 'text')
                current_value = field.get('currentValue', '')
                
                if field_name:
                    desc = f"{field_name} ({field_label}): {field_type}"
                    if current_value:
                        desc += f", current value: '{current_value[:50]}...'" if len(current_value) > 50 else f", current value: '{current_value}'"
                    field_descriptions.append(desc)
            
            if field_descriptions:
                context_parts.append("Visible fields:\n" + "\n".join(field_descriptions))
        
        return "\n".join(context_parts) if context_parts else "No context available"
    
    def _build_command_prompt(self, transcription: str, context_description: str) -> str:
        """Build command processing prompt"""
        return f"""Process this voice command for a field service app:

Voice Command: "{transcription}"

Context:
{context_description}

Determine the appropriate action and return a JSON response with these fields:
- action: "update_field" | "navigate" | "submit" | "clear" | "acknowledge"
- target: field name or navigation target
- value: new value (if applicable)
- confidence: 0.0 to 1.0
- confirmation: user-friendly confirmation message

Examples:
 - "Submit the form" -> {"action": "submit", "target": "form", "value": null, "confidence": 0.95, "confirmation": "Submitting form"}
 - "Clear all fields" -> {"action": "clear", "target": "all", "value": null, "confidence": 0.85, "confirmation": "Clearing all fields"}

Return ONLY the JSON object, no additional text or markdown."""
    
    def parse_ai_response(self, response) -> Dict[str, Any]:
        """Parse AI response with robust error handling"""
        try:
            # Extract content from response
            if hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
            elif isinstance(response, dict):
                content = response.get('content', str(response))
            else:
                content = str(response)
            
            logger.info(f"AI response preview: {content[:200]}...")
            
            # Clean up the content - remove markdown if present
            content = self._clean_json_response(content)
            
            # Parse JSON
            parsed = json.loads(content)
            
            # Ensure required fields
            return self._ensure_response_fields(parsed)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Raw content: {content[:500]}...")
            return self._create_error_response("Failed to parse command")
        except Exception as e:
            logger.error(f"Unexpected error parsing response: {e}")
            return self._create_error_response(str(e))
    
    def _clean_json_response(self, content: str) -> str:
        """Clean JSON response by removing markdown and extra text"""
        # Remove markdown code blocks
        if '```json' in content:
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                return json_match.group(1).strip()
        elif '```' in content:
            json_match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                return json_match.group(1).strip()
        
        # Try to find JSON object
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json_match.group(0)
        
        return content.strip()
    
    def _ensure_response_fields(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure all required response fields are present"""
        defaults = {
            'action': 'acknowledge',
            'target': '',
            'value': '',
            'confidence': 0.5,
            'confirmation': 'Command processed',
            'success': True,
            'needs_clarification': False
        }
        
        for field, default_value in defaults.items():
            if field not in parsed:
                parsed[field] = default_value
        
        return parsed
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create a standard error response"""
        return {
            'action': 'acknowledge',
            'target': '',
            'value': '',
            'confidence': 0.0,
            'confirmation': 'Failed to process command',
            'success': False,
            'needs_clarification': False,
            'error': error_message
        }