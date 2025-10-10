# backend/config.py - UPDATED VERSION (keeping your structure, fixing CORS)
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
    
    # CORS Configuration - FIXED: Remove wildcard, add environment awareness
    allowed_origins: Union[str, List[str]] = ""  # Changed from "*" to ""
    environment: str = "development"  # Added environment detection
    
    # Logging Configuration
    log_level: str = "INFO"
    
    # Audio Processing Configuration
    max_audio_size_mb: int = 25
    supported_audio_formats: Union[str, List[str]] = "m4a,mp4,wav,mp3,webm"
    
    # GPT Configuration
    gpt_model: str = "gpt-4-turbo-preview"
    gpt_max_tokens: int = 500
    gpt_temperature: float = 0.3
    
    # Email Configuration
    email_user: str = ""
    email_password: str = ""
    email_recipients: str = "colbol42@gmail.com"  # Your existing email
    smtp_server: str = "smtp.gmail.com"
    smtp_port: str = "587"
    
    # Bug report recipient
    bug_report_recipient: str = "colin.buchheit@beartechs.com"
    
    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            if v == "*":
                # SECURITY FIX: Never allow wildcard in production
                return [""]  # Empty list for auto-detection
            elif v == "":
                return [""]  # Empty for auto-detection
            return [x.strip() for x in v.split(',') if x.strip()]
        return v
    
    @field_validator('supported_audio_formats', mode='before')
    @classmethod
    def parse_supported_formats(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(',') if x.strip()]
        return v
    
    @field_validator('smtp_port', mode='before')
    @classmethod
    def parse_smtp_port(cls, v):
        if isinstance(v, str):
            return v
        return str(v)
    
    # NEW: Helper methods for CORS system
    def get_allowed_origins_list(self) -> List[str]:
        """Get allowed origins as a list for CORS validation"""
        if isinstance(self.allowed_origins, list):
            return [origin for origin in self.allowed_origins if origin]
        elif isinstance(self.allowed_origins, str) and self.allowed_origins:
            return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
        return []  # Empty list means use dynamic validation
    
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.environment.lower() == "development" or self.debug
    
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.environment.lower() == "production"
    
    def should_use_dynamic_cors(self) -> bool:
        """Determine if we should use dynamic CORS validation"""
        # Use dynamic CORS if no specific origins are configured
        return len(self.get_allowed_origins_list()) == 0
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

# Global settings instance
settings = Settings()

# Log CORS configuration on startup
if settings.should_use_dynamic_cors():
    print("🔒 CORS: Using dynamic validation (development mode)")
    print("   ✅ Ngrok domains allowed")
    print("   ✅ Localhost allowed") 
    print("   ✅ Local network allowed")
else:
    origins = settings.get_allowed_origins_list()
    print(f"🔒 CORS: Using specific origins ({len(origins)} configured)")
    for origin in origins:
        print(f"   ✅ {origin}")