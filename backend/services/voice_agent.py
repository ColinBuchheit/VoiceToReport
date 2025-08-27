# backend/services/voice_agent.py - COMPLETE FIXED VERSION
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
            prompt = self._build_enhanced_prompt(transcription, screen_context)
            
            response = self.client.chat.completions.create(
                model=getattr(settings, 'gpt_model', 'gpt-4-turbo-preview'),
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command processor for a mobile field service app. Always respond with valid JSON. Be action-focused and avoid unnecessary responses."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=getattr(settings, 'gpt_max_tokens', 500),
                temperature=0.1
            )
            
            gpt_response = response.choices[0].message.content.strip()
            return self._parse_gpt_response(gpt_response)
            
        except Exception as e:
            logger.error(f"GPT processing failed: {e}")
            raise e
    
    def _build_enhanced_prompt(self, transcription: str, screen_context: Dict[str, Any]) -> str:
        """Build enhanced prompt for GPT processing"""
        
        fields_info = self._format_available_fields(screen_context.get('visibleFields', []))
        current_values = self._format_current_values(screen_context.get('currentValues', {}))
        
        return f"""Process this voice command for a field service app:

SCREEN: {screen_context.get('screenName', 'unknown')}
MODE: {screen_context.get('mode', 'N/A')}

AVAILABLE FIELDS:
{fields_info}

CURRENT VALUES:
{current_values}

COMMAND: "{transcription}"

Determine the appropriate action and respond with JSON:

{{
  "action": "update_field|toggle_mode|execute_action|acknowledge",
  "target": "field_name_or_action",
  "value": "new_value_if_updating",
  "confidence": 0.9,
  "confirmation": "brief_confirmation",
  "ttsText": "",
  "success": true,
  "needs_clarification": false
}}

EXAMPLES:
- "Change location to downtown" → {{"action": "update_field", "target": "location", "value": "downtown", "confidence": 0.9, "confirmation": "Location updated"}}
- "Set contact to John" → {{"action": "update_field", "target": "onsite_contact", "value": "John", "confidence": 0.9, "confirmation": "Contact updated"}}
- "Switch to edit mode" → {{"action": "toggle_mode", "target": "edit_mode", "confidence": 0.9, "confirmation": "Edit mode activated"}}

RULES:
- Use exact field names from available fields
- Keep ttsText empty for simple updates
- Only use ttsText for read commands or clarifications
- Be action-focused, not chatty"""
    
    def _fallback_command_processing(self, transcription: str, screen_context: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback pattern-based command processing"""
        try:
            logger.info("Using fallback pattern matching for command processing")
            command_lower = transcription.lower().strip()
            
            # Field update patterns
            field_updates = self._detect_field_updates(command_lower, transcription, screen_context)
            if field_updates:
                return field_updates
            
            # Mode toggle patterns
            mode_toggle = self._detect_mode_toggle(command_lower)
            if mode_toggle:
                return mode_toggle
            
            # Read/playback commands
            read_command = self._detect_read_command(command_lower, screen_context)
            if read_command:
                return read_command
            
            # Action commands
            action_command = self._detect_action_command(command_lower)
            if action_command:
                return action_command
            
            # Default acknowledgment
            return self._create_acknowledge_response(transcription)
            
        except Exception as e:
            logger.error(f"Fallback processing failed: {e}")
            return self._create_error_response(str(e))
    
    def _detect_field_updates(self, command_lower: str, original_command: str, screen_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Detect field update commands"""
        
        # Check for update keywords
        update_keywords = ['change', 'update', 'set', 'put', 'make', 'edit', 'modify']
        if not any(keyword in command_lower for keyword in update_keywords):
            return None
        
        # FIXED: Field mapping with synonyms - returns actual field names
        field_mappings = {
            'location': ['location', 'place', 'site', 'where', 'address'],
            'onsite_contact': ['contact', 'met with', 'person', 'who', 'onsite', 'front desk', 'who did you meet'],
            'support_contact': ['support', 'help', 'it support', 'technical', 'worked with for support'],
            'work_completed': ['work', 'task', 'job', 'completed', 'did', 'what work', 'work completed'],
            'transcription': ['transcription', 'text', 'transcript', 'recording', 'what i said', 'transcription text'],
            'technician_name': ['name', 'technician', 'my name', 'i am', 'technician name'],
            'delays': ['delay', 'delayed', 'wait', 'waiting', 'late', 'were there any delays'],
            'expenses': ['expense', 'cost', 'money', 'paid', 'parking', 'expenses'],
            'materials_used': ['material', 'parts', 'equipment', 'used', 'installed', 'materials used'],
            'troubleshooting_steps': ['troubleshooting', 'steps', 'debug', 'diagnose', 'troubleshooting steps'],
            'scope_completed': ['scope', 'completed', 'finished', 'done', 'scope completed'],
            'released_by': ['released', 'dismissed', 'who released', 'released by'],
            'release_code': ['release code', 'code', 'completion code'],
            'return_tracking': ['tracking', 'return', 'ups', 'fedex', 'tracking number'],
            'out_of_scope_work': ['out of scope', 'additional work', 'extra work'],
            'photos_uploaded': ['photos', 'pictures', 'images', 'how many photos']
        }
        
        # Try to match field
        matched_field = None
        for field_name, synonyms in field_mappings.items():
            if any(synonym in command_lower for synonym in synonyms):
                matched_field = field_name
                break
        
        if not matched_field:
            return None
        
        # Extract value
        value = self._extract_field_value(command_lower, original_command)
        
        # Special handling for transcription changes
        if matched_field == 'transcription':
            current_transcription = screen_context.get('currentValues', {}).get('transcription', '')
            value = self._apply_transcription_changes(original_command, current_transcription)
        
        return {
            "action": "update_field",
            "target": matched_field,
            "value": value,
            "confidence": 0.8,
            "confirmation": f"Updated {matched_field.replace('_', ' ')}",
            "ttsText": "",
            "success": True,
            "needs_clarification": False
        }
    
    def _detect_mode_toggle(self, command_lower: str) -> Optional[Dict[str, Any]]:
        """Detect mode toggle commands"""
        mode_keywords = ['edit', 'edit mode', 'modify', 'change mode', 'let me edit']
        
        if any(keyword in command_lower for keyword in mode_keywords):
            return {
                "action": "toggle_mode",
                "target": "edit_mode",
                "value": "true",
                "confidence": 0.9,
                "confirmation": "Switched to edit mode",
                "ttsText": "",
                "success": True,
                "needs_clarification": False
            }
        
        return None
    
    def _detect_read_command(self, command_lower: str, screen_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Detect read/playback commands"""
        read_keywords = ['read', 'tell me', 'what does it say', 'read out', 'say back']
        
        if any(keyword in command_lower for keyword in read_keywords):
            # Determine what to read
            if 'transcription' in command_lower or 'transcript' in command_lower:
                text_to_read = screen_context.get('currentValues', {}).get('transcription', 'No transcription available')
            else:
                text_to_read = screen_context.get('currentValues', {}).get('transcription', 'Nothing to read')
            
            return {
                "action": "acknowledge",
                "target": "read_transcription",
                "value": "",
                "confidence": 0.9,
                "confirmation": "Reading transcription",
                "ttsText": text_to_read,
                "success": True,
                "needs_clarification": False
            }
        
        return None
    
    def _detect_action_command(self, command_lower: str) -> Optional[Dict[str, Any]]:
        """Detect action commands"""
        action_mappings = {
            'generate_summary': ['generate', 'create summary', 'summarize', 'make summary'],
            'send_email': ['send email', 'email report', 'send report'],
            'save': ['save', 'save changes', 'commit'],
            'help': ['help', 'what can you do', 'capabilities']
        }
        
        for action, keywords in action_mappings.items():
            if any(keyword in command_lower for keyword in keywords):
                return {
                    "action": "execute_action",
                    "target": action,
                    "value": "",
                    "confidence": 0.8,
                    "confirmation": f"Executing {action.replace('_', ' ')}",
                    "ttsText": "",
                    "success": True,
                    "needs_clarification": False
                }
        
        return None
    
    def _extract_field_value(self, command_lower: str, original_command: str) -> str:
        """Extract value from command"""
        # Look for patterns like "set X to Y" or "change X to Y"
        patterns = [
            r'(?:set|change|update|put|make)\s+.*?\s+to\s+(.+)',
            r'(?:set|change|update|put|make)\s+.*?\s+is\s+(.+)',
            r'(?:set|change|update|put|make)\s+.*?\s+as\s+(.+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, command_lower)
            if match:
                return match.group(1).strip()
        
        # Fallback: take words after common prepositions
        prepositions = ['to', 'is', 'as', 'with']
        words = original_command.split()
        for i, word in enumerate(words):
            if word.lower() in prepositions and i + 1 < len(words):
                return ' '.join(words[i + 1:]).strip()
        
        # Last resort: return the command itself
        return original_command
    
    def _apply_transcription_changes(self, command: str, current_transcription: str) -> str:
        """Apply changes to transcription based on command"""
        command_lower = command.lower()
        
        # Handle text replacements
        if 'change' in command_lower:
            if 'hi' in command_lower and 'hello' in command_lower:
                if current_transcription:
                    return current_transcription.replace('hi', 'hello').replace('Hi', 'Hello')
            elif 'hello' in command_lower and 'hi' in command_lower:
                if current_transcription:
                    return current_transcription.replace('hello', 'hi').replace('Hello', 'Hi')
        
        # For other changes, return the extracted value
        return self._extract_field_value(command_lower, command)
    
    def _format_available_fields(self, fields: List[Dict]) -> str:
        """Format available fields for prompt"""
        if not fields:
            return "No fields available"
        
        formatted = []
        for field in fields:
            name = field.get('name', '')
            label = field.get('label', '')
            synonyms = field.get('synonyms', [])
            current = field.get('currentValue', '')[:50]
            
            formatted.append(f"- {label} ({name}): '{current}' [synonyms: {', '.join(synonyms)}]")
        
        return '\n'.join(formatted)
    
    def _format_current_values(self, values: Dict[str, Any]) -> str:
        """Format current values for prompt"""
        if not values:
            return "No current values"
        
        formatted = []
        for key, value in values.items():
            if isinstance(value, str) and len(value) > 100:
                display_value = value[:100] + "..."
            else:
                display_value = str(value)
            formatted.append(f"- {key}: '{display_value}'")
        
        return '\n'.join(formatted)
    
    def _parse_gpt_response(self, response: str) -> Dict[str, Any]:
        """Parse GPT JSON response with fallback"""
        try:
            # Extract JSON
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found")
            
            json_str = response[start_idx:end_idx]
            parsed = json.loads(json_str)
            
            # Ensure required fields
            required_fields = {
                'action': 'acknowledge',
                'target': '',
                'value': '',
                'confidence': 0.5,
                'confirmation': 'Command processed',
                'ttsText': '',
                'success': True,
                'needs_clarification': False
            }
            
            for field, default in required_fields.items():
                if field not in parsed:
                    parsed[field] = default
            
            return parsed
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Failed to parse GPT response: {e}")
            return self._create_acknowledge_response("Command received")
    
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