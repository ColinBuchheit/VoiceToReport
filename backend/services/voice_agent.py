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
            validated = self._validate_response_structure(parsed_response)

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

2. TEXT REPLACEMENT IN TRANSCRIPTION FIELD ONLY:
   Only use text replacement if:
   - The user explicitly mentions "transcription" or "transcript"
   - OR the text to replace is found in the transcription field content
   
3. EMAIL ACTION: "send email", "email report"
   - action should be "execute_action"
   - target should be "send_email"

DISAMBIGUATION RULES:

Common field update patterns:

Respond ONLY with valid JSON, no markdown formatting:"""
        
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