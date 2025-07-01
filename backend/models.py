from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TranscribeRequest(BaseModel):
    audio: str = Field(..., description="Base64 encoded audio data")
    format: str = Field(default="m4a", description="Audio format (m4a, mp3, wav)")

class TranscribeResponse(BaseModel):
    transcription: str

class Summary(BaseModel):
    taskDescription: str
    location: Optional[str] = None
    datetime: Optional[str] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None

class SummarizeRequest(BaseModel):
    transcription: str

class SummarizeResponse(BaseModel):
    summary: Summary

class GeneratePDFRequest(BaseModel):
    summary: Summary
    transcription: str