# backend/services/summarization.py - COMPLETE FIXED FILE FOR GPT-5
import logging
import json
import re
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
        """Build detailed prompt for extracting closeout information with better field mapping"""
        
        prompt = f"""Extract field service closeout information from this voice transcription. The person is describing work they completed.

TRANSCRIPTION:
"{transcription}"

Your task is to extract ALL of the following information. Look for natural language patterns and contextual clues. If something is not explicitly mentioned, use "Not mentioned".

CLOSEOUT NOTES TO EXTRACT:

1. **onsite_contact**: Name of person met on-site
   - Look for: "met with", "on-site contact", "spoke to", "worked with", "customer was", "client"
   - Example: "I met with John" → "John"

2. **support_contact**: Support person/company worked with remotely
   - Look for: "support", "helped by", "assisted by", "called", "remote support", "tech support"
   - Example: "Sarah from tech support helped me" → "Sarah from tech support"

3. **work_completed**: Detailed description of all work done
   - Look for: "installed", "configured", "fixed", "replaced", "updated", "completed", "did", "performed"
   - Include ALL technical work mentioned

4. **delays**: Any delays mentioned
   - Look for: "delayed", "waited", "held up", "postponed", "late", "behind schedule"
   - If they say "no delays" or "on time", put "No delays"

5. **troubleshooting_steps**: Any debugging, testing, or problem-solving steps
   - Look for: "tested", "debugged", "troubleshot", "diagnosed", "checked", "verified", "tried"
   - Include all technical troubleshooting mentioned

6. **scope_completed**: Was the scope/job completed successfully?
   - Look for: "completed", "finished", "done", "successful", "working", "resolved"
   - Answer with "Yes - [details]" or "No - [reason]"

7. **released_by**: Who released/signed off
   - Look for: "released by", "signed off", "approved by", "let me go", "said I could leave"
   - Example: "Bob released me" → "Bob"

8. **release_code**: Any release/completion code
   - Look for: "release code", "completion code", "ticket number", "reference", "code"
   - Include any alphanumeric codes mentioned

9. **return_tracking**: Return tracking number for parts/equipment
   - Look for: "tracking number", "return label", "RMA", "shipping", "sent back"

EXPENSES TO EXTRACT:

10. **expenses**: Parking fees, tolls, meals, or other expenses
    - Look for: "parking", "toll", "lunch", "dinner", "gas", "expense", "paid for", "cost"
    - Example: "$10 for parking" → "$10 for parking"

11. **materials_used**: Parts, supplies, or equipment used
    - Look for: "used", "installed", "parts", "equipment", "supplies", "materials", "cables", "hardware"
    - List all items mentioned

OUT OF SCOPE TO EXTRACT:

12. **out_of_scope_work**: Work outside original scope and who approved
    - Look for: "additional", "extra", "out of scope", "not planned", "also did", "approved by"
    - Include what work and who approved it

ADDITIONAL CONTEXT TO EXTRACT:

13. **location**: Where the work was performed
    - Look for: addresses, building names, cities, "at", "location", "site", "facility"

14. **datetime**: When the work was done
    - Look for: dates, times, "today", "yesterday", "this morning", days of week

15. **technician_name**: Name of the technician (person speaking)
    - Look for: "I'm", "my name is", self-references

16. **photos_uploaded**: Any mention of photos taken
    - Look for: "photos", "pictures", "images", "took a photo", "documented"

IMPORTANT EXTRACTION RULES:
- Use natural language understanding - people don't speak in formal terms
- Extract implied information from context
- If multiple people are mentioned, identify their roles correctly
- Keep original wording when possible, don't over-formalize
- For yes/no questions, provide clear answers with brief context

Return ONLY a valid JSON object with these exact field names:
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
    "location": "extracted value or Not mentioned",
    "datetime": "extracted value or Not mentioned",
    "technician_name": "extracted value or Not mentioned",
    "photos_uploaded": "extracted value or Not mentioned"
}}

No markdown, no code blocks, just the JSON object."""
        
        return prompt
    
    def _parse_summary_response(self, response_text: str) -> Dict[str, Any]:
        """Parse GPT response and extract JSON with robust error handling"""
        try:
            # Clean up response - remove markdown code blocks if present
            if "```json" in response_text:
                json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(1)
            elif "```" in response_text:
                json_match = re.search(r'```\s*(.*?)\s*```', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(1)
            
            # Try to parse as JSON
            summary = json.loads(response_text)
            
            # Ensure all required fields exist
            required_fields = self._get_empty_summary()
            for field in required_fields:
                if field not in summary:
                    summary[field] = "Not mentioned"
            
            # Clean up values - remove empty strings, normalize "Not mentioned"
            for key, value in summary.items():
                if value is None or value == "" or value.lower() in ["n/a", "none", "null"]:
                    summary[key] = "Not mentioned"
                elif isinstance(value, str):
                    summary[key] = value.strip()
            
            logger.info(f"Successfully parsed summary with {len(summary)} fields")
            return summary
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from GPT response: {e}")
            logger.error(f"Response text: {response_text[:500]}...")
            
            # Try to extract key-value pairs manually as fallback
            summary = self._extract_fields_manually(response_text)
            if summary:
                return summary
            
            # Return empty structure if all parsing fails
            return self._get_empty_summary()
        except Exception as e:
            logger.error(f"Unexpected error parsing summary: {e}")
            return self._get_empty_summary()
    
    def _extract_fields_manually(self, text: str) -> Dict[str, Any]:
        """Fallback method to extract fields from text if JSON parsing fails"""
        try:
            summary = {}
            field_names = [
                "onsite_contact", "support_contact", "work_completed", "delays",
                "troubleshooting_steps", "scope_completed", "released_by", "release_code",
                "return_tracking", "expenses", "materials_used", "out_of_scope_work",
                "location", "datetime", "technician_name", "photos_uploaded"
            ]
            
            for field in field_names:
                # Try to find pattern like "field_name": "value"
                pattern = rf'"{field}"\s*:\s*"([^"]*)"'
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    summary[field] = match.group(1)
                else:
                    summary[field] = "Not mentioned"
            
            if summary:
                logger.info(f"Successfully extracted {len(summary)} fields manually")
                return summary
            
        except Exception as e:
            logger.error(f"Manual extraction failed: {e}")
        
        return None
    
    def _get_empty_summary(self) -> Dict[str, Any]:
        """Return empty summary structure with all required fields"""
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