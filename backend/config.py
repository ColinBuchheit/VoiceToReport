# backend/config.py
import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application configuration using Pydantic settings"""
    
    # OpenAI Configuration
    openai_api_key: str
    
    # Server Configuration
    port: int = 8000
    debug: bool = False
    
    # CORS Configuration - can be string or list
    allowed_origins: Union[str, List[str]] = "*"
    
    # Logging Configuration
    log_level: str = "INFO"
    
    # Audio Processing Configuration
    max_audio_size_mb: int = 25
    supported_audio_formats: Union[str, List[str]] = "m4a,mp4,wav,mp3,webm"
    
    # GPT Configuration
    gpt_model: str = "gpt-4-turbo-preview"
    gpt_max_tokens: int = 500
    gpt_temperature: float = 0.3
    
    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [x.strip() for x in v.split(',') if x.strip()]
        return v
    
    @field_validator('supported_audio_formats', mode='before')
    @classmethod
    def parse_supported_formats(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(',') if x.strip()]
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

# Global settings instance
settings = Settings()