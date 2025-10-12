# backend/services/summarization.py - FIXED VERSION FOR ACCURATE EXTRACTION
import logging
import json
import re
from typing import Dict, Any, Optional, List
from openai import OpenAI
from config import settings

logger = logging.getLogger(__name__)

class SummarizationService:
    """Service for generating structured closeout summaries with high accuracy"""
    
    def __init__(self, openai_client: OpenAI):
        """Initialize the summarization service"""
        self.client = openai_client
        logger.info("SummarizationService initialized - High Accuracy version")
    
    def generate_closeout_summary(self, transcription: str) -> Dict[str, Any]:
        """
        Generate structured closeout summary from transcription
        FIXED: Ensures accurate extraction of all fields
        """
        try:
            logger.info(f"Starting summary generation for transcription: {transcription[:100]}...")
            
            # Step 1: Pattern-based extraction for immediate results
            pattern_results = self._extract_with_patterns(transcription)
            logger.info(f"Pattern extraction found: {sum(1 for v in pattern_results.values() if v != 'Not mentioned')} fields")
            
            # Step 2: Comprehensive GPT-5 extraction with better prompting
            gpt_results = self._enhanced_gpt_extraction(transcription, pattern_results)
            
            # Step 3: Merge results (GPT takes precedence for complex fields)
            final_summary = self._merge_results(pattern_results, gpt_results)
            
            # Log final results
            populated = sum(1 for v in final_summary.values() if v != "Not mentioned")
            logger.info(f"Final extraction complete: {populated}/{len(final_summary)} fields populated")
            for field, value in final_summary.items():
                if value != "Not mentioned":
                    logger.info(f"  - {field}: {value[:50]}...")
            
            return final_summary
            
        except Exception as e:
            logger.error(f"Summary generation failed: {e}", exc_info=True)
            # Return pattern results as fallback
            if pattern_results:
                return pattern_results
            return self._get_empty_summary()
    
    def _extract_with_patterns(self, transcription: str) -> Dict[str, Any]:
        """Extract fields using regex patterns - very fast and accurate for structured data"""
        result = self._get_empty_summary()
        text_lower = transcription.lower()

        # LOCATION extraction (reintroduced & improved)
        # Heuristics: capture site/store/location names while avoiding delay phrases.
        # We try several targeted patterns and pick the first high-confidence match.
        location = None
        location_patterns = [
            # Explicit labels
            r'(?:location|site|store)\s*[:#-]\s*([A-Z0-9][A-Za-z0-9&@.\- ]{2,60})',
            r'(?:at|arrived at|on site at|onsite at)\s+([A-Z][A-Za-z0-9&@.\- ]{2,60})',
            # Store / site number alone
            r'(?:store|site)\s+#?(\d{3,8})',
        ]
        exclusion_substrings = {'delay', 'delayed', 'waiting', 'waited'}
        def _clean_location(raw: str) -> Optional[str]:
            if not raw:
                return None
            raw = raw.strip()
            # Stop at sentence/pause delimiters
            raw = re.split(r'[\.;\n]', raw)[0]
            # Trim trailing filler words
            raw = re.sub(r'\b(today|yesterday|tonight|this morning)\b.*$', '', raw, flags=re.IGNORECASE).strip()
            # Collapse multiple spaces
            raw = re.sub(r'\s{2,}', ' ', raw)
            # Exclude if contains exclusion terms
            lowered = raw.lower()
            if any(term in lowered for term in exclusion_substrings):
                return None
            # Avoid overly short / generic captures
            if len(raw) < 3:
                return None
            # Normalize store / site number capture
            if re.fullmatch(r'\d{3,8}', raw):
                raw = f"Store {raw}"  # Add label for clarity
            return raw.strip(' -:')
        for pattern in location_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                candidate = match.group(1)
                cleaned = _clean_location(candidate)
                if cleaned:
                    location = cleaned
                    logger.info(f"Found location (pattern): {location}")
                    break
        if location:
            result['location'] = location
        
        # ONSITE CONTACT - specific patterns
        contact_patterns = [
            r'contacts?:\s*([^,\n-]+(?:,\s*[^,\n-]+)?)',  # "Contacts: John Miller, Sarah Lopez"
            r'(?:met with|worked with|contact was)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\([^)]*(?:operations|manager|supervisor|contact)\)',
        ]
        
        for pattern in contact_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                contact = match.group(1).strip()
                # Extract first person if multiple listed
                if ',' in contact:
                    contact = contact.split(',')[0].strip()
                # Remove role descriptions in parentheses
                contact = re.sub(r'\s*\([^)]+\)', '', contact)
                result['onsite_contact'] = contact
                logger.info(f"Found onsite contact: {result['onsite_contact']}")
                break
        
        # SUPPORT CONTACT - look for IT/support/contractor mentions
        support_patterns = [
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\((?:IT|support|tech|contractor)\)',
            r'([A-Z][a-z]+)\s+(?:from|in)\s+(?:tech\s+)?support',
            r'(?:support from|helped by)\s+([A-Z][a-z]+)',
        ]
        
        for pattern in support_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                result['support_contact'] = match.group(1).strip()
                logger.info(f"Found support contact: {result['support_contact']}")
                break
        
        # DELAYS - specific delay mentions
        delay_patterns = [
            r'delay[:\s]+([^.\n]+)',
            r'waited?\s+(?:for\s+)?([^.\n]+)',
            r'(?:delayed by|held up by)\s+([^.\n]+)',
        ]
        
        for pattern in delay_patterns:
            match = re.search(pattern, text_lower)
            if match:
                result['delays'] = match.group(1).strip()
                logger.info(f"Found delays: {result['delays']}")
                break
        
        # RELEASE CODE - SKIP PATTERN MATCHING, LET GPT HANDLE IT
        # 
        # Why: Release codes have too many formats and are embedded in natural language.
        # Pattern matching struggles with:
        # - Variable formats (MC-2024-1587, 1927393, WM-AUTH-9847, etc.)
        # - Filler words ("he gave me was 1927393")
        # - Ambiguous boundaries
        # 
        # GPT extraction handles these cases much better with context understanding.
        # Pattern matching is skipped for this field - GPT-only extraction.

        logger.debug("Skipping pattern matching for release_code - relying on GPT extraction")

        # Don't set result['release_code'] here - let GPT handle it entirely
        # The merge logic will use GPT's result
        
        # PHOTOS
        photo_patterns = [
            r'photos?\s+uploaded\s*\(?(\d+)\)?',
            r'(\d+)\s+photos?\s+(?:taken|uploaded|captured)',
            r'uploaded\s+\(?(\d+)\)?\s+photos?',
        ]
        
        for pattern in photo_patterns:
            match = re.search(pattern, text_lower)
            if match:
                num_photos = match.group(1)
                result['photos_uploaded'] = f"{num_photos} photos"
                logger.info(f"Found photos: {result['photos_uploaded']}")
                break
        
        # EXPENSES
        expense_patterns = [
            r'expenses?:\s*([^.\n]+)',
            r'(?:parking|gas|meals?|tolls?)[\s:]+\$?(\d+(?:\.\d{2})?)',
            r'no\s+(?:expenses?|parking|tolls)',
        ]
        
        for pattern in expense_patterns:
            match = re.search(pattern, text_lower)
            if match:
                if 'no expense' in match.group(0).lower() or 'none' in match.group(0).lower():
                    result['expenses'] = "None"
                else:
                    result['expenses'] = match.group(0).strip()
                logger.info(f"Found expenses: {result['expenses']}")
                break
        
        # MATERIALS USED
        materials_patterns = [
            r'materials?\s+used:\s*([^.\n]+)',
            r'used:\s*(\d+x?\s+[^.\n,]+(?:,\s*\d+x?\s+[^.\n,]+)*)',
            r'installed\s+(?:new\s+)?(\w+\s+\w+\s+(?:AP|switch|cable|router))',
        ]
        
        for pattern in materials_patterns:
            match = re.search(pattern, text_lower)
            if match:
                result['materials_used'] = match.group(1).strip()
                logger.info(f"Found materials: {result['materials_used']}")
                break
        
        # SCOPE COMPLETED
        if 'job complete' in text_lower or 'work complete' in text_lower or 'network restored' in text_lower:
            result['scope_completed'] = "Yes"
        elif 'not complete' in text_lower or 'incomplete' in text_lower:
            result['scope_completed'] = "No"
        elif 'partial' in text_lower:
            result['scope_completed'] = "Partially"
        
        return result
    
    def _enhanced_gpt_extraction(self, transcription: str, pattern_hints: Dict[str, Any]) -> Dict[str, Any]:
        """Enhanced GPT extraction with better prompting and field separation"""
        try:
            prompt = f"""Extract field service information from this transcription. Be accurate and specific.

TRANSCRIPTION:
"{transcription}"

IMPORTANT RULES:
1. work_completed: List ONLY the actual work performed (installed, configured, verified, etc.). Do NOT include troubleshooting or diagnostic steps.
2. troubleshooting_steps: List ONLY diagnostic and troubleshooting actions (tested, checked, tried different ports, etc.).
3. location: Extract ONLY the actual site/location name (store, facility, company site). Do NOT include delay phrases or time info.
4. Keep each field distinct - do not mix content between fields.
5. If a field is not clearly stated, return "Not mentioned" exactly.

EXTRACT THESE FIELDS:

1. onsite_contact: Name of person met at site (just the name)
2. support_contact: Name of support/IT person (just the name)
3. location: Actual site / store / facility name
4. work_completed: Tasks actually completed (e.g., "Installed new AP, configured settings, verified connectivity")
5. delays: Any delays and their causes
6. troubleshooting_steps: Diagnostic steps taken (e.g., "Tested cable, checked power, tried different port")
7. scope_completed: Was work finished? (Yes/No/Partially)
8. released_by: Who signed off
9. release_code: Authorization, confirmation, or reference code/number
   
    \u26a0\ufe0f CRITICAL - EXTRACTION RULES (Read Carefully):
   
    WHAT TO LOOK FOR:
    - Phrases like: "confirmation code", "release code", "authorization code", "gave me [CODE]"
    - The code is typically mentioned AFTER these trigger phrases
    - May be just a number, or letters-numbers-hyphens combination
   
    WHAT TO EXTRACT:
    - Extract ONLY the actual code value (the alphanumeric identifier)
    - DO NOT include trigger words like: "code", "was", "is", "gave", "me", "the"
    - DO NOT include English filler words: "he", "she", "and", "or"
   
    EXTRACTION EXAMPLES (Learn from these):
   
    Example 1:
    Input: "he gave me was 1927393"
    Correct extraction: "1927393"
    Wrong extraction: "was-1927393" \u274c (don't include "was")
   
    Example 2:
    Input: "confirmation code was MC-2024-1587"
    Correct extraction: "MC-2024-1587"
    Wrong extraction: "code-was-MC-2024-1587" \u274c (don't include "code" or "was")
   
    Example 3:
    Input: "released by Robert Chen and the confirmation code he gave me was MC-2024-1587"
    Correct extraction: "MC-2024-1587"
    Wrong extraction: "he-gave-me-was-MC-2024-1587" \u274c (don't include context)
   
    Example 4:
    Input: "authorization OG-2024-CH-17"
    Correct extraction: "OG-2024-CH-17"
   
    Example 5:
    Input: "ticket number E-04721"
    Correct extraction: "E-04721"
   
    Example 6:
    Input: "gave me code alpha seven niner two three"
    Correct extraction: "ALPHA-7923" or "alpha seven niner two three"
   
    VALIDATION:
    - Must be at least 3 characters long
    - Should contain at least one number OR be 4+ uppercase letters
    - May contain hyphens, letters, and numbers
    - Should NOT be a common English word
   
    COMMON FORMATS YOU'LL SEE:
    - All numbers: "1927393", "123456"
    - Letter-number: "E-04721", "MC-2024-1587"
    - Complex: "WM-AUTH-9847", "OG-2024-CH-17"
    - Alphanumeric: "AUTH9847", "MC20241587"
10. return_tracking: Shipping/tracking info
11. expenses: Money spent (parking, etc.)
12. materials_used: Parts/equipment used
13. out_of_scope_work: Extra work beyond original scope
14. work_order: Work order number if mentioned
15. photos_uploaded: Number of photos taken

Return ONLY this JSON (no markdown):
{{
  "onsite_contact": "value or Not mentioned",
  "support_contact": "value or Not mentioned",
    "location": "value or Not mentioned",
  "work_completed": "value or Not mentioned",
  "delays": "value or Not mentioned",
  "troubleshooting_steps": "value or Not mentioned",
  "scope_completed": "Yes/No/Partially or Not mentioned",
  "released_by": "value or Not mentioned",
  "release_code": "value or Not mentioned",
  "return_tracking": "value or Not mentioned",
  "expenses": "value or Not mentioned",
  "materials_used": "value or Not mentioned",
  "out_of_scope_work": "value or Not mentioned",
    "work_order": "value or Not mentioned",
  "photos_uploaded": "value or Not mentioned"
}}"""

            logger.info("Calling GPT for enhanced extraction with fallback and JSON response...")
            messages = [
                {
                    "role": "system",
                    "content": "You are a precise data extractor. Extract information exactly as requested. Keep work_completed separate from troubleshooting_steps."
                },
                {"role": "user", "content": prompt}
            ]

            # Preferred models in order: gpt-5 (or env-specified), then gpt-4o as fallback
            preferred_models: List[str] = []
            # If user configured a model explicitly, try it first
            if getattr(settings, 'gpt_model', None):
                preferred_models.append(settings.gpt_model)
            # Ensure gpt-5 is attempted
            if 'gpt-5' not in preferred_models:
                preferred_models.append('gpt-5')
            # Add 4o as fallback
            if 'gpt-4o' not in preferred_models:
                preferred_models.append('gpt-4o')

            last_err: Optional[Exception] = None
            response_text: Optional[str] = None
            for model_name in preferred_models:
                try:
                    logger.info(f"🔁 Trying model: {model_name}")
                    # Some models (e.g., gpt-5) do not support overriding temperature. Omit it for those.
                    create_kwargs = {
                        "model": model_name,
                        "messages": messages,
                        "response_format": {"type": "json_object"},
                    }
                    # Include temperature only when supported (avoid for gpt-5 family)
                    if not str(model_name).lower().startswith("gpt-5"):
                        create_kwargs["temperature"] = getattr(settings, 'gpt_temperature', 0.3)

                    completion = self.client.chat.completions.create(**create_kwargs)
                    candidate = (completion.choices[0].message.content or '').strip()
                    # Basic sanity check: must look like JSON
                    if not candidate:
                        raise ValueError("Empty completion content")
                    response_text = candidate
                    logger.info(f"✅ Model {model_name} produced {len(response_text)} chars")
                    break
                except Exception as e:
                    last_err = e
                    logger.warning(f"Model {model_name} failed, will try next if available: {e}")

            if response_text is None:
                raise last_err or RuntimeError("All model attempts failed")
            logger.info(f"GPT response length: {len(response_text)}")
            
            # Parse response
            return self._parse_gpt_response(response_text)
            
        except Exception as e:
            logger.error(f"GPT extraction failed: {e}")
            return self._get_empty_summary()
    
    def _parse_gpt_response(self, text: str) -> Dict[str, Any]:
        """Parse GPT response robustly"""
        try:
            # Remove markdown
            text = re.sub(r'```(?:json)?\s*(.*?)\s*```', r'\1', text, flags=re.DOTALL)
            
            # Find JSON object
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
            if json_match:
                text = json_match.group(0)
            
            # Parse JSON
            parsed = json.loads(text)
            
            # Ensure all fields exist
            result = self._get_empty_summary()
            for field, value in parsed.items():
                if value and str(value).strip() and str(value).strip().lower() not in ['null', 'none', '']:
                    result[field] = str(value).strip()
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to parse GPT response: {e}")
            return self._get_empty_summary()
    
    def _merge_results(self, pattern_results: Dict[str, Any], gpt_results: Dict[str, Any]) -> Dict[str, Any]:
        """Merge pattern and GPT results intelligently"""
        final = self._get_empty_summary()
        
        # For each field, prefer non-empty values with smart merging
        for field in final.keys():
            gpt_val = gpt_results.get(field, "Not mentioned")
            pattern_val = pattern_results.get(field, "Not mentioned")

            # RELEASE_CODE: Always use GPT (no pattern matching)
            if field == 'release_code':
                final[field] = gpt_val
                logger.info(f"Using GPT-only extraction for release_code: {gpt_val}")
                continue

            # Prefer patterns for structured data (photos, expenses, work_order)
            if field in ['photos_uploaded', 'expenses', 'work_order']:
                if pattern_val != "Not mentioned":
                    final[field] = pattern_val
                elif gpt_val != "Not mentioned":
                    final[field] = gpt_val

            # Prefer GPT for complex narrative fields
            elif field in ['work_completed', 'troubleshooting_steps', 'delays', 'out_of_scope_work']:
                if gpt_val != "Not mentioned":
                    final[field] = gpt_val
                elif pattern_val != "Not mentioned":
                    final[field] = pattern_val

            # For names and other fields, prefer GPT but check both
            else:
                if gpt_val != "Not mentioned":
                    final[field] = gpt_val
                elif pattern_val != "Not mentioned":
                    final[field] = pattern_val
        
        return final
    
    def _get_empty_summary(self) -> Dict[str, Any]:
        """Return empty summary structure"""
        return {
            "onsite_contact": "Not mentioned",
            "support_contact": "Not mentioned",
            "location": "Not mentioned",
            "work_completed": "Not mentioned",
            "delays": "Not mentioned",
            "troubleshooting_steps": "Not mentioned",
            "scope_completed": "Not mentioned",
            "released_by": "Not mentioned",
            "release_code": "Not mentioned",
            "return_tracking": "Not mentioned",
            "expenses": "Not mentioned",
            "materials_used": "Not mentioned",
            "out_of_scope_work": "Not mentioned",
            "work_order": "Not mentioned",
            "photos_uploaded": "Not mentioned"
        }