# backend/services/voice_agent.py - COMPLETE FIXED FILE FOR GPT-5
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
            
            # FIXED: Remove temperature parameter for GPT-5
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command processor for a mobile field service app. Always respond with valid JSON. Be action-focused and avoid unnecessary responses."
                    },
                    {"role": "user", "content": prompt}
                ]
                # NO temperature parameter for GPT-5
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
    
    def _build_enhanced_prompt(self, transcription: str, screen_context: Dict[str, Any]) -> str:
        """Build comprehensive prompt for GPT-5 with better context understanding"""
        
        # Extract current content if available
        current_text = ""
        visible_fields = screen_context.get('visibleFields', [])
        for field in visible_fields:
            if field.get('name') == 'transcription':
                current_text = field.get('currentValue', '')
                break
        
        # Build field descriptions
        field_info = []
        for field in visible_fields:
            field_name = field.get('name', '')
            field_label = field.get('label', '')
            field_type = field.get('type', 'text')
            current_value = field.get('currentValue', '')
            
            if field_name and field_name != 'transcription':
                field_info.append(f"- {field_name} ({field_label}): {field_type} field, current value: '{current_value}'")
        
        fields_description = "\n".join(field_info) if field_info else "No additional fields available"
        
        prompt = f"""Voice Command: "{transcription}"

CURRENT SCREEN: {screen_context.get('screenName', 'unknown')}
MODE: {screen_context.get('mode', 'unknown')}

CURRENT TEXT CONTENT:
"{current_text}"

AVAILABLE FIELDS:
{fields_description}

INSTRUCTIONS:
Analyze the voice command and determine the appropriate action. Return a JSON response with these fields:
- action: "update_field" | "execute_action" | "navigate" | "clarify" | "acknowledge"
- target: field name or action name
- value: new value or complete modified text for replacements
- confidence: 0.0 to 1.0
- confirmation: brief confirmation message
- ttsText: text to speak (if any)
- success: boolean
- needs_clarification: boolean
- clarification_question: question to ask if clarification needed

CRITICAL RULES:

1. TEXT REPLACEMENT COMMANDS: If user says "change X to Y" or "replace X with Y":
   - You must perform the replacement on the CURRENT TEXT CONTENT shown above
   - Return the ENTIRE modified text in the value field
   - target should be "transcription"
   - Example: If current text is "Hi there, how are you?" and command is "change hi to hello", 
     value should be "Hello there, how are you?" (the complete modified text)

2. POLISH/PROFESSIONAL COMMANDS: If user says "make it professional", "polish it", "clean it up":
   - Rewrite the CURRENT TEXT CONTENT to be more professional
   - Return the ENTIRE rewritten text in the value field
   - target should be "transcription"

3. REMOVE/DELETE COMMANDS: If user says "remove curse words", "delete X", "take out Y":
   - Remove the specified content from CURRENT TEXT CONTENT
   - Return the ENTIRE modified text in the value field
   - target should be "transcription"

4. FIELD UPDATE COMMANDS: If user mentions a specific field name from the AVAILABLE FIELDS list:
   - target should be the exact field name
   - value should be the new field value
   - Example: "set location to downtown" → target: "location", value: "downtown"

5. NAVIGATION COMMANDS: If user says "generate summary", "generate closeout", "next screen":
   - action should be "execute_action"
   - target should be "generate_summary" or appropriate action
   - value can be empty

Common patterns to recognize:
- "change [word/phrase] to [word/phrase]" = text replacement in current content
- "make this sound more [adjective]" = rewrite current content  
- "set [field_name] to [value]" = field update
- "update [field_name]" = field update (needs clarification for value)
- "generate closeout" = execute action to generate summary

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
        
        # Get current text content if available
        current_text = ""
        visible_fields = screen_context.get('visibleFields', [])
        for field in visible_fields:
            if field.get('name') == 'transcription':
                current_text = field.get('currentValue', '')
                break
        
        # Pattern 1: "change X to Y" or "replace X with Y" - TEXT REPLACEMENT
        text_change_patterns = [
            r'(?:change|replace)\s+["\']?(.+?)["\']?\s+(?:to|with)\s+["\']?(.+?)["\']?(?:\?|$)',
            r'(?:change|replace)\s+(?:the\s+)?(.+?)\s+(?:to|with)\s+say\s+(.+?)(?:\?|$)',
            r'make\s+(?:the\s+)?(.+?)\s+say\s+(.+?)(?:\?|$)'
        ]
        
        for pattern in text_change_patterns:
            match = re.search(pattern, transcription_lower)
            if match:
                find_text = match.group(1).strip()
                replace_text = match.group(2).strip()
                
                # Perform replacement on current text
                if current_text:
                    # Case-insensitive replacement
                    import re
                    modified_text = re.sub(
                        re.escape(find_text), 
                        replace_text, 
                        current_text, 
                        flags=re.IGNORECASE
                    )
                    
                    if modified_text != current_text:
                        return {
                            "action": "update_field",
                            "target": "transcription",
                            "value": modified_text,  # Return complete modified text
                            "confidence": 0.9,
                            "confirmation": f"Changed '{find_text}' to '{replace_text}'",
                            "ttsText": "",
                            "success": True,
                            "needs_clarification": False
                        }
        
        # Pattern 2: Professional/Polish commands
        professional_patterns = ['make it professional', 'polish it', 'clean it up', 'make it formal']
        for pattern in professional_patterns:
            if pattern in transcription_lower:
                if current_text:
                    # Simple professional rewrite (in production, use GPT for better results)
                    professional_text = self._make_professional(current_text)
                    return {
                        "action": "update_field",
                        "target": "transcription",
                        "value": professional_text,
                        "confidence": 0.8,
                        "confirmation": "Made the text more professional",
                        "ttsText": "",
                        "success": True,
                        "needs_clarification": False
                    }
        
        # Pattern 3: Navigation commands
        if any(phrase in transcription_lower for phrase in ['generate summary', 'create summary', 'generate closeout']):
            return {
                "action": "execute_action",
                "target": "generate_summary",
                "value": "",
                "confidence": 0.9,
                "confirmation": "Generating summary",
                "ttsText": "",
                "success": True,
                "needs_clarification": False
            }
        
        # Pattern 4: Field updates
        field_update_patterns = [
            r'set\s+([a-z_]+)\s+to\s+(.+)',
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
        
        # Default: acknowledge
        return self._create_acknowledge_response(transcription)
    
    def _make_professional(self, text: str) -> str:
        """Simple function to make text more professional (placeholder for GPT enhancement)"""
        # Remove casual phrases
        replacements = {
            "hi": "Hello",
            "hey": "Hello",
            "yeah": "yes",
            "nope": "no",
            "gonna": "going to",
            "wanna": "want to",
            "gotta": "have to",
            "kinda": "kind of",
            "sorta": "sort of"
        }
        
        professional_text = text
        for casual, formal in replacements.items():
            professional_text = re.sub(r'\b' + casual + r'\b', formal, professional_text, flags=re.IGNORECASE)
        
        # Ensure first letter is capitalized
        if professional_text:
            professional_text = professional_text[0].upper() + professional_text[1:]
        
        # Ensure ends with period if not already punctuated
        if professional_text and professional_text[-1] not in '.!?':
            professional_text += '.'
        
        return professional_text
    
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