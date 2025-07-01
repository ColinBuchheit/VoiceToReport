# backend/app_refactored.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import traceback
from datetime import datetime
from werkzeug.exceptions import BadRequest

from config import Config
from services import AudioTranscriptionService, SummaryGenerationService

# Configure logging
logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Validate configuration
    Config.validate()
    
    # Configure CORS
    CORS(app, origins=Config.ALLOWED_ORIGINS)
    
    # Initialize services
    transcription_service = AudioTranscriptionService()
    summary_service = SummaryGenerationService()
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'service': 'voice-report-backend',
            'version': '1.0.0'
        }), 200
    
    @app.route('/transcribe', methods=['POST'])
    def transcribe_audio():
        """
        Transcribe audio using OpenAI Whisper
        Expected payload: {
            "audio": "base64_encoded_audio_data",
            "format": "m4a" or other audio format
        }
        """
        try:
            # Validate request
            if not request.json:
                raise BadRequest("No JSON payload provided")
            
            audio_data = request.json.get('audio')
            audio_format = request.json.get('format', 'm4a')
            
            if not audio_data:
                raise BadRequest("No audio data provided")
            
            # Use transcription service
            result = transcription_service.transcribe_audio(audio_data, audio_format)
            
            return jsonify(result), 200
        
        except BadRequest as e:
            logger.error(f"Bad request in transcribe: {e}")
            return jsonify({'error': str(e)}), 400
        except ValueError as e:
            logger.error(f"Validation error in transcribe: {e}")
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            logger.error(f"Unexpected error in transcribe: {e}")
            logger.error(traceback.format_exc())
            return jsonify({'error': 'Internal server error during transcription'}), 500
    
    @app.route('/summarize', methods=['POST'])
    def generate_summary():
        """
        Generate structured summary using OpenAI GPT
        Expected payload: {
            "transcription": "text_to_summarize"
        }
        """
        try:
            # Validate request
            if not request.json:
                raise BadRequest("No JSON payload provided")
            
            transcription = request.json.get('transcription')
            
            if not transcription:
                raise BadRequest("No transcription text provided")
            
            # Use summary service
            result = summary_service.generate_summary(transcription)
            
            return jsonify(result), 200
        
        except BadRequest as e:
            logger.error(f"Bad request in summarize: {e}")
            return jsonify({'error': str(e)}), 400
        except ValueError as e:
            logger.error(f"Validation error in summarize: {e}")
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            logger.error(f"Unexpected error in summarize: {e}")
            logger.error(traceback.format_exc())
            return jsonify({'error': 'Internal server error during summarization'}), 500
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'error': 'Method not allowed'}), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

# Create app instance
app = create_app()

if __name__ == '__main__':
    logger.info(f"Starting Voice Report Backend on port {Config.PORT}")
    logger.info(f"Debug mode: {Config.DEBUG}")
    logger.info(f"Allowed origins: {Config.ALLOWED_ORIGINS}")
    
    app.run(host='0.0.0.0', port=Config.PORT, debug=Config.DEBUG)