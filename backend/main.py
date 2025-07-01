from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import tempfile
import base64

from models import (
    TranscribeRequest,
    TranscribeResponse,
    SummarizeRequest,
    SummarizeResponse,
    GeneratePDFRequest
)
from services.transcription import TranscriptionService
from services.summarization import SummarizationService
from services.pdf_generator import PDFGenerator
from utils.file_handlers import save_temp_file, cleanup_temp_file

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Voice-to-Report API",
    description="API for converting voice recordings to professional PDF reports",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
transcription_service = TranscriptionService()
summarization_service = SummarizationService()
pdf_generator = PDFGenerator()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Voice-to-Report API is running",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribe audio using OpenAI Whisper
    """
    temp_path = None
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)
        
        # Save to temporary file
        temp_path = save_temp_file(audio_bytes, f"audio.{request.format}")
        
        # Transcribe using Whisper
        transcription = await transcription_service.transcribe(temp_path)
        
        return TranscribeResponse(transcription=transcription)
        
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if temp_path:
            cleanup_temp_file(temp_path)

@app.post("/summarize", response_model=SummarizeResponse)
async def generate_summary(request: SummarizeRequest):
    """
    Generate structured summary using GPT-4
    """
    try:
        summary = await summarization_service.generate_summary(request.transcription)
        return SummarizeResponse(summary=summary)
    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/generate-pdf")
async def generate_pdf(request: GeneratePDFRequest):
    """
    Generate PDF report from summary and transcription
    """
    try:
        # Generate PDF
        pdf_path = await pdf_generator.generate_report(
            summary=request.summary.dict(),
            transcription=request.transcription
        )
        
        # Return PDF file
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )
    except Exception as e:
        logger.error(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)