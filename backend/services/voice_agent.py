# backend/services/voice_agent.py - FIXED VERSION
import json
import logging
from typing import Dict, Any, List
from openai import OpenAI
from datetime import datetime

from config import settings

logger = logging.getLogger(__name__)

class VoiceAgentService:
    """Service for processing voice commands and generating responses"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    async def process_voice_command(
        self, 
        transcription: str, 
        screen_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process voice command with screen context and return structured action
        
        Args:
            transcription: Voice command text from Whisper
            screen_context: Current screen state and available actions
            
        Returns:
            Dictionary with action, target, value, confidence, and TTS response
        """
        try:
            logger.info(f"Processing voice command: '{transcription}'")
            logger.info(f"Screen context: {screen_context.get('screenName')} - {screen_context.get('mode')}")
            
            # Create detailed context prompt
            prompt = self._build_command_prompt(transcription, screen_context)
            
            # Get GPT response
            response = await self._get_gpt_response(prompt)
            
            # Parse and validate response
            parsed_response = self._parse_gpt_response(response)
            
            # Enhance with context-aware improvements
            enhanced_response = self._enhance_response(parsed_response, screen_context)
            
            logger.info(f"Voice command result: '{transcription}' -> action: {enhanced_response['action']}, target: {enhanced_response.get('target', 'N/A')}")
            return enhanced_response
            
        except Exception as e:
            logger.error(f"Voice command processing failed: {e}")
            return self._create_error_response(str(e))
    
    def _build_command_prompt(self, transcription: str, screen_context: Dict[str, Any]) -> str:
        """Build detailed prompt for GPT with full context"""
        
        # Format available fields
        fields_info = self._format_fields(screen_context.get('visibleFields', []))
        
        # Format current values
        current_values = self._format_current_values(screen_context.get('currentValues', {}))
        
        # Format available actions
        actions = ', '.join(screen_context.get('availableActions', []))
        
        prompt = f"""You are an AI assistant for a field service voice report app. Your job is to interpret voice commands and return the appropriate action.

CURRENT SCREEN: {screen_context.get('screenName', 'unknown')}
CURRENT MODE: {screen_context.get('mode', 'N/A')}

AVAILABLE FIELDS:
{fields_info}

CURRENT VALUES:
{current_values}

AVAILABLE ACTIONS:
{actions}

USER COMMAND: "{transcription}"

COMMAND ANALYSIS:
Interpret the user's command and determine the most appropriate action. Consider:

1. FIELD UPDATES: Commands like "set location to X", "change the description", "update contact to John"
2. MODE CHANGES: Commands like "let me edit this", "switch to edit mode", "stop editing"
3. ACTION REQUESTS: Commands like "generate summary", "read the transcription", "send email"
4. CLARIFICATION NEEDED: When the intent is unclear

RESPONSE FORMAT:
Return a JSON object with these fields:
{{
  "action": "update_field|toggle_mode|execute_action|clarify|acknowledge",
  "target": "field_name_or_action_name",
  "value": "new_value_for_field_updates",
  "confidence": 0.95,
  "clarification": "question_if_confidence_low",
  "confirmation": "brief_confirmation_message",
  "ttsText": "what_to_say_back_to_user",
  "success": true,
  "needs_clarification": false
}}

FIELD MATCHING RULES:
- Match field names exactly when possible
- Use synonyms (e.g., "place" → "location", "person" → "contact") 
- Be flexible with natural language variations
- Default to most likely field if ambiguous

EXAMPLES:

Command: "Set location to downtown office"
Response: {{"action": "update_field", "target": "location", "value": "downtown office", "confidence": 0.95, "confirmation": "Set location to downtown office", "ttsText": "", "success": true, "needs_clarification": false}}

Command: "Change the hi to say hello instead"  
Response: {{"action": "update_field", "target": "transcription", "value": "{transcription.replace('hi', 'hello')}", "confidence": 0.90, "confirmation": "Updated transcription", "ttsText": "", "success": true, "needs_clarification": false}}

Command: "Say that we met John on site"
Response: {{"action": "update_field", "target": "onsite_contact", "value": "John", "confidence": 0.90, "confirmation": "Set onsite contact to John", "ttsText": "", "success": true, "needs_clarification": false}}

Command: "Read out my transcription"
Response: {{"action": "execute_action", "target": "read_transcription", "value": "", "confidence": 0.95, "confirmation": "Reading transcription", "ttsText": "{current_values.get('transcription', 'No transcription available')}", "success": true, "needs_clarification": false}}

Command: "Let me edit this"
Response: {{"action": "toggle_mode", "target": "edit_mode", "value": "true", "confidence": 0.95, "confirmation": "Switched to edit mode", "ttsText": "", "success": true, "needs_clarification": false}}

Command: "Generate the summary"
Response: {{"action": "execute_action", "target": "generate_summary", "value": "", "confidence": 0.95, "confirmation": "Generating summary", "ttsText": "", "success": true, "needs_clarification": false}}

IMPORTANT:
- Only use "ttsText" for explicit read requests or clarifications
- Keep "ttsText" empty for simple updates to avoid unnecessary chatter
- Use "clarify" action only when confidence < 0.7
- Always include "success": true and "needs_clarification": false unless there's an issue
- Be action-focused, not chatty
"""
        
        return prompt
    
    def _format_fields(self, fields: List[Dict]) -> str:
        """Format field information for prompt"""
        if not fields:
            return "No editable fields available"
        
        formatted = []
        for field in fields:
            synonyms = ', '.join(field.get('synonyms', []))
            current_val = field.get('currentValue', '')
            if len(current_val) > 50:
                current_val = current_val[:50] + "..."
            
            formatted.append(
                f"- {field['label']} (field: '{field['name']}'): "
                f"Current='{current_val}', "
                f"Editable={field['isEditable']}, "
                f"Synonyms=[{synonyms}]"
            )
        return '\n'.join(formatted)
    
    def _format_current_values(self, values: Dict[str, Any]) -> str:
        """Format current values for prompt"""
        if not values:
            return "No current values"
        
        formatted = []
        for key, value in values.items():
            if isinstance(value, str) and len(value) > 100:
                # Truncate long values
                display_value = value[:100] + "..."
            else:
                display_value = str(value)
            formatted.append(f"- {key}: '{display_value}'")
        
        return '\n'.join(formatted)
    
    async def _get_gpt_response(self, prompt: str) -> str:
        """Get response from GPT-4"""
        try:
            response = await self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful AI assistant that processes voice commands for a mobile field service app. Always respond with valid JSON in the exact format specified. Be action-focused and avoid unnecessary chatter."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistent responses
                max_tokens=500
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"GPT API call failed: {e}")
            raise
    
    def _parse_gpt_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate GPT JSON response"""
        try:
            # Extract JSON from response (in case there's extra text)
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[start_idx:end_idx]
            parsed = json.loads(json_str)
            
            # Validate required fields
            required_fields = ['action', 'confidence', 'confirmation']
            for field in required_fields:
                if field not in parsed:
                    logger.warning(f"Missing field {field}, using default")
                    if field == 'action':
                        parsed['action'] = 'acknowledge'
                    elif field == 'confidence':
                        parsed['confidence'] = 0.5
                    elif field == 'confirmation':
                        parsed['confirmation'] = 'Command received'
            
            # Add missing fields with defaults
            parsed.setdefault('target', '')
            parsed.setdefault('value', '')
            parsed.setdefault('ttsText', '')
            parsed.setdefault('success', True)
            parsed.setdefault('needs_clarification', False)
            parsed.setdefault('clarification', '')
            
            # Validate action type
            valid_actions = ['update_field', 'toggle_mode', 'execute_action', 'clarify', 'acknowledge']
            if parsed['action'] not in valid_actions:
                logger.warning(f"Invalid action {parsed['action']}, defaulting to acknowledge")
                parsed['action'] = 'acknowledge'
            
            return parsed
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse GPT response: {e}")
            logger.error(f"Raw response: {response}")
            # Return fallback response
            return {
                "action": "acknowledge",
                "target": "",
                "value": "",
                "confidence": 0.3,
                "clarification": "",
                "confirmation": "I didn't understand that command",
                "ttsText": "I didn't understand that command. Please try again.",
                "success": False,
                "needs_clarification": False
            }
    
    def _enhance_response(self, response: Dict[str, Any], screen_context: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance response with context-aware improvements"""
        
        # Handle transcription text replacement
        if (response['action'] == 'update_field' and 
            response.get('target') == 'transcription' and 
            'current_values' in screen_context):
            
            current_transcription = screen_context['current_values'].get('transcription', '')
            if current_transcription and 'change' in response.get('confirmation', '').lower():
                # Try to do smart text replacement based on the command
                response['value'] = self._perform_text_replacement(
                    current_transcription, 
                    response.get('value', '')
                )
        
        # Add current timestamp for date/time requests
        if (response['action'] == 'update_field' and 
            response.get('target') in ['datetime', 'date', 'time'] and 
            not response.get('value')):
            response['value'] = datetime.now().strftime('%Y-%m-%d %H:%M')
            response['confirmation'] = f"Added current date and time: {response['value']}"
        
        # Handle mode-specific enhancements
        current_mode = screen_context.get('mode')
        if response['action'] == 'update_field' and current_mode == 'preview':
            # Auto-switch to edit mode first
            response['action'] = 'toggle_mode'
            response['target'] = 'edit_mode'
            response['value'] = 'true'
            response['confirmation'] = 'Switched to edit mode'
        
        # Handle read requests
        if (response['action'] == 'execute_action' and 
            'read' in response.get('target', '').lower() and
            not response.get('ttsText')):
            
            transcription = screen_context.get('currentValues', {}).get('transcription', '')
            if transcription:
                response['ttsText'] = transcription
                response['confirmation'] = 'Reading transcription'
            else:
                response['ttsText'] = 'No transcription available to read'
                response['confirmation'] = 'No transcription available'
        
        return response
    
    def _perform_text_replacement(self, original_text: str, instruction: str) -> str:
        """Perform smart text replacement based on voice instruction"""
        try:
            # Simple replacement logic - can be enhanced
            lower_instruction = instruction.lower()
            if 'hi' in lower_instruction and 'hello' in lower_instruction:
                return original_text.replace('hi', 'hello').replace('Hi', 'Hello')
            elif 'hello' in lower_instruction and 'hi' in lower_instruction:
                return original_text.replace('hello', 'hi').replace('Hello', 'Hi')
            else:
                return instruction  # Use the instruction as the new text
        except:
            return instruction
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create error response"""
        return {
            "action": "acknowledge",
            "target": "",
            "value": "",
            "confidence": 0.0,
            "clarification": "",
            "confirmation": "Sorry, I encountered an error processing your command",
            "ttsText": "I encountered an error. Please try again.",
            "success": False,
            "needs_clarification": False,
            "error": error_message
        }