# backend/config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration"""
    
    # OpenAI Configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    
    # Server Configuration
    PORT = int(os.getenv('PORT', 3000))
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # CORS Configuration
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*').split(',')
    
    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Audio Processing Configuration
    MAX_AUDIO_SIZE_MB = int(os.getenv('MAX_AUDIO_SIZE_MB', 25))
    SUPPORTED_AUDIO_FORMATS = os.getenv('SUPPORTED_AUDIO_FORMATS', 'm4a,mp4,wav,mp3,webm').split(',')
    
    # GPT Configuration
    GPT_MODEL = os.getenv('GPT_MODEL', 'gpt-4o-mini')
    GPT_MAX_TOKENS = int(os.getenv('GPT_MAX_TOKENS', 500))
    GPT_TEMPERATURE = float(os.getenv('GPT_TEMPERATURE', 0.3))
    
    @classmethod
    def validate(cls):
        """Validate that all required configuration is present"""
        required_vars = ['OPENAI_API_KEY']
        missing_vars = []
        
        for var in required_vars:
            if not getattr(cls, var):
                missing_vars.append(var)
        
        if missing_vars:
            raise ValueError(f"Missing required configuration: {', '.join(missing_vars)}")
        
        return True