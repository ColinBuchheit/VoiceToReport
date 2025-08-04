# backend/services/summarization.py
import logging
import json
import re
from typing import Dict, Any
from openai import OpenAI
from models import CloseoutSummary

logger = logging.getLogger(__name__)

class SummarizationService:
    """Service for extracting structured closeout data from transcriptions"""
    
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
    
    def parse_ai_response(self, response) -> Dict[str, Any]:
        """Robust AI response parsing with better error handling"""
        try:
            # Handle different response types
            if hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content
            elif isinstance(response, dict):
                content = response.get('content', str(response))
            else:
                content = str(response)
            
            logger.info(f"GPT response preview: {content[:200]}...")
            
            # Try to extract JSON from markdown code blocks
            if '```json' in content:
                json_start = content.find('```json') + 7
                json_end = content.find('```', json_start)
                if json_end != -1:
                    json_content = content[json_start:json_end].strip()
                else:
                    json_content = content[json_start:].strip()
            elif content.strip().startswith('{'):
                json_content = content.strip()
            else:
                # If no JSON markers, try to find JSON-like content
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    json_content = json_match.group()
                else:
                    raise ValueError("No JSON content found in response")
            
            # Parse the JSON
            parsed_data = json.loads(json_content)
            return parsed_data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Content that failed to parse: {content}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error parsing AI response: {e}")
            return None
    
    def extract_closeout_data(self, transcription: str) -> CloseoutSummary:
        """Extract structured closeout information from voice transcription"""
        
        # Enhanced prompt for closeout data extraction with stricter JSON formatting
        prompt = f"""You are an AI assistant helping to extract structured closeout information from a field technician's voice report.

Please analyze the following transcription and extract information for these specific categories. If information is not mentioned, use "Not mentioned".

TRANSCRIPTION:
"{transcription}"

Respond with ONLY valid JSON in this exact format (no additional text):

{{
    "CLOSEOUT_NOTES": {{
        "onsite_contact": "name or 'Not mentioned'",
        "support_contact": "name/company or 'Not mentioned'",
        "work_completed": "detailed description or 'Not mentioned'",
        "delays": "description or 'Not mentioned'",
        "troubleshooting_steps": "description or 'Not mentioned'",
        "scope_completed": "yes/no/description or 'Not mentioned'",
        "released_by": "name or 'Not mentioned'",
        "release_code": "code or 'Not mentioned'",
        "return_tracking": "tracking number or 'Not mentioned'"
    }},
    "EXPENSES": {{
        "expenses": "amount/description or 'Not mentioned'",
        "materials_used": "list or 'Not mentioned'"
    }},
    "OUT_OF_SCOPE": {{
        "out_of_scope_work": "description or 'Not mentioned'"
    }},
    "PHOTOS": {{
        "photos_uploaded": "number or 'Not mentioned'"
    }},
    "ADDITIONAL_CONTEXT": {{
        "location": "location or 'Not mentioned'",
        "datetime": "date/time or 'Not mentioned'",
        "technician_name": "name or 'Not mentioned'"
    }}
}}

EXTRACTION GUIDELINES:
- Listen carefully for names, locations, and specific details
- For expenses: Look for parking fees, costs, money amounts
- For work completed: Include all technical details mentioned
- For contacts: Extract all names mentioned (Ron, Pavlov, etc.)
- For support: Look for company names, support teams
- Be comprehensive - extract ALL information mentioned, don't summarize

Extract information ONLY from the transcription provided. Use "Not mentioned" for any field where information is not present."""

        try:
            logger.info("Extracting closeout data from transcription")
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",  # Using gpt-3.5-turbo instead of gpt-4 for better availability
                messages=[
                    {
                        "role": "system",
                        "content": "You are a specialized AI for extracting field service closeout information. Always respond with valid JSON only, no additional text."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.1  # Lower temperature for more consistent extraction
            )
            
            # Parse JSON response using improved parsing
            extracted_data = self.parse_ai_response(response)
            
            if extracted_data is None:
                logger.error("Failed to parse AI response, returning empty summary")
                return self.get_empty_summary()
            
            # Flatten the nested structure to match CloseoutSummary model
            flattened_data = {}
            
            # Extract CLOSEOUT_NOTES
            closeout_notes = extracted_data.get('CLOSEOUT_NOTES', {})
            flattened_data.update(closeout_notes)
            
            # Extract EXPENSES
            expenses = extracted_data.get('EXPENSES', {})
            flattened_data.update(expenses)
            
            # Extract OUT_OF_SCOPE
            out_of_scope = extracted_data.get('OUT_OF_SCOPE', {})
            flattened_data.update(out_of_scope)
            
            # Extract PHOTOS
            photos = extracted_data.get('PHOTOS', {})
            flattened_data.update(photos)
            
            # Extract ADDITIONAL_CONTEXT
            additional = extracted_data.get('ADDITIONAL_CONTEXT', {})
            flattened_data.update(additional)
            
            logger.info(f"Successfully extracted closeout data with {len(flattened_data)} fields")
            
            # Create CloseoutSummary object with extracted data
            closeout_summary = CloseoutSummary(**flattened_data)
            return closeout_summary
                
        except Exception as e:
            logger.error(f"Closeout data extraction failed: {e}")
            # Return empty summary on any error
            return self.get_empty_summary()
    
    def get_empty_summary(self) -> CloseoutSummary:
        """Return an empty CloseoutSummary with 'Not mentioned' defaults"""
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
    
    def enhance_closeout_data(self, closeout_data: CloseoutSummary, additional_context: str = None) -> CloseoutSummary:
        """Enhance closeout data with additional context or corrections"""
        
        if not additional_context:
            return closeout_data
        
        try:
            # Convert current data to dict for the prompt
            current_data = closeout_data.dict()
            
            prompt = f"""You have existing closeout data and additional context. Please update the closeout data with any new or corrected information.

CURRENT CLOSEOUT DATA:
{json.dumps(current_data, indent=2)}

ADDITIONAL CONTEXT:
"{additional_context}"

Please provide the updated closeout data in JSON format, incorporating any new information while preserving existing data that's still valid.

Respond with ONLY valid JSON in the same format as the current data."""

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a specialized AI for updating field service closeout information. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=1000,
                temperature=0.1
            )
            
            # Parse and return updated data
            updated_data = self.parse_ai_response(response)
            
            if updated_data is None:
                logger.error("Failed to parse enhanced data, returning original")
                return closeout_data
            
            return CloseoutSummary(**updated_data)
            
        except Exception as e:
            logger.error(f"Failed to enhance closeout data: {e}")
            return closeout_data  # Return original data on error