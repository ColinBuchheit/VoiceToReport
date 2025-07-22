# backend/models.py
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class TranscribeRequest(BaseModel):
    audio: str  # base64 encoded audio
    format: str = "m4a"

class TranscriptionResponse(BaseModel):
    transcription: str

class SummarizeRequest(BaseModel):
    transcription: str

# Updated summary structure for closeout reports
class CloseoutSummary(BaseModel):
    # Closeout Notes
    onsite_contact: Optional[str] = None
    support_contact: Optional[str] = None  
    work_completed: Optional[str] = None
    delays: Optional[str] = None
    troubleshooting_steps: Optional[str] = None
    scope_completed: Optional[str] = None
    released_by: Optional[str] = None
    release_code: Optional[str] = None
    return_tracking: Optional[str] = None
    
    # Expenses
    expenses: Optional[str] = None
    materials_used: Optional[str] = None
    
    # Out of Scope
    out_of_scope_work: Optional[str] = None
    
    # Photos
    photos_uploaded: Optional[str] = None
    
    # Additional fields for context
    location: Optional[str] = None
    datetime: Optional[str] = None
    technician_name: Optional[str] = None

class SummaryResponse(BaseModel):
    summary: CloseoutSummary

class SendEmailRequest(BaseModel):
    summary: CloseoutSummary
    transcription: str
    technician_name: Optional[str] = None

class EmailResponse(BaseModel):
    success: bool
    message: str
    recipients: List[str]

# Voice command models (keeping existing)
class VoiceCommandRequest(BaseModel):
    audio: str  # base64 encoded audio
    format: str = "m4a"
    screenContext: Dict[str, Any]

class VoiceCommandResponse(BaseModel):
    action: str
    fieldUpdates: Optional[Dict[str, str]] = None
    confirmation: str
    ttsText: str
    success: bool = True

# Health check response
class HealthResponse(BaseModel):
    status: str
    version: str
    services: Dict[str, str]