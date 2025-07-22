# backend/services/summarization.py
import logging
from typing import Dict, Any
from openai import OpenAI
from models import CloseoutSummary

logger = logging.getLogger(__name__)

class SummarizationService:
    """Service for extracting structured closeout data from transcriptions"""
    
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
    
    def extract_closeout_data(self, transcription: str) -> CloseoutSummary:
        """Extract structured closeout information from voice transcription"""
        
        # Enhanced prompt for closeout data extraction
        prompt = f"""You are an AI assistant helping to extract structured closeout information from a field technician's voice report.

Please analyze the following transcription and extract information for these specific categories. If information is not mentioned, leave the field empty or mark as "Not mentioned".

TRANSCRIPTION:
"{transcription}"

Please extract and format the following information in JSON format:

CLOSEOUT NOTES:
- onsite_contact: Who did you meet with on-site?
- support_contact: Who did you work with for support?
- work_completed: What work was completed?
- delays: Were there any delays?
- troubleshooting_steps: What troubleshooting steps did you take?
- scope_completed: Was the scope completed successfully?
- released_by: Who released you?
- release_code: Is there a release code? If so, what is it?
- return_tracking: Is there a return tracking number? If so, what is it?

EXPENSES:
- expenses: Did you have any expenses (parking fees, etc)?
- materials_used: What materials did you use?

OUT OF SCOPE:
- out_of_scope_work: Was there any out of scope work? If so, what is it and who approved the work?

PHOTOS:
- photos_uploaded: How many photos did you upload?

ADDITIONAL CONTEXT:
- location: Any location mentioned
- datetime: Any date/time mentioned
- technician_name: Any technician name mentioned

Please respond with ONLY a JSON object containing these fields. Use "Not mentioned" for fields that aren't discussed in the transcription."""

        try:
            logger.info("Extracting closeout data from transcription")
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a specialized AI for extracting field service closeout information. Always respond with valid JSON only."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=800,
                temperature=0.1  # Lower temperature for more consistent extraction
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"GPT response: {response_text[:200]}...")
            
            # Parse JSON response
            import json
            try:
                extracted_data = json.loads(response_text)
                
                # Create CloseoutSummary object
                closeout_summary = CloseoutSummary(**extracted_data)
                logger.info("Successfully extracted closeout data")
                return closeout_summary
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from GPT response: {e}")
                # Return empty summary if parsing fails
                return CloseoutSummary()
                
        except Exception as e:
            logger.error(f"Closeout data extraction failed: {e}")
            # Return empty summary on any error
            return CloseoutSummary()
    
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

Please provide the updated closeout data in JSON format, incorporating any new information while preserving existing data that's still valid."""

            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
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
                max_tokens=800,
                temperature=0.1
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Parse and return updated data
            import json
            updated_data = json.loads(response_text)
            return CloseoutSummary(**updated_data)
            
        except Exception as e:
            logger.error(f"Failed to enhance closeout data: {e}")
            return closeout_data  # Return original data on error