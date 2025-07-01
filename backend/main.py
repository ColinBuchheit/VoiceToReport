# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import logging
from datetime import datetime

from config import settings
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

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
    allow_origins=settings.allowed_origins,
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
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "voice-report-backend",
        "version": "1.0.0",
        "config": {
            "gpt_model": settings.gpt_model,
            "max_audio_size_mb": settings.max_audio_size_mb,
            "supported_formats": settings.supported_audio_formats
        }
    }

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribe audio using OpenAI Whisper
    """
    try:
        # Use transcription service
        result = await transcription_service.transcribe_audio(
            audio_data=request.audio,
            audio_format=request.format
        )
        
        return TranscribeResponse(transcription=result['transcription'])
        
    except ValueError as e:
        logger.error(f"Validation error in transcribe: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in transcribe: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during transcription")

@app.post("/summarize", response_model=SummarizeResponse)
async def generate_summary(request: SummarizeRequest):
    """
    Generate structured summary using OpenAI GPT
    """
    try:
        # Use summary service
        result = await summarization_service.generate_summary(request.transcription)
        
        # Convert to Pydantic model
        from models import Summary
        summary = Summary(**result['summary'])
        
        return SummarizeResponse(summary=summary)
        
    except ValueError as e:
        logger.error(f"Validation error in summarize: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in summarize: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during summarization")

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

@app.exception_handler(404)
async def not_found(request, exc):
    return {"error": "Endpoint not found"}

@app.exception_handler(405)
async def method_not_allowed(request, exc):
    return {"error": "Method not allowed"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting Voice Report Backend on port {settings.port}")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"Allowed origins: {settings.allowed_origins}")
    
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)