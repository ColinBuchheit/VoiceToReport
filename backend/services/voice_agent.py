# backend/services/voice_agent.py - FIXED VERSION WITH SCREEN AWARENESS
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
        """Advanced GPT-based command processing"""
        try:
            # Build screen-specific prompt
            if screen_context.get('screenName') == 'transcript':
                prompt = self._build_transcript_screen_prompt(transcription, screen_context)
            else:  # summary screen
                prompt = self._build_summary_screen_prompt(transcription, screen_context)
            
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command processor for a mobile field service app. Always respond with valid JSON. Be action-focused and context-aware."
                    },
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"GPT response received: {response_text[:200]}...")
            
            # Parse and validate response
            parsed_response = self._parse_gpt_response(response_text)
            
            # Ensure response has all required fields
            return self._validate_response_structure(parsed_response)
            
        except Exception as e:
            logger.error(f"GPT processing failed: {e}")
            raise e
    
    def _validate_response_structure(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure response has all required fields for frontend"""
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
            if field not in response:
                response[field] = default
        
        return response
    
    def _build_transcript_screen_prompt(self, transcription: str, screen_context: Dict[str, Any]) -> str:
        """Build prompt specific to transcript screen (single field)"""
        
        # Extract current transcription text
        current_text = ""
        visible_fields = screen_context.get('visibleFields', [])
        for field in visible_fields:
            if field.get('name') == 'transcription':
                current_text = field.get('currentValue', '')
                break
        
        prompt = f"""Voice Command: "{transcription}"

CURRENT SCREEN: transcript (Voice Transcription Screen)
MODE: {screen_context.get('mode', 'unknown')}

CURRENT TRANSCRIPTION TEXT:
"{current_text}"

This screen has ONLY ONE FIELD: the transcription text itself.

INSTRUCTIONS:
Analyze the voice command and determine the appropriate action.

Return a JSON response with these fields:
- action: "update_field" | "execute_action" | "navigate" | "clarify" | "acknowledge"
- target: field name or action name
- value: new value or complete modified text for replacements
- confidence: 0.0 to 1.0
- confirmation: brief confirmation message
- ttsText: text to speak (if any)
- success: boolean
- needs_clarification: boolean
- clarification_question: question to ask if clarification needed

RULES FOR TRANSCRIPT SCREEN:
1. TEXT REPLACEMENT: Any "change X to Y" command should modify the transcription text
   - Find X in the current text and replace with Y
   - Return the ENTIRE modified text in the value field
   - target should be "transcription"

2. POLISH/PROFESSIONAL: "make it professional", "clean it up" commands
   - Rewrite the entire transcription to be more professional
   - Return the ENTIRE rewritten text in the value field
   - target should be "transcription"

3. NAVIGATION: "generate summary", "generate closeout"
   - action should be "execute_action"
   - target should be "generate_summary"

Since this is the transcript screen with only one text field, assume most editing commands 
refer to modifying the transcription text content.

Respond ONLY with valid JSON, no markdown formatting."""
        
        return prompt
    
    def _build_summary_screen_prompt(self, transcription: str, screen_context: Dict[str, Any]) -> str:
        """Build prompt specific to summary screen (multiple fields)"""
        
        # Extract current content and fields
        current_text = ""
        visible_fields = screen_context.get('visibleFields', [])
        
        # Build field descriptions with current values
        field_info = []
        for field in visible_fields:
            field_name = field.get('name', '')
            field_label = field.get('label', '')
            field_type = field.get('type', 'text')
            current_value = field.get('currentValue', '')
            synonyms = field.get('synonyms', [])
            
            if field_name == 'transcription':
                current_text = current_value
            
            if field_name:
                field_desc = f"- {field_name} ({field_label}): {field_type} field"
                if current_value:
                    # Show current value for context
                    field_desc += f", current value: '{current_value[:100]}...'" if len(current_value) > 100 else f", current value: '{current_value}'"
                if synonyms:
                    field_desc += f", synonyms: {', '.join(synonyms[:5])}"
                field_info.append(field_desc)
        
        fields_description = "\n".join(field_info) if field_info else "No fields available"
        
        prompt = f"""Voice Command: "{transcription}"

CURRENT SCREEN: summary (Closeout Summary Screen)
MODE: edit (always editable)

AVAILABLE FIELDS IN SUMMARY:
{fields_description}

This screen has MULTIPLE FIELDS for different aspects of the closeout report.

INSTRUCTIONS:
Analyze the voice command and determine the appropriate action.

Return a JSON response with these fields:
- action: "update_field" | "execute_action" | "navigate" | "clarify" | "acknowledge"
- target: field name or action name
- value: new value
- confidence: 0.0 to 1.0
- confirmation: brief confirmation message
- ttsText: text to speak (if any)
- success: boolean
- needs_clarification: boolean
- clarification_question: question to ask if clarification needed

RULES FOR SUMMARY SCREEN:

1. FIELD UPDATES: Commands that mention field names, labels, or synonyms
   IMPORTANT: Look for these patterns that indicate field updates:
   - "change [number] photos to [number]" → update photos_uploaded field
   - "set [field] to [value]" → update that field
   - "update [field]" → update that field (may need clarification for value)
   - Numbers often refer to field values (e.g., "3 photos" refers to photos_uploaded field)
   
   Examples:
   - "change 3 photos to 4" → target: "photos_uploaded", value: "4 photos"
   - "change the photos from 3 to 4" → target: "photos_uploaded", value: "4 photos"
   - "update location to downtown" → target: "location", value: "downtown"
   - "set technician name to John" → target: "technician_name", value: "John"

2. TEXT REPLACEMENT IN TRANSCRIPTION FIELD ONLY:
   Only use text replacement if:
   - The user explicitly mentions "transcription" or "transcript"
   - OR the text to replace is found in the transcription field content
   
3. EMAIL ACTION: "send email", "email report"
   - action should be "execute_action"
   - target should be "send_email"

DISAMBIGUATION RULES:
- Numbers in commands usually refer to field values, NOT text replacement
- "change [number] [field]" = field update, NOT text replacement
- Check field synonyms to identify which field to update
- The summary screen is for structured data, so prefer field updates over text replacement

Common field update patterns:
- "change 3 photos to 4" → photos_uploaded field
- "update expenses to $50" → expenses field
- "set location to downtown" → location field
- "technician name is John" → technician_name field

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
        """Fallback pattern matching for command processing"""
        logger.info("Using fallback pattern matching for command processing")
        
        transcription_lower = transcription.lower()
        screen_name = screen_context.get('screenName', 'unknown')
        
        # Get current text content and field info
        current_text = ""
        visible_fields = screen_context.get('visibleFields', [])
        for field in visible_fields:
            if field.get('name') == 'transcription':
                current_text = field.get('currentValue', '')
                break
        
        # SUMMARY SCREEN: Check for field updates first
        if screen_name == 'summary':
            # Pattern 1: Photos field updates
            photo_patterns = [
                r'(?:change|update|set)\s+(?:the\s+)?(\d+)\s+photos?\s+to\s+(?:say\s+)?(\d+)',
                r'(?:change|update)\s+photos?\s+(?:from\s+)?(\d+)?\s*to\s+(\d+)',
                r'(\d+)\s+photos?\s+(?:should be|to)\s+(\d+)',
            ]
            
            for pattern in photo_patterns:
                match = re.search(pattern, transcription_lower)
                if match:
                    # Extract the new number (last captured group)
                    new_value = match.group(match.lastgroup)
                    
                    return {
                        "action": "update_field",
                        "target": "photos_uploaded",
                        "value": f"{new_value} photos",
                        "confidence": 0.9,
                        "confirmation": f"Updated photos to {new_value}",
                        "ttsText": "",
                        "success": True,
                        "needs_clarification": False
                    }
            
            # Pattern 2: Other field updates
            field_update_patterns = [
                r'(?:set|change|update)\s+(?:the\s+)?([a-z_]+)\s+(?:to|as)\s+(.+)',
                r'([a-z_]+)\s+(?:is|should be|equals)\s+(.+)',
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
        
        # TRANSCRIPT SCREEN: Text replacements
        elif screen_name == 'transcript':
            text_change_patterns = [
                r'(?:change|replace)\s+["\']?(.+?)["\']?\s+(?:to|with)\s+["\']?(.+?)["\']?(?:\?|$)',
            ]
            
            for pattern in text_change_patterns:
                match = re.search(pattern, transcription_lower)
                if match:
                    old_text = match.group(1).strip()
                    new_text = match.group(2).strip()
                    
                    # Check if old_text exists in current transcription
                    if old_text in current_text.lower():
                        # Perform case-insensitive replacement
                        import re
                        modified_text = re.sub(
                            re.escape(old_text), 
                            new_text, 
                            current_text, 
                            flags=re.IGNORECASE
                        )
                        
                        return {
                            "action": "update_field",
                            "target": "transcription",
                            "value": modified_text,
                            "confidence": 0.85,
                            "confirmation": f"Replaced '{old_text}' with '{new_text}'",
                            "ttsText": "",
                            "success": True,
                            "needs_clarification": False
                        }
        
        # Pattern 3: Navigation commands (both screens)
        if any(phrase in transcription_lower for phrase in ['generate summary', 'generate closeout', 'create summary']):
            return {
                "action": "execute_action",
                "target": "generate_summary",
                "value": "",
                "confidence": 0.9,
                "confirmation": "Generating closeout summary",
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
            
            # Check direct matches
            if field_ref_lower == field_name:
                return field.get('name')
            
            # Check label matches
            if field_ref_lower in field_label:
                return field.get('name')
            
            # Check synonym matches
            if field_ref_lower in synonyms:
                return field.get('name')
            
            # Check partial matches in synonyms
            for synonym in synonyms:
                if field_ref_lower in synonym or synonym in field_ref_lower:
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