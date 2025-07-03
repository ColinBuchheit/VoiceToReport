# backend/services/voice_agent.py
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
            # Create detailed context prompt
            prompt = self._build_command_prompt(transcription, screen_context)
            
            # Get GPT response
            response = await self._get_gpt_response(prompt)
            
            # Parse and validate response
            parsed_response = self._parse_gpt_response(response)
            
            # Enhance with context-aware improvements
            enhanced_response = self._enhance_response(parsed_response, screen_context)
            
            logger.info(f"Voice command processed: '{transcription}' -> {enhanced_response['action']}")
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
        
        prompt = f"""You are an AI assistant helping a user interact with their mobile voice report app via voice commands.

CURRENT SCREEN: {screen_context.get('screenName', 'unknown')}
CURRENT MODE: {screen_context.get('mode', 'N/A')}

AVAILABLE FIELDS:
{fields_info}

CURRENT VALUES:
{current_values}

AVAILABLE ACTIONS:
{actions}

USER COMMAND: "{transcription}"

Your task is to interpret the user's voice command and determine the appropriate action. Consider:
1. Field name matching (exact, synonyms, and partial matches)
2. Context awareness (what screen they're on, what mode they're in)
3. Natural language variations
4. Common abbreviations and colloquialisms

Respond with a JSON object containing:
{{
  "action": "update_field|toggle_mode|navigate|execute_action|clarify",
  "target": "field_name_or_action_name",
  "value": "new_value_if_updating_field",
  "confidence": 0.95,
  "clarification": "Question to ask if confidence < 0.7",
  "confirmation": "Brief confirmation of what was done",
  "ttsText": "Natural spoken response"
}}

Rules:
- If confidence < 0.7, use "clarify" action and ask for clarification
- For field updates, use exact field names from the available fields
- For mode changes, use "toggle_mode" action
- For navigation/actions, use "execute_action" with the action name
- Keep TTS responses conversational but concise
- Handle common phrases like "change that", "update the place", etc.

Examples of good responses:
- "Updated! Location is now Downtown Office"
- "I heard 'place' - did you mean the location field?"
- "Switched to edit mode so you can make changes"
"""
        
        return prompt
    
    def _format_fields(self, fields: List[Dict]) -> str:
        """Format field information for prompt"""
        if not fields:
            return "No editable fields available"
        
        formatted = []
        for field in fields:
            synonyms = ', '.join(field.get('synonyms', []))
            formatted.append(
                f"- {field['label']} ('{field['name']}'): "
                f"Current='{field['currentValue']}', "
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
                        "content": "You are a helpful AI assistant that processes voice commands for a mobile app. Always respond with valid JSON."
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
            required_fields = ['action', 'confidence', 'confirmation', 'ttsText']
            for field in required_fields:
                if field not in parsed:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate action type
            valid_actions = ['update_field', 'toggle_mode', 'navigate', 'execute_action', 'clarify']
            if parsed['action'] not in valid_actions:
                raise ValueError(f"Invalid action: {parsed['action']}")
            
            return parsed
            
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse GPT response: {e}")
            logger.error(f"Raw response: {response}")
            raise ValueError("Invalid response format from AI")
    
    def _enhance_response(self, response: Dict[str, Any], screen_context: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance response with context-aware improvements"""
        
        # Add current timestamp for date/time requests
        if (response['action'] == 'update_field' and 
            response.get('target') == 'datetime' and 
            not response.get('value')):
            response['value'] = datetime.now().strftime('%Y-%m-%d %H:%M')
            response['ttsText'] = f"Added current date and time: {response['value']}"
        
        # Handle mode-specific enhancements
        current_mode = screen_context.get('mode')
        if response['action'] == 'update_field' and current_mode == 'preview':
            # Suggest switching to edit mode
            response['action'] = 'clarify'
            response['clarification'] = "You're in preview mode. Should I switch to edit mode first?"
            response['ttsText'] = "You're in preview mode. Should I switch to edit mode so you can make changes?"
        
        # Enhance confirmation messages with field labels
        if response['action'] == 'update_field':
            field_name = response.get('target')
            fields = screen_context.get('visibleFields', [])
            field_label = next((f['label'] for f in fields if f['name'] == field_name), field_name)
            
            if response.get('value'):
                response['confirmation'] = f"Updated {field_label} to: {response['value']}"
                response['ttsText'] = f"Updated! {field_label} is now {response['value']}"
        
        # Handle common action mappings
        if response['action'] == 'execute_action':
            target = response.get('target', '').lower()
            if 'pdf' in target or 'generate' in target:
                response['target'] = 'generate_pdf'
                response['ttsText'] = "Generating your PDF report now"
            elif 'edit' in target and 'mode' in target:
                response['action'] = 'toggle_mode'
                response['ttsText'] = "Switched to edit mode"
            elif 'preview' in target and 'mode' in target:
                response['action'] = 'toggle_mode'
                response['ttsText'] = "Switched to preview mode"
        
        return response
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create error response for failed commands"""
        return {
            "action": "clarify",
            "confidence": 0.0,
            "clarification": "I couldn't understand that command. Could you try again?",
            "confirmation": f"Error: {error_message}",
            "ttsText": "I didn't catch that. Could you please try again?"
        }
    
    async def generate_tts_audio(self, text: str) -> bytes:
        """Generate TTS audio using OpenAI"""
        try:
            response = await self.client.audio.speech.create(
                model="tts-1",  # Use standard model for cost efficiency
                voice="alloy",  # Professional, clear voice
                input=text,
                response_format="mp3"
            )
            
            return response.content
            
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise