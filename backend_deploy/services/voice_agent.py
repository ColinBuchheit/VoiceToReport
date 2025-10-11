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
        # ========== DETAILED LOGGING START ==========
        try:
            logger.info("=" * 80)
            logger.info("🎤 VOICE COMMAND PROCESSING STARTED")
            logger.info("=" * 80)
            logger.info(f"📝 Transcription: '{transcription}'")
            logger.info(f"📱 Screen: {screen_context.get('screenName', 'unknown')}")
            logger.info(f"🔧 Mode: {screen_context.get('mode', 'unknown')}")

            visible_fields = screen_context.get('visibleFields', [])
            logger.info(f"📋 Available Fields ({len(visible_fields)}):")
            for field in visible_fields:
                field_name = field.get('name', 'unnamed')
                current_val = field.get('currentValue', '') or ''
                val_preview = (current_val[:50] + '...') if isinstance(current_val, str) and len(current_val) > 50 else str(current_val)
                logger.info(f"  - {field_name}: '{val_preview}'")
            logger.info("=" * 80)
        except Exception as e:
            logger.warning(f"Failed to log initial processing metadata: {e}")
        # ========== DETAILED LOGGING END ==========
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
            
            # Right before the GPT API call
            logger.info("🤖 Sending prompt to GPT...")
            logger.debug(f"Prompt length: {len(prompt)} characters")
            try:
                logger.debug(f"Prompt preview (first 500 chars):\n{prompt[:500]}")
            except Exception:
                pass

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
            logger.info(f"✅ GPT response received ({len(response_text)} characters)")
            logger.info(f"📄 Full GPT Response:\n{response_text}")
            
            # Parse and validate response
            parsed_response = self._parse_gpt_response(response_text, screen_context)
            
            # Ensure response has all required fields
            validated = self._validate_response_structure(parsed_response)

            # After parsing and validation, log analysis
            try:
                logger.info("🔍 PARSED RESPONSE ANALYSIS:")
                logger.info(f"  - Action: {validated.get('action')}")
                logger.info(f"  - Target: {validated.get('target')}")
                val_prev = str(validated.get('value', ''))
                logger.info(f"  - Value: {val_prev[:100] + ('...' if len(val_prev) > 100 else '')}")
                logger.info(f"  - Confidence: {validated.get('confidence')}")
                if validated.get('fieldUpdates'):
                    fu = validated['fieldUpdates']
                    logger.info(f"  - Field Updates ({len(fu)}):")
                    for fname, fval in fu.items():
                        sval = str(fval)
                        prev = sval[:80] + ('...' if len(sval) > 80 else '')
                        logger.info(f"      • {fname}: '{prev}'")
                else:
                    logger.info("  - Field Updates: None")
                logger.info(f"  - Confirmation: {validated.get('confirmation')}")
                logger.info(f"  - Success: {validated.get('success')}")
                logger.info("=" * 80)
            except Exception as e:
                logger.warning(f"Failed to log parsed response analysis: {e}")

            # Post-processing: if user intent is revert/undo but GPT didn't produce an update, attempt deterministic revert
            lower_tx = transcription.lower()
            if ('revert' in lower_tx or 'undo' in lower_tx):
                # Only override if GPT did NOT already produce a concrete update_field(s)
                if not (validated.get('action') in ['update_field', 'update_fields'] and validated.get('fieldUpdates')):
                    revert_attempt = self._attempt_revert(transcription, screen_context)
                    if revert_attempt:
                        return revert_attempt

            # Post-processing: location append logic
            # If the user said to append/add to the location ("append X to location", "add X to location", "at the end of location X")
            # and we currently have an existing location value, merge instead of full replace to preserve prior context.
            try:
                if validated.get('fieldUpdates') and 'location' in validated['fieldUpdates']:
                    trans_l = lower_tx
                    additive_intent = False
                    # Detect additive phrases around 'location'
                    additive_patterns = [
                        r'(append|add)\s+[^.?!]{0,80}\blocation',
                        r'\bat the end of\s+location',
                        r'location\s+(?:field\s+)?(?:append|add)',
                        r'(?:append|add)\s+[^.?!]{0,10}$'  # trailing add (edge)
                    ]
                    for pat in additive_patterns:
                        if re.search(pat, trans_l):
                            additive_intent = True
                            break
                    # Additional heuristic: phrase "at the end of location" specifically
                    if 'at the end of location' in trans_l:
                        additive_intent = True

                    if additive_intent:
                        # Obtain current location from screen context
                        current_location = None
                        for f in screen_context.get('visibleFields', []):
                            if f.get('name') == 'location':
                                current_location = f.get('currentValue') or ''
                                break
                        new_fragment = validated['fieldUpdates'].get('location') or ''
                        if current_location and current_location.lower() not in ['not mentioned', '']:
                            # Avoid duplicating if already present
                            if new_fragment and new_fragment.lower() not in current_location.lower():
                                merged = current_location.rstrip() + (' ' if not current_location.endswith(' ') else '') + new_fragment.lstrip()
                                logger.info(f"Appending to location instead of replacing. Prev='{current_location}' Add='{new_fragment}' -> New='{merged}'")
                                validated['fieldUpdates']['location'] = merged
                                # If single-field update semantics used
                                if validated.get('action') == 'update_field' and validated.get('target') == 'location':
                                    validated['value'] = merged
                                # Update confirmation to reflect append
                                if validated.get('confirmation') and 'Updated' in validated['confirmation']:
                                    validated['confirmation'] = 'Appended to location'
                                else:
                                    validated['confirmation'] = 'Appended to location'
            except Exception as e:
                logger.warning(f"Location append merge logic failed: {e}")
            return validated
            
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
            'clarification_question': '',
            'fieldUpdates': {}
        }
        
        for field, default in required_fields.items():
            if field not in response:
                response[field] = default

        # Normalize common action typos/synonyms
        action_map = {
            'field_update': 'update_field',
            'edit': 'update_field',
            'change_field': 'update_field',
        }
        act_lower = (response.get('action') or '').lower()
        if act_lower in action_map:
            response['action'] = action_map[act_lower]

        # If target present & action is acknowledge but it looks like a field update
        if response.get('action') == 'acknowledge' and response.get('target') and response.get('value'):
            response['action'] = 'update_field'
        
        # GENERATE SMART CONFIRMATION MESSAGES
        # Only override if current confirmation is generic/missing
        current_confirmation = response.get('confirmation', '')
        if not current_confirmation or current_confirmation in ['Command processed', 'Acknowledged', '']:
            response['confirmation'] = self._generate_confirmation_message(response)

        # Generate TTS if missing
        if not response.get('ttsText'):
            response['ttsText'] = self._generate_tts_message(response)

        return response

    def _generate_confirmation_message(self, response: Dict[str, Any]) -> str:
        """
        Generate an intelligent confirmation message based on what actually changed.
        Handles single-field updates, multi-field updates, clarifications, and actions.
        """
        action = response.get('action', '')

        # Multi-field update
        if action == 'update_fields' and response.get('fieldUpdates'):
            fields = list(response['fieldUpdates'].keys())
            if len(fields) == 0:
                return "No fields were updated"
            elif len(fields) == 1:
                field_name = fields[0].replace('_', ' ')
                return f"Updated {field_name}"
            elif len(fields) == 2:
                field1 = fields[0].replace('_', ' ')
                field2 = fields[1].replace('_', ' ')
                return f"Updated {field1} and {field2}"
            else:
                # More than 2 fields
                field_list = [f.replace('_', ' ') for f in fields[:-1]]
                last_field = fields[-1].replace('_', ' ')
                return f"Updated {', '.join(field_list)}, and {last_field}"

        # Single field update
        elif action == 'update_field' and response.get('target'):
            field_name = response['target'].replace('_', ' ')
            value_str = str(response.get('value', ''))
            value_preview = value_str[:30] + ('...' if len(value_str) > 30 else '')
            if value_preview:
                return f"Updated {field_name} to: {value_preview}"
            return f"Updated {field_name}"

        # Clarification needed
        elif action == 'clarify' or response.get('needs_clarification'):
            return response.get('clarification_question', 'Could you clarify?')

        # Execute action
        elif action == 'execute_action':
            target = response.get('target', 'action') or 'action'
            return f"Executing {str(target).replace('_', ' ')}"

        # Default
        else:
            return response.get('confirmation', 'Command processed')

    def _generate_tts_message(self, response: Dict[str, Any]) -> str:
        """
        Generate a concise Text-To-Speech message. Spoken confirmations should be brief and natural.
        """
        action = response.get('action', '')

        # Multi-field update
        if action == 'update_fields' and response.get('fieldUpdates'):
            field_count = len(response['fieldUpdates'])
            if field_count == 1:
                field_name = list(response['fieldUpdates'].keys())[0].replace('_', ' ')
                return f"Updated {field_name}"
            else:
                return f"Updated {field_count} fields"

        # Single field update
        elif action == 'update_field' and response.get('target'):
            field_name = response['target'].replace('_', ' ')
            return f"Updated {field_name}"

        # Clarification
        elif action == 'clarify' or response.get('needs_clarification'):
            return response.get('clarification_question', 'Could you clarify?')

        # Execute action
        elif action == 'execute_action':
            target = response.get('target', 'action') or 'action'
            return f"{str(target).replace('_', ' ').title()}"

        # Default
        else:
            return response.get('ttsText', '')
    
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
                visible_fields = screen_context.get('visibleFields', [])
        
                # Build field catalog with EXACT names for validation
                field_catalog: List[Dict[str, Any]] = []
                field_name_map: Dict[str, str] = {}  # Maps synonyms to canonical field names
        
                for field in visible_fields:
                        field_name = field.get('name', '')
                        field_label = field.get('label', '')
                        field_type = field.get('type', 'text')
                        current_value = field.get('currentValue', '')
                        synonyms = field.get('synonyms', []) or []
            
                        if field_name:
                                # Build comprehensive field description
                                field_entry = {
                                        'canonical_name': field_name,
                                        'label': field_label,
                                        'type': field_type,
                                        'current_value': current_value[:100] if current_value else 'empty',
                                        'synonyms': synonyms
                                }
                                field_catalog.append(field_entry)
                
                                # Build synonym mapping
                                field_name_map[field_name] = field_name
                                if field_label:
                                        field_name_map[field_label.lower()] = field_name
                                for syn in synonyms:
                                        if isinstance(syn, str):
                                                field_name_map[syn.lower()] = field_name
        
                # Format field catalog for prompt
                field_descriptions: List[str] = []
                for field_entry in field_catalog:
                        desc = f"""
Field: {field_entry['canonical_name']}
    - Label: {field_entry['label']}
    - Type: {field_entry['type']}
    - Current Value: {field_entry['current_value']}
    - Synonyms: {', '.join(field_entry['synonyms']) if field_entry['synonyms'] else 'none'}
"""
                        field_descriptions.append(desc)
        
                fields_section = '\n'.join(field_descriptions) if field_descriptions else "No fields available"
        
            # Create the comprehensive prompt
                prompt = f"""You are a precise field extraction AI for a field service closeout report system.

VOICE COMMAND: "{transcription}"

CURRENT SCREEN: summary (Closeout Summary - Multi-Field Editing)
MODE: edit (all fields are editable)

═══════════════════════════════════════════════════════════════════
AVAILABLE FIELDS (EXACT NAMES - USE THESE ONLY):
═══════════════════════════════════════════════════════════════════
{fields_section}

═══════════════════════════════════════════════════════════════════
CRITICAL RULES FOR MULTI-FIELD PARSING:
═══════════════════════════════════════════════════════════════════

1. **IDENTIFY ALL FIELD REFERENCES**
     - Scan the entire command for ANY mention of field names, labels, or synonyms
     - A command may reference 1, 2, 3, or more fields
     - Common patterns:
         * "Change X to Y and Z to W" = 2 fields
         * "Set delays to A, troubleshooting to B" = 2 fields
         * "Update field1, field2, and field3" = 3+ fields
   
2. **EXTRACT VALUES FOR EACH FIELD SEPARATELY**
     - Each field gets its OWN value
     - NEVER combine multiple field updates into one field
     - Use context clues (commas, "and", periods) to separate values
   
3. **FIELD NAME VALIDATION**
     - ONLY use canonical field names from the AVAILABLE FIELDS list above
     - If user says a synonym, map it to the canonical name
     - If a field name is unclear, use the closest match from the list
     - NEVER invent new field names

4. **RESPONSE FORMAT**
     - Return action: "update_fields" for multiple fields OR "update_field" for single field
     - Use "fieldUpdates" object with this exact structure:
   
     {{
         "action": "update_fields",
         "fieldUpdates": {{
             "canonical_field_name_1": "value for field 1",
             "canonical_field_name_2": "value for field 2"
         }},
         "target": "",
         "value": "",
         "confidence": 0.85,
         "confirmation": "Updated delays and troubleshooting_steps",
         "ttsText": "Updated delays and troubleshooting steps",
         "success": true,
         "needs_clarification": false
     }}

    ═══════════════════════════════════════════════════════════════════
    EMAIL AND NAVIGATION ACTIONS:
    ═══════════════════════════════════════════════════════════════════

    SEND EMAIL: "send email", "email report", "send the report"
         - action should be "execute_action"
         - target should be "send_email"
         - NO clarification needed - the system has default recipients configured
         - DO NOT ask who to send to
   
         CORRECT RESPONSE:
         {{
             "action": "execute_action",
             "target": "send_email",
             "value": "",
             "confidence": 0.95,
             "confirmation": "Sending closeout summary email",
             "ttsText": "Sending email",
             "success": true,
             "needs_clarification": false
         }}
   
         WRONG RESPONSE (DO NOT DO THIS):
         {{
             "action": "clarify",
             "clarification_question": "Who should I send to?"
         }}
         ❌ This is WRONG - just execute the send_email action directly!

    NAVIGATION: "go back", "return to previous screen"
         - action should be "navigate"
         - target should be the destination screen name

═══════════════════════════════════════════════════════════════════
PARSING EXAMPLES (STUDY THESE CAREFULLY):
═══════════════════════════════════════════════════════════════════

Example 1: COMPOUND COMMAND WITH TWO FIELDS
User says: "Change the delays to say that there were no delays, troubleshooting steps, we checked the network connection on the cable boxes"

PARSING LOGIC:
- Identify field 1: "delays" → canonical name: "delays"
- Extract value 1: "there were no delays" (everything after "to say that" until comma)
- Identify field 2: "troubleshooting steps" → canonical name: "troubleshooting_steps"
- Extract value 2: "we checked the network connection on the cable boxes" (after field 2 mention)

CORRECT RESPONSE:
{{
    "action": "update_fields",
    "fieldUpdates": {{
        "delays": "There were no delays",
        "troubleshooting_steps": "We checked the network connection on the cable boxes"
    }},
    "target": "",
    "value": "",
    "confidence": 0.90,
    "confirmation": "Updated delays and troubleshooting_steps",
    "ttsText": "Updated delays and troubleshooting steps",
    "success": true,
    "needs_clarification": false
}}

WRONG RESPONSE (DO NOT DO THIS):
{{
    "action": "update_fields",
    "fieldUpdates": {{
        "delays": "There were no delays. Troubleshooting steps: We checked the network connection on the cable boxes"
    }}
}}
❌ This is WRONG because it combined both field values into ONE field!

---

Example 2: THREE FIELDS WITH "AND" CONJUNCTION
User says: "Set the delays to none, work completed to installed new router, and scope completed to yes"

PARSING LOGIC:
- Field 1: "delays" → "none"
- Field 2: "work completed" → "installed new router"
- Field 3: "scope completed" → "yes"

CORRECT RESPONSE:
{{
    "action": "update_fields",
    "fieldUpdates": {{
        "delays": "None",
        "work_completed": "Installed new router",
        "scope_completed": "Yes"
    }},
    "confidence": 0.92,
    "confirmation": "Updated delays, work_completed, and scope_completed",
    "ttsText": "Updated three fields",
    "success": true
}}

---

Example 3: SINGLE FIELD UPDATE
User says: "Change the photos from 3 to 4"

PARSING LOGIC:
- Field: "photos" → canonical name: "photos_uploaded"
- Value: "4 photos"

CORRECT RESPONSE:
{{
    "action": "update_field",
    "target": "photos_uploaded",
    "value": "4 photos",
    "fieldUpdates": {{}},
    "confidence": 0.95,
    "confirmation": "Updated photos_uploaded to 4 photos",
    "ttsText": "Updated photos to 4",
    "success": true
}}

---

Example 4: AMBIGUOUS COMMAND REQUIRING CLARIFICATION
User says: "Update the contact and location"

PARSING LOGIC:
- Field mentions found but NO values provided
- Need clarification

CORRECT RESPONSE:
{{
    "action": "clarify",
    "needs_clarification": true,
    "clarification_question": "What should I set the contact and location to?",
    "ttsText": "What should I set the contact and location to?",
    "success": false
}}

═══════════════════════════════════════════════════════════════════
COMPOUND COMMAND PARSING ALGORITHM:
═══════════════════════════════════════════════════════════════════

STEP 1: Tokenize the command by conjunctions and punctuation
    - Split on: commas, "and", "also", semicolons
  
STEP 2: For each segment, identify:
    - Field reference (name/label/synonym)
    - Value assignment (after "to", "=", "as", ":")
  
STEP 3: Map synonyms to canonical field names using the field catalog

STEP 4: Validate that ALL field names exist in AVAILABLE FIELDS

STEP 5: Build fieldUpdates object with ONLY validated fields

STEP 6: Return proper action:
    - "update_fields" if fieldUpdates has 2+ entries
    - "update_field" if only 1 field
    - "clarify" if ambiguous

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════════

You MUST return ONLY valid JSON with this exact structure:

{{
    "action": "update_fields" | "update_field" | "clarify" | "execute_action" | "acknowledge",
    "fieldUpdates": {{ "field_name": "value" }},  // Required for multi-field
    "target": "field_name",  // Required for single field
    "value": "field_value",  // Required for single field
    "confidence": 0.0-1.0,
    "confirmation": "human-readable message",
    "ttsText": "spoken confirmation",
    "success": true | false,
    "needs_clarification": false,
    "clarification_question": ""
}}

CRITICAL: 
- NO markdown formatting
- NO code blocks
- NO explanatory text
- ONLY the JSON object
- Validate ALL field names against the AVAILABLE FIELDS list
- NEVER create new field names
- ALWAYS separate multiple field updates into distinct entries in fieldUpdates

Now process the voice command and return the appropriate JSON response."""

                return prompt
    
    def _validate_and_correct_field_names(self, field_updates: Dict[str, Any], screen_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate that all field names in fieldUpdates actually exist.
        Correct any synonym usage to canonical names.
        Filter out any hallucinated fields.
        """
        # DIAGNOSTIC LOG
        try:
            logger.info("🔍 VALIDATION: Starting field name validation")
            logger.info(f"🔍 VALIDATION: Input field_updates: {list((field_updates or {}).keys())}")
        except Exception:
            logger.info("🔍 VALIDATION: Input field_updates: <unavailable>")

        visible_fields = screen_context.get('visibleFields', [])
        try:
            logger.info(f"🔍 VALIDATION: Available visible_fields count: {len(visible_fields)}")
        except Exception:
            logger.info("🔍 VALIDATION: Available visible_fields count: <unknown>")

        # Build canonical field name lookup
        canonical_fields: Dict[str, str] = {}
        synonym_to_canonical: Dict[str, str] = {}

        for field in visible_fields:
            field_name = field.get('name', '')
            if not field_name:
                continue

            # Add canonical name
            canonical_fields[field_name.lower()] = field_name
            synonym_to_canonical[field_name.lower()] = field_name

            # Add label as synonym
            label = str(field.get('label', '') or '').lower()
            if label:
                synonym_to_canonical[label] = field_name

            # Add all explicit synonyms
            for syn in field.get('synonyms', []) or []:
                try:
                    synonym_to_canonical[str(syn).lower()] = field_name
                except Exception:
                    continue

        # Validate and correct field names
        corrected_updates: Dict[str, Any] = {}
        hallucinated_fields: List[str] = []
        corrected_fields: List[str] = []

        for field_name, value in (field_updates or {}).items():
            try:
                field_name_lower = str(field_name).lower().strip()
            except Exception:
                field_name_lower = ''

            # Try exact canonical match first
            if field_name_lower in canonical_fields:
                canonical_name = canonical_fields[field_name_lower]
                corrected_updates[canonical_name] = value
                if canonical_name != field_name:
                    corrected_fields.append(f"{field_name} → {canonical_name}")

            # Try synonym match
            elif field_name_lower in synonym_to_canonical:
                canonical_name = synonym_to_canonical[field_name_lower]
                corrected_updates[canonical_name] = value
                corrected_fields.append(f"{field_name} → {canonical_name}")

            # Try fuzzy match (partial string matching)
            else:
                matched = False
                for synonym, canonical in synonym_to_canonical.items():
                    # Check if the field name is contained in any synonym or vice versa
                    if field_name_lower and (field_name_lower in synonym or synonym in field_name_lower):
                        corrected_updates[canonical] = value
                        corrected_fields.append(f"{field_name} → {canonical} (fuzzy)")
                        matched = True
                        break

                if not matched:
                    # Field doesn't exist - this is a hallucination
                    hallucinated_fields.append(str(field_name))
                    logger.warning(f"⚠️ GPT hallucinated field: '{field_name}' - not in visibleFields. REJECTED.")

        # Log all corrections
        if corrected_fields:
            logger.info(f"✅ Corrected field names: {', '.join(corrected_fields)}")

        if hallucinated_fields:
            logger.error(f"❌ REJECTED hallucinated fields: {', '.join(hallucinated_fields)}")

        # DIAGNOSTIC LOG
        try:
            logger.info(f"🔍 VALIDATION: Output corrected_updates: {list(corrected_updates.keys())}")
        except Exception:
            logger.info("🔍 VALIDATION: Output corrected_updates: <unavailable>")
        logger.info("🔍 VALIDATION: Validation complete")

        return corrected_updates

    def _parse_gpt_response(self, response_text: str, screen_context: Dict[str, Any]) -> Dict[str, Any]:
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

            # Normalize bulk field updates from various GPT shapes into 'fieldUpdates' dict
            # Accepts:
            # - 'fields': [ { field: 'name', value: 'x' }, ... ]
            # - 'updates': [ { field/name/target: 'name', value: 'x' }, ... ]
            # - 'field_updates': { name: value, ... }
            # - 'field_updates': [ { target/name/field: 'name', value: 'x' }, ... ]  <-- newly supported
            if 'fieldUpdates' not in parsed:
                # 1) 'fields' array
                if 'fields' in parsed and isinstance(parsed['fields'], list):
                    updates = {}
                    for item in parsed['fields']:
                        try:
                            fname = item.get('field') or item.get('name') or item.get('target')
                            fval = item.get('value')
                            if fname:
                                updates[fname] = fval
                        except Exception:
                            continue
                    if updates:
                        parsed['fieldUpdates'] = updates
                        logger.info(f"Normalized 'fields' array into fieldUpdates: {list(updates.keys())}")
                        if not parsed.get('action'):
                            parsed['action'] = 'update_fields'

                # 2) 'updates' array (alternate key used by some prompts/models)
                elif 'updates' in parsed and isinstance(parsed['updates'], list):
                    updates = {}
                    for item in parsed['updates']:
                        try:
                            fname = None
                            if isinstance(item, dict):
                                fname = item.get('field') or item.get('name') or item.get('target')
                                fval = item.get('value')
                            else:
                                # If item is a simple string like 'field:value' attempt a split
                                parts = str(item).split(':', 1)
                                if len(parts) == 2:
                                    fname = parts[0].strip()
                                    fval = parts[1].strip()
                                else:
                                    continue
                            if fname:
                                updates[fname] = fval
                        except Exception:
                            continue
                    if updates:
                        parsed['fieldUpdates'] = updates
                        logger.info(f"Normalized 'updates' array into fieldUpdates: {list(updates.keys())}")
                        # Upgrade action if missing or just an acknowledge placeholder
                        if not parsed.get('action') or parsed.get('action') in ['acknowledge', '']:
                            parsed['action'] = 'update_fields' if len(updates) > 1 else 'update_field'
                            if len(updates) == 1:
                                only_field, only_val = next(iter(updates.items()))
                                parsed.setdefault('target', only_field)
                                parsed.setdefault('value', only_val)
                                parsed.setdefault('confirmation', f"Updated {only_field.replace('_',' ')}")

                # 3) 'field_updates' dict
                elif 'field_updates' in parsed and isinstance(parsed['field_updates'], dict):
                    parsed['fieldUpdates'] = parsed['field_updates']
                    logger.info("Mapped 'field_updates' dict to fieldUpdates")
                    if not parsed.get('action') or parsed.get('action') in ['acknowledge', '']:
                        parsed['action'] = 'update_fields' if len(parsed['field_updates']) > 1 else 'update_field'
                        if len(parsed['field_updates']) == 1:
                            only_field, only_val = next(iter(parsed['field_updates'].items()))
                            parsed.setdefault('target', only_field)
                            parsed.setdefault('value', only_val)
                            parsed.setdefault('confirmation', f"Updated {only_field.replace('_',' ')}")

                # 4) 'field_updates' list (common alternative the model returns)
                elif 'field_updates' in parsed and isinstance(parsed['field_updates'], list):
                    updates = {}
                    for item in parsed['field_updates']:
                        if not isinstance(item, dict):
                            continue
                        fname = item.get('field') or item.get('name') or item.get('target')
                        fval = item.get('value')
                        if fname:
                            updates[fname] = fval
                    if updates:
                        parsed['fieldUpdates'] = updates
                        logger.info(f"Normalized 'field_updates' list into fieldUpdates: {list(updates.keys())}")
                        if not parsed.get('action') or parsed.get('action') in ['acknowledge', '']:
                            parsed['action'] = 'update_fields' if len(updates) > 1 else 'update_field'
                            if len(updates) == 1:
                                only_field, only_val = next(iter(updates.items()))
                                parsed.setdefault('target', only_field)
                                parsed.setdefault('value', only_val)
                                parsed.setdefault('confirmation', f"Updated {only_field.replace('_',' ')}")

            # Final safeguard: if we still have 'acknowledge' but fieldUpdates exist, promote the action
            if parsed.get('fieldUpdates') and (parsed.get('action') in ['acknowledge', '', None]):
                updates = parsed['fieldUpdates']
                parsed['action'] = 'update_fields' if len(updates) > 1 else 'update_field'
                if len(updates) == 1 and (not parsed.get('target') or not parsed.get('value')):
                    only_field, only_val = next(iter(updates.items()))
                    parsed.setdefault('target', only_field)
                    parsed.setdefault('value', only_val)
                    parsed.setdefault('confirmation', f"Updated {only_field.replace('_',' ')}")

            # VALIDATE AND CORRECT FIELD NAMES
            if parsed.get('fieldUpdates'):
                try:
                    logger.info(f"🔍 Before validation: fieldUpdates = {list(parsed['fieldUpdates'].keys())}")
                except Exception:
                    logger.info("🔍 Before validation: fieldUpdates = <unavailable>")

                parsed['fieldUpdates'] = self._validate_and_correct_field_names(
                    parsed['fieldUpdates'],
                    screen_context
                )

                try:
                    logger.info(f"🔍 After validation: fieldUpdates = {list(parsed['fieldUpdates'].keys())}")
                except Exception:
                    logger.info("🔍 After validation: fieldUpdates = <unavailable>")

                # Update confirmation and action to reflect actual fields updated
                if parsed['fieldUpdates']:
                    field_names = list(parsed['fieldUpdates'].keys())
                    if len(field_names) > 1:
                        parsed['action'] = 'update_fields'
                        parsed['target'] = ''
                        parsed['value'] = ''
                        parsed['confirmation'] = f"Updated {', '.join(f.replace('_', ' ') for f in field_names)}"
                    else:
                        only_field, only_val = next(iter(parsed['fieldUpdates'].items()))
                        parsed['action'] = 'update_field'
                        parsed['target'] = only_field
                        # Only set value if not already specified
                        parsed['value'] = parsed.get('value') or only_val
                        parsed['confirmation'] = f"Updated {only_field.replace('_', ' ')}"
                else:
                    # All fields were invalid/hallucinated
                    logger.error("❌ No valid fields after validation - all were hallucinated")
                    return self._create_acknowledge_response("I couldn't identify any valid fields to update")

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
            # First attempt revert detection
            revert_attempt = self._attempt_revert(transcription, screen_context)
            if revert_attempt:
                return revert_attempt
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
                        # Special case: additive location modifications (append/add/at the end of location)
                        if field_name == 'location':
                            trans_l = transcription_lower
                            if any(kw in trans_l for kw in ['append', 'add ', 'at the end of location']):
                                # Retrieve current location to append
                                current_location = None
                                for f in screen_context.get('visibleFields', []):
                                    if f.get('name') == 'location':
                                        current_location = f.get('currentValue') or ''
                                        break
                                if current_location and current_location.lower() not in ['not mentioned', ''] and new_value.lower() not in current_location.lower():
                                    merged = current_location.rstrip() + (' ' if not current_location.endswith(' ') else '') + new_value.lstrip()
                                    logger.info(f"Fallback append to location. Prev='{current_location}' Add='{new_value}' -> New='{merged}'")
                                    return {
                                        "action": "update_field",
                                        "target": field_name,
                                        "value": merged,
                                        "confidence": 0.82,
                                        "confirmation": "Appended to location",
                                        "ttsText": "",
                                        "success": True,
                                        "needs_clarification": False
                                    }
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

        # Pattern 4: Email send intents (both screens) – ensure voice command can send even if GPT fails
        if any(phrase in transcription_lower for phrase in [
            'send email', 'send the email', 'email report', 'send the report', 'email the report',
            'email this', 'send closeout', 'send the closeout', 'email closeout', 'email the closeout'
        ]):
            return {
                "action": "execute_action",
                "target": "send_email",
                "value": "",
                "confidence": 0.95,
                "confirmation": "Sending closeout summary email",
                "ttsText": "Sending email",
                "success": True,
                "needs_clarification": False
            }
        
        # Default: acknowledge
        return self._create_acknowledge_response(transcription)

    def _attempt_revert(self, transcription: str, screen_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Attempt to build a revert response if the transcription requests a revert/undo."""
        t_lower = transcription.lower().strip()
        if not any(k in t_lower for k in ['revert', 'undo']):
            return None

        history = screen_context.get('history') or {}
        history_meta = screen_context.get('history_meta') or {}

        # Patterns capturing explicit field reference
        patterns = [
            r'(?:revert|undo)\s+(?:the\s+)?([a-z_ ]+?)\s*(?:field|change)?[?.!]*$',
            r'(?:can you|please)?\s*(?:revert|undo).*?(work order number|work order|location|onsite contact|support contact|materials used|expenses|photos uploaded)[?.!]*$',
        ]
        field_ref = None
        for pat in patterns:
            m = re.search(pat, t_lower)
            if m:
                grp = None
                # find last non-empty group
                for g in m.groups():
                    if g:
                        grp = g
                if grp:
                    grp = grp.strip()
                    if 'last change' not in grp:
                        field_ref = grp
                        break

        # Field synonym mapping
        synonym_map = {
            'work order': 'work_order',
            'work order number': 'work_order',
            'onsite contact': 'onsite_contact',
            'support contact': 'support_contact',
            'materials used': 'materials_used',
            'photos uploaded': 'photos_uploaded',
        }

        # Generic last change request
        if not field_ref or field_ref in ['change', 'last', 'last change', 'that change', 'that']:
            # choose most recent field with previous
            recent_field = None
            recent_ts = -1
            for fname, ts in history_meta.items():
                try:
                    if fname in history and history[fname].get('previous') and ts > recent_ts:
                        recent_field = fname
                        recent_ts = ts
                except Exception:
                    continue
            field_ref = recent_field

        if not field_ref:
            return {
                "action": "acknowledge",
                "target": "",
                "value": "",
                "confidence": 0.55,
                "confirmation": "Please specify which field to revert.",
                "ttsText": "Which field should I revert?",
                "success": False,
                "needs_clarification": True,
                "clarification_question": "Which field should I revert?"
            }

        # Normalize via synonym map
        raw_ref = field_ref.lower()
        mapped = synonym_map.get(raw_ref, raw_ref.replace(' ', '_'))
        mapped = self._match_field_name(mapped, screen_context) or mapped

        prior = None
        if mapped in history:
            prior = history[mapped].get('previous') or history[mapped].get('prior')

        if not prior:
            return {
                "action": "acknowledge",
                "target": mapped,
                "value": "",
                "confidence": 0.55,
                "confirmation": f"No earlier value stored for {mapped.replace('_',' ')}",
                "ttsText": f"I don't have a previous value for {mapped.replace('_',' ')}",
                "success": False,
                "needs_clarification": False
            }

        return {
            "action": "update_field",
            "target": mapped,
            "value": prior,
            "confidence": 0.85,
            "confirmation": f"Reverted {mapped.replace('_',' ')}",
            "ttsText": "Reverted",
            "success": True,
            "needs_clarification": False
        }
    
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