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
        
        # LOCATION extraction - FIXED to avoid "Site Delay"
        # (Removed) location/datetime extraction — not required by current workflow
        
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
        
        # RELEASE CODE - alphanumeric codes
        code_patterns = [
            r'(?:release\s+)?code[:\s]+([A-Z0-9]{3,})',
            r'(?:ticket|reference|confirmation)\s*#?\s*([A-Z0-9]{4,})',
        ]
        
        for pattern in code_patterns:
            match = re.search(pattern, transcription, re.IGNORECASE)
            if match:
                result['release_code'] = match.group(1)
                logger.info(f"Found release code: {result['release_code']}")
                break
        
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
2. troubleshooting_steps: List ONLY diagnostic and troubleshooting actions (tested, checked, tried different ports, etc.)
3. location: Extract the actual location/site name, NOT delays or other information
4. Keep each field distinct - do not mix content between fields

EXTRACT THESE FIELDS:

1. onsite_contact: Name of person met at site (just the name)
2. support_contact: Name of support/IT person (just the name)
3. work_completed: Tasks actually completed (e.g., "Installed new AP, configured settings, verified connectivity")
4. delays: Any delays and their causes
5. troubleshooting_steps: Diagnostic steps taken (e.g., "Tested cable, checked power, tried different port")
6. scope_completed: Was work finished? (Yes/No/Partially)
7. released_by: Who signed off
8. release_code: Any reference numbers
9. return_tracking: Shipping/tracking info
10. expenses: Money spent (parking, etc.)
11. materials_used: Parts/equipment used
12. out_of_scope_work: Extra work beyond original scope
13. work_order: Work order number if mentioned
16. photos_uploaded: Number of photos taken

Return ONLY this JSON (no markdown):
{{
  "onsite_contact": "value or Not mentioned",
  "support_contact": "value or Not mentioned",
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

            logger.info("Calling GPT for enhanced extraction...")
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise data extractor. Extract information exactly as requested. Keep work_completed separate from troubleshooting_steps."
                    },
                    {"role": "user", "content": prompt}
                ]
            )
            
            response_text = response.choices[0].message.content.strip()
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
            
            # Prefer patterns for structured data (more accurate for these)
            if field in ['release_code', 'photos_uploaded', 'expenses']:
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