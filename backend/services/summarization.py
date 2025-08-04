# backend/services/summarization.py - FIXED EXTRACTION AND IMPROVED PROMPTING

import json
import logging
from typing import Dict, Any
from openai import OpenAI
from models import CloseoutSummary

logger = logging.getLogger(__name__)

class SummarizationService:
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
    
    def parse_ai_response(self, response) -> Dict[str, Any]:
        """Enhanced parsing with better error handling"""
        try:
            content = response.choices[0].message.content.strip()
            logger.info(f"Raw AI response: {content[:500]}...")
            
            # Find JSON content
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON found in AI response")
                return None
            
            json_str = content[start_idx:end_idx]
            parsed = json.loads(json_str)
            
            logger.info(f"Successfully parsed JSON response with {len(parsed)} top-level keys")
            return parsed
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}")
            logger.error(f"Attempted to parse: {content}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error parsing response: {e}")
            return None
    
    def extract_closeout_data(self, transcription: str) -> CloseoutSummary:
        """Extract structured closeout information from transcription"""
        
        # IMPROVED PROMPT with better instruction and examples
        prompt = f"""
You are a specialized AI that extracts field service closeout information from transcriptions.

TRANSCRIPTION TO ANALYZE:
"{transcription}"

Extract information for these specific categories. If information is not mentioned, use "Not mentioned".

CRITICAL INSTRUCTIONS:
1. Listen for NAMES - extract all person names mentioned (John, Ron, Sarah, etc.)
2. Listen for COMPANIES - extract company/organization names (Pavlov, Microsoft, etc.) 
3. Listen for LOCATIONS - extract specific places, addresses, buildings
4. Listen for WORK DETAILS - extract all technical work, tasks, repairs mentioned
5. Listen for COSTS - extract any dollar amounts, parking fees, expenses
6. Listen for NUMBERS - extract photo counts, tracking numbers, codes
7. Be COMPREHENSIVE - don't summarize, extract ALL details mentioned

RESPOND WITH ONLY THIS JSON FORMAT:

{{
    "CLOSEOUT_NOTES": {{
        "onsite_contact": "Extract WHO they met with on-site (names, roles)",
        "support_contact": "Extract WHO helped with support (names, companies)", 
        "work_completed": "Extract ALL work/tasks completed (be detailed)",
        "delays": "Extract any delays mentioned or 'Not mentioned'",
        "troubleshooting_steps": "Extract troubleshooting steps taken",
        "scope_completed": "Extract if scope was completed (yes/no/details)",
        "released_by": "Extract who released/signed off (name/role)",
        "release_code": "Extract any release/completion codes",
        "return_tracking": "Extract return tracking numbers"
    }},
    "EXPENSES": {{
        "expenses": "Extract parking fees, costs, dollar amounts", 
        "materials_used": "Extract equipment, parts, supplies used"
    }},
    "OUT_OF_SCOPE": {{
        "out_of_scope_work": "Extract additional work and approvals"
    }},
    "PHOTOS": {{
        "photos_uploaded": "Extract number of photos (just the number)"
    }},
    "ADDITIONAL_CONTEXT": {{
        "location": "Extract specific location/address/building",
        "datetime": "Extract date/time mentioned",
        "technician_name": "Extract technician's name"
    }}
}}

EXAMPLES OF GOOD EXTRACTION:
- "I met with John Smith" → onsite_contact: "John Smith"
- "Pavlov support helped me" → support_contact: "Pavlov support"  
- "Fixed the router and updated firmware" → work_completed: "Fixed the router and updated firmware"
- "Parking cost me 20 bucks" → expenses: "Parking: $20"
- "Took 4 photos" → photos_uploaded: "4"

Extract ALL information mentioned. Be specific and detailed."""

        try:
            logger.info("🔍 Starting closeout data extraction...")
            logger.info(f"📝 Transcription length: {len(transcription)} characters")
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a specialized field service data extraction AI. Always respond with valid JSON only, no additional text. Extract ALL information mentioned, don't summarize."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=1200,  # Increased for longer responses
                temperature=0.0   # Minimal temperature for consistent extraction
            )
            
            # Parse JSON response
            extracted_data = self.parse_ai_response(response)
            
            if extracted_data is None:
                logger.error("❌ Failed to parse AI response, returning empty summary")
                return self.get_empty_summary()
            
            # IMPROVED: Flatten and validate the nested structure
            logger.info("🔧 Flattening extracted data structure...")
            flattened_data = {}
            
            # Extract each section with validation
            sections = ['CLOSEOUT_NOTES', 'EXPENSES', 'OUT_OF_SCOPE', 'PHOTOS', 'ADDITIONAL_CONTEXT']
            
            for section_name in sections:
                section_data = extracted_data.get(section_name, {})
                if isinstance(section_data, dict):
                    flattened_data.update(section_data)
                    logger.info(f"  ✅ Extracted {len(section_data)} fields from {section_name}")
                else:
                    logger.warning(f"  ⚠️ Section {section_name} is not a dict: {type(section_data)}")
            
            # DEBUGGING: Log extracted fields
            logger.info("📋 Extracted field summary:")
            for key, value in flattened_data.items():
                if value and value != "Not mentioned":
                    logger.info(f"  - {key}: {str(value)[:50]}...")
            
            # Create CloseoutSummary object
            logger.info(f"✅ Successfully extracted {len(flattened_data)} fields")
            closeout_summary = CloseoutSummary(**flattened_data)
            
            return closeout_summary
                
        except Exception as e:
            logger.error(f"❌ Closeout data extraction failed: {e}")
            return self.get_empty_summary()
    
    def get_empty_summary(self) -> CloseoutSummary:
        """Return an empty CloseoutSummary with 'Not mentioned' defaults"""
        logger.info("📝 Creating empty summary with defaults")
        empty_data = {
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
        
        return CloseoutSummary(**empty_data)