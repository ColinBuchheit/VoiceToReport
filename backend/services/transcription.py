# backend/services/transcription.py - FIXED VERSION
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
    
    def transcribe_audio(self, audio_file_path: str) -> str:
        """
        FIXED: Transcribe audio file using Whisper - accepts file path
        
        Args:
            audio_file_path: Path to the audio file
            
        Returns:
            Transcription text
            
        Raises:
            ValueError: If audio file path is invalid
            Exception: If transcription fails
        """
        if not audio_file_path or not os.path.exists(audio_file_path):
            raise ValueError("Invalid audio file path")
        
        logger.info(f"Starting transcription for audio file: {audio_file_path}")
        
        # Get file info
        file_size = os.path.getsize(audio_file_path)
        file_size_mb = file_size / (1024 * 1024)
        logger.info(f"Audio file size: {file_size_mb:.2f} MB")
        
        # Check file size limit (25MB for OpenAI Whisper)
        if file_size_mb > 25:
            raise ValueError(f"Audio file too large: {file_size_mb:.1f}MB (max: 25MB)")
        
        try:
            # Transcribe using Whisper
            logger.info("Calling OpenAI Whisper API...")
            with open(audio_file_path, 'rb') as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en",  # You can remove this to auto-detect language
                    response_format="text"  # Get plain text response
                )
            
            # Handle different response formats
            if hasattr(transcript, 'text'):
                transcription_text = transcript.text
            else:
                transcription_text = str(transcript)
            
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
                        field_type = field.get('type', 'text')
                        current_value = field.get('currentValue', '')
                        synonyms = field.get('synonyms', [])
                        
                        # Add to field mapping
                        field_mapping[field_name.lower()] = field_name
                        field_mapping[field_label.lower()] = field_name
                        for synonym in synonyms:
                            field_mapping[synonym.lower()] = field_name
                        
                        # Build description
                        desc = f"- {field_label} ({field_name}): {field_type}"
                        if current_value:
                            desc += f" = '{current_value[:50]}'"
                        if synonyms:
                            desc += f" [synonyms: {', '.join(synonyms)}]"
                        field_descriptions.append(desc)
                    
                    context_description += "Available fields:\n" + "\n".join(field_descriptions)
            
            # Create system prompt for voice command processing
            system_prompt = f"""You are an AI assistant helping a user interact with a mobile form via voice commands.

CONTEXT:
{context_description}

VOICE COMMAND: "{transcription}"

Your task is to determine the appropriate action based on the voice command. Respond with a JSON object containing:
- "action": one of ["update_field", "navigate", "clarify", "help", "acknowledge"]
- "target": field name or navigation target (if applicable)
- "value": new value to set (if updating a field)
- "confidence": confidence score 0.0-1.0
- "clarification": question to ask user if unclear (optional)
- "confirmation": brief confirmation of what you understood

Examples:
- "Set location to downtown office" → {{"action": "update_field", "target": "location", "value": "downtown office", "confidence": 0.9, "confirmation": "Setting location to downtown office"}}
- "What can you help me with?" → {{"action": "help", "confidence": 1.0, "confirmation": "I can help you fill out forms by voice"}}
- "Change the description" → {{"action": "clarify", "clarification": "What would you like to change the description to?", "confidence": 0.7, "confirmation": "I need more details about the description change"}}

Be flexible with field name matching (use synonyms, partial matches, natural language variations).
"""

            try:
                # Get AI response for voice command processing
                response = self.client.chat.completions.create(
                    model=getattr(settings, 'gpt_model', 'gpt-3.5-turbo'),
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": transcription}
                    ],
                    max_tokens=getattr(settings, 'gpt_max_tokens', 300),
                    temperature=getattr(settings, 'gpt_temperature', 0.3)
                )
                
                # Parse the AI response
                ai_result = self.parse_ai_response(response)
                
                if ai_result:
                    # Validate and enhance the response
                    action = ai_result.get('action', 'acknowledge')
                    target = ai_result.get('target', '')
                    value = ai_result.get('value', '')
                    confidence = float(ai_result.get('confidence', 0.5))
                    clarification = ai_result.get('clarification', '')
                    confirmation = ai_result.get('confirmation', f"I heard: '{transcription}'")
                    
                    # Map target field name using field mapping
                    if target and target.lower() in field_mapping:
                        target = field_mapping[target.lower()]
                    
                    return {
                        "action": action,
                        "target": target,
                        "value": value,
                        "confidence": confidence,
                        "clarification": clarification,
                        "confirmation": confirmation,
                        "ttsText": clarification if clarification else confirmation
                    }
                else:
                    # Fallback response if AI parsing failed
                    return {
                        "action": "acknowledge",
                        "target": "",
                        "value": "",
                        "confidence": 0.3,
                        "clarification": "",
                        "confirmation": f"I heard: '{transcription}', but I'm not sure how to help with that.",
                        "ttsText": "I'm not sure how to help with that. Can you try rephrasing?"
                    }
                    
            except Exception as ai_error:
                logger.error(f"AI processing failed: {ai_error}")
                # Fallback to simple pattern matching
                return self._simple_voice_command_processing(transcription, field_mapping)
                
        except Exception as e:
            logger.error(f"Voice command processing failed: {e}")
            return {
                "action": "error",
                "target": "",
                "value": "",
                "confidence": 0.0,
                "clarification": "",
                "confirmation": "Sorry, I couldn't process that command.",
                "ttsText": "I encountered an error. Please try again."
            }
    
    def _simple_voice_command_processing(self, transcription: str, field_mapping: Dict[str, str] = None) -> Dict[str, Any]:
        """Simple fallback voice command processing using pattern matching"""
        
        command_lower = transcription.lower()
        
        # Help commands
        if any(word in command_lower for word in ['help', 'what can you do', 'capabilities']):
            return {
                "action": "help",
                "target": "",
                "value": "",
                "confidence": 0.9,
                "clarification": "",
                "confirmation": "I can help you fill out forms by voice",
                "ttsText": "I can help you fill out forms by voice, update fields, and answer questions about your work."
            }
        
        # Update field commands
        update_patterns = ['set', 'change', 'update', 'fill']
        for pattern in update_patterns:
            if pattern in command_lower:
                # Try to extract field and value
                parts = command_lower.split(pattern, 1)
                if len(parts) > 1:
                    remaining = parts[1].strip()
                    
                    # Look for "field to value" pattern
                    if ' to ' in remaining:
                        field_part, value_part = remaining.split(' to ', 1)
                        field_name = field_part.strip()
                        value = value_part.strip()
                        
                        # Map field name if possible
                        if field_mapping and field_name in field_mapping:
                            field_name = field_mapping[field_name]
                        
                        return {
                            "action": "update_field",
                            "target": field_name,
                            "value": value,
                            "confidence": 0.7,
                            "clarification": "",
                            "confirmation": f"Setting {field_name} to {value}",
                            "ttsText": f"Setting {field_name} to {value}"
                        }
        
        # Default acknowledgment
        return {
            "action": "acknowledge",
            "target": "",
            "value": "",
            "confidence": 0.5,
            "clarification": "",
            "confirmation": f"I heard: '{transcription}'",
            "ttsText": "I heard what you said, but I'm not sure how to help. Can you try rephrasing?"
        }