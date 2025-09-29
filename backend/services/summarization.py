# backend/services/summarization.py - COMPLETE FILE WITH GPT-5 FIX
import logging
import json
from typing import Dict, Any
from openai import OpenAI
from config import settings

logger = logging.getLogger(__name__)

class SummarizationService:
    """Service for generating structured closeout summaries from transcriptions"""
    
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
    
    def generate_closeout_summary(self, transcription: str) -> Dict[str, Any]:
        """
        Generate structured closeout summary from transcription
        
        Args:
            transcription: Raw voice transcription text
            
        Returns:
            Dictionary with closeout report fields
        """
        try:
            logger.info("Generating closeout summary from transcription")
            logger.info(f"Transcription length: {len(transcription)} characters")
            
            # Create detailed prompt for field extraction
            prompt = self._build_extraction_prompt(transcription)
            
            # Get GPT response - FIXED for GPT-5
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at extracting structured information from field service reports. Extract the requested information accurately and format it as valid JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                max_completion_tokens=settings.gpt_max_tokens,  # FIXED: Changed from max_tokens for GPT-5
                temperature=0.1  # Low temperature for consistent extraction
            )
            
            # Parse the response
            summary_text = response.choices[0].message.content.strip()
            logger.info("GPT summary generation completed")
            
            # Extract JSON from response
            summary = self._parse_summary_response(summary_text)
            
            # Log extraction results
            populated_fields = sum(1 for v in summary.values() if v and v != "Not mentioned" and v != "")
            logger.info(f"Summary extraction completed: {populated_fields}/16 fields populated")
            
            return summary
            
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            # Return empty structure on failure
            return self._get_empty_summary()
    
    def _build_extraction_prompt(self, transcription: str) -> str:
        """Build detailed prompt for extracting closeout information"""
        
        prompt = f"""Extract field service closeout information from this transcription. Be thorough and look for this information throughout the entire transcription:

TRANSCRIPTION:
"{transcription}"

TASK: Extract the following closeout report fields:

CLOSEOUT NOTES:
- onsite_contact: Who did the technician meet with on-site? (names, titles, roles)
- support_contact: Who provided support? (remote support person, help desk, colleague)
- work_completed: What specific work was done? (tasks, repairs, installations, troubleshooting)
- delays: Were there any delays mentioned? (traffic, waiting for parts, access issues)
- troubleshooting_steps: What troubleshooting or diagnostic steps were taken?
- scope_completed: Was the work scope completed successfully? (yes/no/partial with details)
- released_by: Who released/dismissed the technician? (name or title)
- release_code: Any release or completion code mentioned?
- return_tracking: Any return tracking numbers for parts/equipment?

EXPENSES:
- expenses: Any expenses mentioned? (parking, tolls, materials purchased)
- materials_used: What materials/parts were used?

OUT OF SCOPE:
- out_of_scope_work: Any additional work outside the original scope?

PHOTOS:
- photos_uploaded: How many photos were taken/uploaded?

ADDITIONAL:
- location: Where was the work performed? (address, building, site name)
- datetime: When was the work performed? (date/time if mentioned)
- technician_name: Name of the technician (if mentioned)

EXTRACTION RULES:
1. Look for this information ANYWHERE in the transcription, not just in order
2. Extract names, specific details, and numbers where mentioned
3. Use "Not mentioned" ONLY if the information is truly not present
4. Be flexible with phrasing (e.g., "met with John" = onsite_contact: "John")
5. Extract partial information rather than marking as "Not mentioned"

EXAMPLES OF GOOD EXTRACTION:
- "I worked with Sarah from IT" → support_contact: "Sarah from IT"
- "Met with the front desk manager Mark" → onsite_contact: "Mark (front desk manager)"
- "Replaced the faulty switch" → work_completed: "Replaced faulty switch"
- "No issues, everything went smoothly" → delays: "None"

Return ONLY a JSON object with the exact field names above:

{{
  "onsite_contact": "extracted value or Not mentioned",
  "support_contact": "extracted value or Not mentioned", 
  "work_completed": "extracted value or Not mentioned",
  "delays": "extracted value or Not mentioned",
  "troubleshooting_steps": "extracted value or Not mentioned",
  "scope_completed": "extracted value or Not mentioned",
  "released_by": "extracted value or Not mentioned",
  "release_code": "extracted value or Not mentioned",
  "return_tracking": "extracted value or Not mentioned",
  "expenses": "extracted value or Not mentioned",
  "materials_used": "extracted value or Not mentioned",
  "out_of_scope_work": "extracted value or Not mentioned",
  "photos_uploaded": "extracted value or Not mentioned",
  "location": "extracted value or Not mentioned",
  "datetime": "extracted value or Not mentioned",
  "technician_name": "extracted value or Not mentioned"
}}"""
        
        return prompt
    
    def _parse_summary_response(self, response_text: str) -> Dict[str, Any]:
        """Parse and validate the GPT summary response"""
        try:
            # Extract JSON from response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.warning("No JSON found in summary response, using fallback parsing")
                return self._fallback_parse(response_text)
            
            json_text = response_text[start_idx:end_idx]
            summary = json.loads(json_text)
            
            # Validate and fill in missing fields
            required_fields = [
                'onsite_contact', 'support_contact', 'work_completed', 'delays',
                'troubleshooting_steps', 'scope_completed', 'released_by', 'release_code',
                'return_tracking', 'expenses', 'materials_used', 'out_of_scope_work',
                'photos_uploaded', 'location', 'datetime', 'technician_name'
            ]
            
            for field in required_fields:
                if field not in summary:
                    summary[field] = "Not mentioned"
            
            return summary
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parsing failed: {e}")
            return self._fallback_parse(response_text)
    
    def _fallback_parse(self, response_text: str) -> Dict[str, Any]:
        """Fallback parsing using keyword extraction"""
        logger.info("Using fallback keyword extraction")
        
        summary = self._get_empty_summary()
        text_lower = response_text.lower()
        
        # Simple keyword-based extraction patterns
        patterns = {
            'onsite_contact': ['met with', 'on-site contact', 'onsite contact', 'greeted by'],
            'support_contact': ['support', 'help desk', 'it support', 'technical support', 'worked with'],
            'work_completed': ['replaced', 'fixed', 'repaired', 'installed', 'completed', 'work done'],
            'location': ['location', 'site', 'building', 'office', 'address'],
            'technician_name': ['i am', 'my name is', 'this is', 'technician']
        }
        
        for field, keywords in patterns.items():
            for keyword in keywords:
                if keyword in text_lower:
                    # Try to extract surrounding context
                    idx = text_lower.find(keyword)
                    if idx != -1:
                        # Get surrounding words for context
                        start = max(0, idx - 50)
                        end = min(len(response_text), idx + 100)
                        context = response_text[start:end].strip()
                        summary[field] = context
                        break
        
        return summary
    
    def _get_empty_summary(self) -> Dict[str, Any]:
        """Get empty summary structure with all required fields"""
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
            "photos_uploaded": "Not mentioned",
            "location": "Not mentioned",
            "datetime": "Not mentioned",
            "technician_name": "Not mentioned"
        }