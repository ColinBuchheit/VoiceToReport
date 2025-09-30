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
            logger.info(f"Final extraction complete: {populated}/16 fields populated")
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
        
        # DATETIME extraction - multiple patterns
        datetime_patterns = [
            r'(?:at|on|completed at)\s+(\d{1,2}:\d{2}\s*[ap]\.?m\.?)',  # times
            r'(?:at|on)\s+(\d{1,2}:\d{2})',  # 24hr times
            r'(today|yesterday|this morning|this afternoon)',  # relative times
            r'(\d{1,2}/\d{1,2}/\d{2,4})',  # dates
            r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}',  # month day
        ]
        for pattern in datetime_patterns:
            match = re.search(pattern, text_lower)
            if match:
                result['datetime'] = match.group(1)
                logger.info(f"Found datetime: {result['datetime']}")
                break
        
        # LOCATION extraction - look for building/facility names
        location_patterns = [
            r'at\s+([A-Z][A-Za-z\s]+(?:manufacturing|building|facility|office|center|plant|factory|site))',
            r'(?:location|site|facility|building)(?:\s+was)?\s+([A-Za-z0-9\s,]+)',
            r'at\s+([A-Z][A-Za-z\s]+),?\s+building\s+(\w+)',
            r'(?:went to|arrived at|at)\s+([A-Z][A-Za-z\s]+)',
        ]
        for pattern in location_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                location = match.group(0).replace('at ', '').strip()
                result['location'] = location
                logger.info(f"Found location: {result['location']}")
                break
        
        # TECHNICIAN NAME - from introduction
        name_patterns = [
            r'(?:my name is|i\'m|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
            r'^([A-Z][a-z]+)\s+here',
            r'technician\s+([A-Z][a-z]+)',
        ]
        for pattern in name_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                result['technician_name'] = match.group(1).strip()
                logger.info(f"Found technician: {result['technician_name']}")
                break
        
        # ONSITE CONTACT
        contact_patterns = [
            r'(?:met with|worked with|spoke to|contact was|customer was)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
            r'([A-Z][a-z]+)\s+(?:was|is)\s+(?:my|the)\s+(?:contact|customer|client)',
            r'onsite contact\s+(?:was|is)?\s*([A-Z][a-z]+)',
        ]
        for pattern in contact_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                result['onsite_contact'] = match.group(1).strip()
                logger.info(f"Found onsite contact: {result['onsite_contact']}")
                break
        
        # SUPPORT CONTACT
        support_patterns = [
            r'([A-Z][a-z]+)\s+(?:from|in)\s+(?:tech\s+)?support',
            r'(?:called|spoke to)\s+([A-Z][a-z]+)\s+(?:for support|for help)',
            r'support from\s+([A-Z][a-z]+)',
        ]
        for pattern in support_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                result['support_contact'] = match.group(1).strip()
                logger.info(f"Found support contact: {result['support_contact']}")
                break
        
        # WORK COMPLETED - extract action items
        work_verbs = ['replaced', 'installed', 'fixed', 'repaired', 'configured', 
                     'tested', 'completed', 'upgraded', 'removed', 'checked']
        work_items = []
        for verb in work_verbs:
            pattern = rf'{verb}\s+(?:the\s+)?([^.,;]+)'
            matches = re.findall(pattern, text_lower)
            for match in matches:
                # Clean up the match
                item = f"{verb} {match.strip()}"
                if len(item) < 100:  # Avoid capturing too much
                    work_items.append(item)
        
        if work_items:
            result['work_completed'] = '; '.join(work_items[:10])  # Limit to 10 items
            logger.info(f"Found work items: {len(work_items)}")
        
        # RELEASE CODE - alphanumeric codes
        code_patterns = [
            r'(?:code|ticket|number|reference)\s*#?\s*(?:is|was)?\s*([A-Z0-9]{4,})',
            r'([A-Z0-9]{6,})\b',  # Any 6+ char alphanumeric
        ]
        for pattern in code_patterns:
            match = re.search(pattern, transcription)
            if match:
                result['release_code'] = match.group(1)
                logger.info(f"Found code: {result['release_code']}")
                break
        
        # EXPENSES
        expense_patterns = [
            r'\$(\d+(?:\.\d{2})?)\s*(?:for\s+)?([a-z\s]+)',
            r'(?:parking|gas|meals?|tolls?)\s*(?:was|cost)?\s*\$?(\d+(?:\.\d{2})?)',
        ]
        for pattern in expense_patterns:
            match = re.search(pattern, text_lower)
            if match:
                result['expenses'] = match.group(0).strip()
                logger.info(f"Found expenses: {result['expenses']}")
                break
        
        # PHOTOS
        photo_patterns = [
            r'(\d+)\s*(?:photos?|pictures?|images?)',
            r'took\s+(?:photos?|pictures?)',
            r'uploaded\s+(\d+)\s*(?:photos?|pictures?)',
        ]
        for pattern in photo_patterns:
            match = re.search(pattern, text_lower)
            if match:
                if match.group(1) if match.groups() else "Yes":
                    result['photos_uploaded'] = f"{match.group(1)} photos" if match.group(1) else "Yes"
                logger.info(f"Found photos: {result['photos_uploaded']}")
                break
        
        # SCOPE COMPLETED
        if 'complet' in text_lower:
            if 'not complet' in text_lower or 'incomplete' in text_lower:
                result['scope_completed'] = "No"
            elif 'partially' in text_lower or 'partial' in text_lower:
                result['scope_completed'] = "Partially"
            elif 'completed' in text_lower or 'complete' in text_lower:
                result['scope_completed'] = "Yes"
        
        return result
    
    def _enhanced_gpt_extraction(self, transcription: str, pattern_hints: Dict[str, Any]) -> Dict[str, Any]:
        """Enhanced GPT extraction with better prompting and examples"""
        try:
            # Count what we already found
            found_fields = [k for k, v in pattern_hints.items() if v != "Not mentioned"]
            
            # Build a focused prompt
            prompt = f"""Extract ALL field service information from this transcription. Be thorough and accurate.

TRANSCRIPTION:
"{transcription}"

ALREADY IDENTIFIED (verify these):
{chr(10).join(f'- {field}: {value}' for field, value in pattern_hints.items() if value != "Not mentioned")}

EXTRACT ALL THESE FIELDS:

1. onsite_contact: Person met at job site (e.g., "met with John" → "John")
2. support_contact: Remote/phone support person (e.g., "Sarah from support" → "Sarah")  
3. work_completed: ALL tasks performed (be comprehensive, list everything done)
4. delays: Any delays mentioned and causes
5. troubleshooting_steps: Diagnostic steps taken
6. scope_completed: Was work finished? (Yes/No/Partially)
7. released_by: Who approved/signed off
8. release_code: Any codes/ticket numbers
9. return_tracking: Shipping/tracking numbers
10. expenses: Money spent (parking, gas, etc)
11. materials_used: Parts/materials used
12. out_of_scope_work: Extra work performed
13. location: Where work was done (building, address)
14. datetime: When work was done (time, date)
15. technician_name: Person speaking/technician name
16. photos_uploaded: Photos taken/uploaded

IMPORTANT:
- Extract EVERYTHING mentioned, don't summarize
- For location, include full details (e.g., "Westfield Manufacturing, building three")
- For datetime, include all time references (e.g., "2:45 p.m.")
- For work_completed, list ALL tasks mentioned

Return ONLY this JSON (no markdown):
{{
  "onsite_contact": "value or Not mentioned",
  "support_contact": "value or Not mentioned",
  "work_completed": "value or Not mentioned",
  "delays": "value or Not mentioned",
  "troubleshooting_steps": "value or Not mentioned",
  "scope_completed": "value or Not mentioned",
  "released_by": "value or Not mentioned",
  "release_code": "value or Not mentioned",
  "return_tracking": "value or Not mentioned",
  "expenses": "value or Not mentioned",
  "materials_used": "value or Not mentioned",
  "out_of_scope_work": "value or Not mentioned",
  "location": "value or Not mentioned",
  "datetime": "value or Not mentioned",
  "technician_name": "value or Not mentioned",
  "photos_uploaded": "value or Not mentioned"
}}"""

            logger.info("Calling GPT-5 for enhanced extraction...")
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise data extractor. Extract ALL information mentioned in the transcription. Be comprehensive and accurate. Never summarize or shorten the extracted data."
                    },
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"GPT-5 response length: {len(response_text)}")
            
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
            # Try manual extraction
            result = self._get_empty_summary()
            
            for field in result.keys():
                patterns = [
                    rf'"{field}"\s*:\s*"([^"]*)"',
                    rf'{field}:\s*"([^"]*)"',
                    rf'{field}:\s*([^,\n}}]+)',
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        value = match.group(1).strip().strip('"').strip("'")
                        if value and value.lower() != 'not mentioned':
                            result[field] = value
                            break
            
            return result
    
    def _merge_results(self, pattern_results: Dict[str, Any], gpt_results: Dict[str, Any]) -> Dict[str, Any]:
        """Merge pattern and GPT results intelligently"""
        final = self._get_empty_summary()
        
        # For each field, prefer non-empty values
        for field in final.keys():
            gpt_val = gpt_results.get(field, "Not mentioned")
            pattern_val = pattern_results.get(field, "Not mentioned")
            
            # Prefer GPT for complex fields
            if field in ['work_completed', 'troubleshooting_steps', 'delays', 'out_of_scope_work']:
                if gpt_val != "Not mentioned":
                    final[field] = gpt_val
                elif pattern_val != "Not mentioned":
                    final[field] = pattern_val
            # Prefer patterns for structured data
            elif field in ['datetime', 'location', 'release_code', 'expenses']:
                if pattern_val != "Not mentioned":
                    final[field] = pattern_val
                elif gpt_val != "Not mentioned":
                    final[field] = gpt_val
            # For names, check both
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
            "location": "Not mentioned",
            "datetime": "Not mentioned",
            "technician_name": "Not mentioned",
            "photos_uploaded": "Not mentioned"
        }