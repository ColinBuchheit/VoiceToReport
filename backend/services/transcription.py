# backend/services/transcription.py
import base64
import tempfile
import os
import logging
from datetime import datetime
from typing import Dict, Any
from openai import OpenAI

from config import settings

logger = logging.getLogger(__name__)

class TranscriptionService:
    """Service for handling audio transcription using OpenAI Whisper"""
    
    def __init__(self, openai_client: OpenAI = None):
        """
        Initialize transcription service
        
        Args:
            openai_client: OpenAI client instance, if None will create from settings
        """
        if openai_client:
            self.client = openai_client
        else:
            self.client = OpenAI(api_key=settings.openai_api_key)
    
    async def transcribe_audio(self, audio_data: bytes, audio_format: str = 'm4a') -> str:
        """
        Transcribe audio bytes using Whisper
        
        Args:
            audio_data: Audio data as bytes
            audio_format: Audio file format (m4a, mp4, wav, etc.)
            
        Returns:
            Transcription text
            
        Raises:
            ValueError: If audio data is invalid
            Exception: If transcription fails
        """
        if not audio_data:
            raise ValueError("No audio data provided")
        
        if audio_format not in settings.supported_audio_formats:
            raise ValueError(f"Unsupported audio format: {audio_format}")
        
        logger.info(f"Starting transcription for {audio_format} audio")
        
        # Check file size
        audio_size_mb = len(audio_data) / (1024 * 1024)
        if audio_size_mb > settings.max_audio_size_mb:
            raise ValueError(f"Audio file too large: {audio_size_mb:.1f}MB (max: {settings.max_audio_size_mb}MB)")
        
        # Create temporary file for audio
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            # Transcribe using Whisper
            logger.info("Calling OpenAI Whisper API...")
            with open(temp_file_path, 'rb') as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"
                )
            
            transcription_text = transcript.text
            logger.info(f"Transcription completed. Length: {len(transcription_text)} characters")
            
            return transcription_text
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise Exception(f"Failed to transcribe audio: {str(e)}")
            
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary file: {temp_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file {temp_file_path}: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test OpenAI API connection"""
        try:
            # Test with a minimal API call
            models = self.client.models.list()
            return {
                "status": "success",
                "message": "OpenAI API connection successful",
                "models_available": len(models.data) > 0
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"OpenAI API connection failed: {str(e)}"
            }