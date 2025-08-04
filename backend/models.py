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
    onsite_contact: Optional[str] = "Not mentioned"
    support_contact: Optional[str] = "Not mentioned"
    work_completed: Optional[str] = "Not mentioned"
    delays: Optional[str] = "Not mentioned"
    troubleshooting_steps: Optional[str] = "Not mentioned"
    scope_completed: Optional[str] = "Not mentioned"
    released_by: Optional[str] = "Not mentioned"
    release_code: Optional[str] = "Not mentioned"
    return_tracking: Optional[str] = "Not mentioned"
    
    # Expenses
    expenses: Optional[str] = "Not mentioned"
    materials_used: Optional[str] = "Not mentioned"
    
    # Out of Scope
    out_of_scope_work: Optional[str] = "Not mentioned"
    
    # Photos
    photos_uploaded: Optional[str] = "Not mentioned"
    
    # Additional fields for context
    location: Optional[str] = "Not mentioned"
    datetime: Optional[str] = "Not mentioned"
    technician_name: Optional[str] = "Not mentioned"

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

# Voice command models - Updated to match the actual usage
class VoiceCommandRequest(BaseModel):
    audio: str  # base64 encoded audio
    format: str = "m4a"
    screenContext: Dict[str, Any] = {}

class VoiceCommandResponse(BaseModel):
    action: str
    target: Optional[str] = ""
    value: Optional[str] = ""  # Added this field that frontend expects
    replacement: Optional[str] = ""
    fieldUpdates: Optional[Dict[str, str]] = {}
    needs_clarification: bool = False
    clarification: Optional[str] = ""  # Added this field that frontend expects
    clarification_question: Optional[str] = ""
    confirmation: str = ""
    ttsText: str = ""
    confidence: float = 0.0
    success: bool = True
    metadata: Optional[Dict[str, Any]] = {}  # Added for frontend compatibility

# Health check response
class HealthResponse(BaseModel):
    status: str
    version: str
    services: Dict[str, str]