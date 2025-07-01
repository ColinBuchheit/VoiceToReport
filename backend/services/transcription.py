import os
from openai import OpenAI
import logging

logger = logging.getLogger(__name__)

class TranscriptionService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def transcribe(self, audio_file_path: str) -> str:
        """
        Transcribe audio file using OpenAI Whisper
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text",
                    language="en"  # Remove if you want auto-detection
                )
            
            logger.info(f"Successfully transcribed audio: {len(response)} characters")
            return response
            
        except Exception as e:
            logger.error(f"Whisper API error: {str(e)}")
            raise

        ##