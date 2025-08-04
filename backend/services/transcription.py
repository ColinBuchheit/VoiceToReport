# backend/services/transcription.py
import base64
import tempfile
import os
import logging
import json
import re
from datetime import datetime
from typing import Dict, Any
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
    
    def parse_ai_response(self, response) -> Dict[str, Any]:
        """Robust AI response parsing with better error handling"""
        try:
            # Handle different response types
            if hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
            elif isinstance(response, dict):
                content = response.get('content', str(response))
            else:
                content = str(response)
            
            logger.info(f"Voice command AI response preview: {content[:200]}...")
            
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
            logger.error(f"Voice command JSON decode error: {e}")
            logger.error(f"Content that failed to parse: {content}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error parsing voice command AI response: {e}")
            return None
    
    async def transcribe_audio(self, audio_data: bytes, audio_format: str = 'm4a') -> str:
        """
        Transcribe audio bytes using Whisper
        
        Args:
            audio_data: Audio data as bytes
            audio_format: Audio file format (m4a, mp4, wav, etc.)
            
        Returns:
            Transcription text
            
        Raises:
            ValueError: If audio data is invalid
            Exception: If transcription fails
        """
        if not audio_data:
            raise ValueError("No audio data provided")
        
        if audio_format not in settings.supported_audio_formats:
            raise ValueError(f"Unsupported audio format: {audio_format}")
        
        logger.info(f"Starting transcription for {audio_format} audio")
        
        # Check file size
        audio_size_mb = len(audio_data) / (1024 * 1024)
        if audio_size_mb > settings.max_audio_size_mb:
            raise ValueError(f"Audio file too large: {audio_size_mb:.1f}MB (max: {settings.max_audio_size_mb}MB)")
        
        # Create temporary file for audio
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            # Transcribe using Whisper
            logger.info("Calling OpenAI Whisper API...")
            with open(temp_file_path, 'rb') as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
            
            transcription_text = transcript.text
            logger.info(f"Transcription completed. Length: {len(transcription_text)} characters")
            
            return transcription_text
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise Exception(f"Failed to transcribe audio: {str(e)}")
            
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary file: {temp_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file {temp_file_path}: {e}")
    
    async def process_voice_command(self, transcription: str, screen_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process voice commands for editing text with better context understanding"""
        
        try:
            # Build context from screen data with proper field mapping
            context_description = ""
            field_mapping = {}  # Map synonyms to actual field names
            
            if screen_context:
                # Extract current field values for context
                form_data = screen_context.get('currentValues', {})
                current_field = screen_context.get('currentField', '')
                visible_fields = screen_context.get('visibleFields', [])
                
                if form_data:
                    context_description = f"Current form data keys: {list(form_data.keys())}\n"
                if current_field:
                    context_description += f"Currently focused field: {current_field}\n"
                if visible_fields:
                    # Build field mapping and descriptions
                    field_descriptions = []
                    for field in visible_fields:
                        field_name = field.get('name', '')
                        field_label = field.get('label', '')
                        synonyms = field.get('synonyms', [])
                        current_value = field.get('currentValue', '')
                        is_editable = field.get('isEditable', False)
                        
                        # Only include editable fields
                        if is_editable:
                            # Add to mapping
                            field_mapping[field_name] = field_name
                            for synonym in synonyms:
                                field_mapping[synonym.lower()] = field_name
                            
                            field_descriptions.append(
                                f"- {field_label} ('{field_name}'): Current='{current_value[:50]}...'"
                            )
                    
                    context_description += f"Available editable fields:\n" + "\n".join(field_descriptions) + "\n"
                    context_description += f"Field mapping: {field_mapping}\n"
            
            prompt = f"""
You are processing a voice command for editing a field service closeout form. The user said: "{transcription}"

CONTEXT:
{context_description if context_description else "No screen context provided"}

FIELD MAPPING:
Common field names and their correct system names:
- "support team", "support person", "support contact" → support_contact
- "onsite contact", "who did you meet", "met with" → onsite_contact  
- "work completed", "work done", "task description" → work_completed
- "expenses", "parking", "costs" → expenses
- "photos", "pictures", "how many photos" → photos_uploaded
- "location", "place", "where" → location

Analyze this command and determine what the user wants to change. Respond with ONLY valid JSON in this exact format:
{{
    "action": "update_field|clarify|error",
    "target": "correct_field_name",
    "value": "new_value_as_string",
    "fieldUpdates": {{
        "correct_field_name": "new_value_as_string"
    }},
    "confidence": 0.0-1.0,
    "confirmation": "What I understood and will do",
    "ttsText": "Text to speak back to user",
    "success": true
}}

CRITICAL RULES:
1. Always respond with valid JSON only
2. Use action "update_field" for successful edits
3. Use EXACT field names from the available fields (support_contact NOT support_team)
4. ALL field values MUST be strings, even for numbers (use "4" not 4)
5. If unclear, use action "clarify" and set success to false
6. Keep ttsText conversational and brief

EXAMPLES:
Input: "change support team to Pavlov, the company"
Output: {{"action": "update_field", "target": "support_contact", "value": "Pavlov, the company", "fieldUpdates": {{"support_contact": "Pavlov, the company"}}, "confidence": 0.9, "confirmation": "Updated support contact to Pavlov, the company", "ttsText": "Support contact updated to Pavlov, the company", "success": true}}

Input: "we took four photos"
Output: {{"action": "update_field", "target": "photos_uploaded", "value": "4", "fieldUpdates": {{"photos_uploaded": "4"}}, "confidence": 0.9, "confirmation": "Updated photos uploaded to 4", "ttsText": "I updated the photos uploaded to 4", "success": true}}

Input: "add parking cost of 20 bucks"
Output: {{"action": "update_field", "target": "expenses", "value": "Parking: $20", "fieldUpdates": {{"expenses": "Parking: $20"}}, "confidence": 0.9, "confirmation": "Added parking expense of $20", "ttsText": "I added the parking expense of 20 dollars", "success": true}}
"""

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command assistant for field service forms. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=600
            )
            
            # Parse the response and ensure string values
            parsed_response = self.parse_ai_response(response)
            
            if parsed_response is None:
                return {
                    "action": "error",
                    "fieldUpdates": {},
                    "confidence": 0.0,
                    "confirmation": "I couldn't process your request",
                    "ttsText": "I'm sorry, I couldn't understand your request. Could you please try again?",
                    "success": False
                }
            
            # Ensure all field update values are strings
            if "fieldUpdates" in parsed_response and parsed_response["fieldUpdates"]:
                for key, value in parsed_response["fieldUpdates"].items():
                    parsed_response["fieldUpdates"][key] = str(value)
            
            return parsed_response
            
        except Exception as e:
            logger.error(f"Voice command processing error: {e}")
            return {
                "action": "error",
                "fieldUpdates": {},
                "confidence": 0.0,
                "confirmation": "An error occurred processing your command",
                "ttsText": "I encountered an error. Please try your command again.",
                "success": False
            }
    
    def test_connection(self) -> Dict[str, Any]:
        """Test OpenAI API connection"""
        try:
            # Test with a minimal API call
            models = self.client.models.list()
            return {
                "status": "success",
                "message": "OpenAI API connection successful",
                "models_available": len(models.data) > 0
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"OpenAI API connection failed: {str(e)}"
            }