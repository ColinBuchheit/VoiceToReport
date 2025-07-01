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
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    async def transcribe_audio(self, audio_data: str, audio_format: str = 'm4a') -> Dict[str, Any]:
        """
        Transcribe base64 encoded audio data using Whisper
        
        Args:
            audio_data: Base64 encoded audio data
            audio_format: Audio file format (m4a, mp4, wav, etc.)
            
        Returns:
            Dictionary containing transcription and metadata
            
        Raises:
            ValueError: If audio data is invalid
            Exception: If transcription fails
        """
        if not audio_data:
            raise ValueError("No audio data provided")
        
        if audio_format not in settings.supported_audio_formats:
            raise ValueError(f"Unsupported audio format: {audio_format}")
        
        logger.info(f"Starting transcription for {audio_format} audio")
        
        # Decode base64 audio data
        try:
            audio_bytes = base64.b64decode(audio_data)
        except Exception as e:
            logger.error(f"Failed to decode base64 audio: {e}")
            raise ValueError("Invalid base64 audio data")
        
        # Check file size
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        if audio_size_mb > settings.max_audio_size_mb:
            raise ValueError(f"Audio file too large: {audio_size_mb:.1f}MB (max: {settings.max_audio_size_mb}MB)")
        
        # Create temporary file for audio
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as temp_file:
                temp_file.write(audio_bytes)
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
            
            return {
                'transcription': transcription_text,
                'timestamp': datetime.now().isoformat(),
                'audio_format': audio_format,
                'audio_size_mb': round(audio_size_mb, 2)
            }
            
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except OSError as e:
                    logger.warning(f"Failed to delete temp file {temp_file_path}: {e}")
    
    # Legacy method name for backward compatibility
    async def transcribe(self, audio_file_path: str) -> str:
        """
        Legacy method for file-based transcription
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text",
                    language="en"
                )
            
            logger.info(f"Successfully transcribed audio: {len(response)} characters")
            return response
            
        except Exception as e:
            logger.error(f"Whisper API error: {str(e)}")
            raise