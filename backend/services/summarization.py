import os
from openai import OpenAI
import json
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class SummarizationService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def generate_summary(self, transcription: str) -> Dict:
        """
        Generate structured summary using GPT-4
        """
        try:
            system_prompt = """
            You are an AI assistant that extracts structured information from work-related transcriptions.
            Extract the following information:
            1. taskDescription: Main task or accomplishment described
            2. location: Where the work was done (if mentioned)
            3. datetime: When it was done (if mentioned)
            4. outcome: Results or outcomes achieved
            5. notes: Any additional important details
            
            Return ONLY a JSON object with these fields. If a field is not mentioned, set it to null.
            """
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract structured data from: {transcription}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=500
            )
            
            summary = json.loads(response.choices[0].message.content)
            logger.info("Successfully generated summary")
            return summary
            
        except Exception as e:
            logger.error(f"GPT-4 API error: {str(e)}")
            raise