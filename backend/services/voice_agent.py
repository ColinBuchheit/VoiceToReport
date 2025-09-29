# backend/services/voice_agent.py - COMPLETE FILE WITH GPT-5 FIX
import json
import logging
import re
from typing import Dict, Any, List, Optional
from openai import OpenAI
from datetime import datetime

from config import settings

logger = logging.getLogger(__name__)

class VoiceAgentService:
    """Service for processing voice commands and generating responses"""
    
    def __init__(self):
        try:
            if not settings.openai_api_key:
                raise Exception("OpenAI API key not configured")
            
            self.client = OpenAI(api_key=settings.openai_api_key)
            logger.info("VoiceAgentService initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize VoiceAgentService: {e}")
            self.client = None
            raise e
    
    async def process_voice_command(
        self, 
        transcription: str, 
        screen_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process voice command with enhanced error handling and fallback processing
        """
        try:
            logger.info(f"Processing voice command: '{transcription}'")
            logger.info(f"Screen: {screen_context.get('screenName', 'unknown')}, Mode: {screen_context.get('mode', 'N/A')}")
            
            if not self.client:
                logger.warning("OpenAI client not available, using fallback processing")
                return self._fallback_command_processing(transcription, screen_context)
            
            # Try advanced GPT processing first
            try:
                return await self._gpt_command_processing(transcription, screen_context)
            except Exception as gpt_error:
                logger.warning(f"GPT processing failed: {gpt_error}")
                logger.info("Falling back to pattern matching")
                return self._fallback_command_processing(transcription, screen_context)
            
        except Exception as e:
            logger.error(f"Voice command processing error: {e}")
            return self._create_error_response(f"Failed to process command: {str(e)}")
    
    async def _gpt_command_processing(self, transcription: str, screen_context: Dict[str, Any]) -> Dict[str, Any]:
        """Advanced GPT-based command processing - FIXED for GPT-5"""
        try:
            prompt = self._build_enhanced_prompt(transcription, screen_context)
            
            # FIXED: Use max_completion_tokens for GPT-5 instead of max_tokens
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command processor for a mobile field service app. Always respond with valid JSON. Be action-focused and avoid unnecessary responses."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_completion_tokens=settings.gpt_max_tokens,  # FIXED: Changed from max_tokens
                temperature=settings.gpt_temperature
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"GPT response: {response_text[:200]}...")
            
            return self._parse_gpt_response(response_text)
            
        except Exception as e:
            logger.error(f"GPT processing failed: {e}")
            raise e
    
    def _build_enhanced_prompt(self, transcription: str, screen_context: Dict[str, Any]) -> str:
        """Build enhanced prompt for GPT with screen context - IMPROVED for text replacement"""
        
        screen_name = screen_context.get('screenName', 'unknown')
        mode = screen_context.get('mode', 'view')
        visible_fields = screen_context.get('visibleFields', [])
        current_values = screen_context.get('currentValues', {})
        
        field_list = "\n".join([
            f"- {field.get('label', field.get('name', ''))} ({field.get('name', '')}): '{field.get('currentValue', '')[:100]}...'"
            for field in visible_fields
        ])
        
        prompt = f"""Process this voice command for a field service app:

VOICE COMMAND: "{transcription}"

CURRENT SCREEN: {screen_name}
MODE: {mode}
AVAILABLE FIELDS:
{field_list}

TASK: Analyze the voice command and return a JSON response with these fields:
- action: One of [update_field, navigate, acknowledge, execute_action, clarify]
- target: The field name or navigation target (if applicable)
- value: The new value for the field (if updating a field)
- confidence: Your confidence level (0.0 to 1.0)
- confirmation: A brief confirmation message for the user
- ttsText: Text-to-speech response (can be empty)
- success: true/false
- needs_clarification: true if you need more info
- clarification_question: Question to ask user (if needs_clarification is true)

CRITICAL RULES:
1. TEXT REPLACEMENT COMMANDS: If user says "change X to Y" or "replace X with Y", where X and Y are WORDS/PHRASES (not field names):
   - target should be "transcription" (or current text field)
   - value should be the replacement instruction
   - Example: "change hi to hello" → {{"target": "transcription", "value": "Replace 'hi' with 'hello' in the text"}}

2. FIELD UPDATE COMMANDS: If user mentions an actual FIELD NAME from the list above:
   - target should be the exact field name
   - value should be the new field value
   - Example: "set location to downtown" → {{"target": "location", "value": "downtown"}}

3. FIELD NAME MATCHING:
   - Only use field names that appear in the AVAILABLE FIELDS list above
   - Match using synonyms when appropriate
   - If unsure, default to "transcription" for text changes

4. COMMON PATTERNS:
   - "change [word] to [word]" = text replacement in transcription
   - "set [field_name] to [value]" = field update
   - "update [field_name]" = field update

Respond ONLY with valid JSON, no markdown formatting."""
        
        return prompt
    
    def _parse_gpt_response(self, response_text: str) -> Dict[str, Any]:
        """Parse GPT response with robust error handling"""
        try:
            # Try to extract JSON from markdown code blocks
            if "```json" in response_text:
                json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(1)
            elif "```" in response_text:
                json_match = re.search(r'```\s*(.*?)\s*```', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(1)
            
            # Parse JSON
            parsed = json.loads(response_text)
            
            # Ensure all required fields exist with defaults
            required_fields = {
                'action': 'acknowledge',
                'target': '',
                'value': '',
                'confidence': 0.5,
                'confirmation': 'Command processed',
                'ttsText': '',
                'success': True,
                'needs_clarification': False,
                'clarification_question': ''
            }
            
            for field, default in required_fields.items():
                if field not in parsed:
                    parsed[field] = default
            
            return parsed
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse GPT response: {e}")
            return self._create_acknowledge_response("Command received")
    
    def _fallback_command_processing(self, transcription: str, screen_context: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback pattern matching for command processing - IMPROVED for text replacement"""
        logger.info("Using fallback pattern matching for command processing")
        
        transcription_lower = transcription.lower()
        
        # Pattern 1: "change X to Y" or "replace X with Y" - TEXT REPLACEMENT
        text_change_patterns = [
            r'(?:change|replace)\s+["\']?(.+?)["\']?\s+(?:to|with)\s+["\']?(.+?)["\']?(?:\?|$)',
            r'(?:change|replace)\s+(?:the\s+)?(.+?)\s+(?:to|with)\s+say\s+(.+?)(?:\?|$)',
            r'can you change\s+(.+?)\s+to\s+say\s+(.+?)(?:\?|$)'
        ]
        
        for pattern in text_change_patterns:
            match = re.search(pattern, transcription_lower)
            if match:
                old_text = match.group(1).strip('"\'')
                new_text = match.group(2).strip('"\'')
                
                # This is a text replacement, target should be transcription
                return {
                    "action": "update_field",
                    "target": "transcription",
                    "value": f"Replace '{old_text}' with '{new_text}'",
                    "confidence": 0.8,
                    "confirmation": f"Changing '{old_text}' to '{new_text}' in transcription",
                    "ttsText": "",
                    "success": True,
                    "needs_clarification": False,
                    "metadata": {
                        "replacement_type": "text_content",
                        "old_value": old_text,
                        "new_value": new_text
                    }
                }
        
        # Pattern 2: "set/update [field_name] to [value]" - FIELD UPDATE
        field_update_patterns = [
            r'(?:set|update)\s+(?:the\s+)?(.+?)\s+to\s+(.+)',
            r'change\s+(?:the\s+)?([a-z_]+)\s+to\s+(.+)',
        ]
        
        for pattern in field_update_patterns:
            match = re.search(pattern, transcription_lower)
            if match:
                field_ref = match.group(1).strip()
                new_value = match.group(2).strip()
                
                # Try to match field name
                field_name = self._match_field_name(field_ref, screen_context)
                
                if field_name:
                    return {
                        "action": "update_field",
                        "target": field_name,
                        "value": new_value,
                        "confidence": 0.8,
                        "confirmation": f"Updated {field_name.replace('_', ' ')}",
                        "ttsText": "",
                        "success": True,
                        "needs_clarification": False
                    }
        
        # Default: acknowledge
        return self._create_acknowledge_response(transcription)
    
    def _match_field_name(self, field_ref: str, screen_context: Dict[str, Any]) -> Optional[str]:
        """Match a field reference to an actual field name"""
        visible_fields = screen_context.get('visibleFields', [])
        field_ref_lower = field_ref.lower()
        
        for field in visible_fields:
            field_name = field.get('name', '').lower()
            field_label = field.get('label', '').lower()
            synonyms = [s.lower() for s in field.get('synonyms', [])]
            
            if field_ref_lower in [field_name, field_label] or field_ref_lower in synonyms:
                return field.get('name')
        
        return None
    
    def _create_acknowledge_response(self, transcription: str) -> Dict[str, Any]:
        """Create standard acknowledgment response"""
        return {
            "action": "acknowledge",
            "target": "",
            "value": "",
            "confidence": 0.7,
            "confirmation": f"I heard: {transcription}",
            "ttsText": "",
            "success": True,
            "needs_clarification": False
        }
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create error response"""
        logger.error(f"Creating error response: {error_message}")
        return {
            "action": "acknowledge",
            "target": "",
            "value": "",
            "confidence": 0.0,
            "clarification": "",
            "confirmation": "I had trouble understanding that command",
            "ttsText": "",
            "success": False,
            "needs_clarification": False,
            "error": error_message
        }