import json
import logging
from datetime import datetime
from typing import Dict, Any
from openai import OpenAI

from config import settings

logger = logging.getLogger(__name__)

class SummarizationService:
    """Service for generating structured summaries using OpenAI GPT"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    async def generate_summary(self, transcription: str) -> Dict[str, Any]:
        """
        Generate structured summary from transcription text
        
        Args:
            transcription: Text to summarize
            
        Returns:
            Dictionary containing structured summary data
            
        Raises:
            ValueError: If transcription is invalid
            Exception: If summarization fails
        """
        if not transcription or len(transcription.strip()) < 10:
            raise ValueError("Transcription text too short to summarize")
        
        logger.info(f"Starting summarization for {len(transcription)} character transcription")
        
        # Create structured prompt for GPT
        system_prompt = self._get_system_prompt()
        user_prompt = self._get_user_prompt(transcription)
        
        try:
            # Call OpenAI GPT
            logger.info("Calling OpenAI GPT API...")
            response = self.client.chat.completions.create(
                model=settings.gpt_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=settings.gpt_temperature,
                max_tokens=settings.gpt_max_tokens,
                response_format={"type": "json_object"}
            )
            
            # Extract the response content
            summary_text = response.choices[0].message.content.strip()
            logger.info("GPT summarization completed")
            
            # Parse JSON response
            summary_data = self._parse_summary_response(summary_text)
            
            return {
                'summary': summary_data,
                'timestamp': datetime.now().isoformat(),
                'model_used': settings.gpt_model
            }
            
        except Exception as e:
            logger.error(f"Error during GPT summarization: {e}")
            # Return fallback summary
            return self._create_fallback_summary(transcription)
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for GPT"""
        return """You are an AI assistant that analyzes work activity transcriptions and extracts structured information. 

Your task is to analyze the given transcription and extract the following information in JSON format:
- taskDescription: A clear, concise description of the main task or activity described
- location: Where this activity took place (if mentioned, otherwise null)
- datetime: When this occurred (if mentioned, otherwise null)
- outcome: The result, completion status, or achievement described
- notes: Any additional relevant details, insights, or next steps mentioned

Be precise and only include information that is actually mentioned in the transcription. If something isn't mentioned, use null for that field.
Always respond with valid JSON only, no additional text or formatting."""
    
    def _get_user_prompt(self, transcription: str) -> str:
        """Get the user prompt with transcription"""
        return f"""Please analyze this work activity transcription and provide a structured summary:

Transcription: "{transcription}"

Return your response as a valid JSON object with the fields: taskDescription, location, datetime, outcome, and notes."""
    
    def _parse_summary_response(self, summary_text: str) -> Dict[str, Any]:
        """Parse and validate GPT response"""
        try:
            # Remove markdown code blocks if present
            if summary_text.startswith('```json'):
                summary_text = summary_text.replace('```json', '').replace('```', '').strip()
            elif summary_text.startswith('```'):
                summary_text = summary_text.replace('```', '').strip()
            
            summary_data = json.loads(summary_text)
            
            # Validate and ensure required fields exist
            required_fields = ['taskDescription', 'location', 'datetime', 'outcome', 'notes']
            for field in required_fields:
                if field not in summary_data:
                    summary_data[field] = None
            
            # Ensure taskDescription is not empty
            if not summary_data.get('taskDescription'):
                summary_data['taskDescription'] = "Work activity completed"
            
            logger.info("Summary parsing successful")
            return summary_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse GPT response as JSON: {e}")
            logger.error(f"GPT response was: {summary_text}")
            raise ValueError("Failed to parse AI response")
    
    def _create_fallback_summary(self, transcription: str) -> Dict[str, Any]:
        """Create fallback summary when AI parsing fails"""
        logger.warning("Creating fallback summary due to AI parsing failure")
        
        fallback_summary = {
            'taskDescription': transcription[:200] + "..." if len(transcription) > 200 else transcription,
            'location': None,
            'datetime': None,
            'outcome': "Summary generation failed - manual review needed",
            'notes': "AI was unable to parse this transcription into structured format"
        }
        
        return {
            'summary': fallback_summary,
            'timestamp': datetime.now().isoformat(),
            'model_used': settings.gpt_model,
            'warning': 'Fallback summary used due to parsing error'
        }