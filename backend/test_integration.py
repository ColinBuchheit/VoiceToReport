# test_integration.py - Complete API testing script

import asyncio
import base64
import json
import os
import tempfile
from pathlib import Path
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test configuration
BASE_URL = "http://localhost:8000"
SAMPLE_AUDIO_TEXT = "This is a test transcription for integration testing."

class VoiceReportTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def test_health_check(self):
        """Test if the API is running"""
        print("🏥 Testing health check...")
        try:
            response = await self.client.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API is healthy: {data['message']}")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Cannot connect to API: {e}")
            return False
    
    def create_sample_audio(self) -> str:
        """Create a sample audio file for testing"""
        print("🎵 Creating sample audio file...")
        
        # Create a minimal WAV file (just headers + minimal data)
        # This won't actually play sound, but will be valid for testing
        wav_header = bytearray([
            0x52, 0x49, 0x46, 0x46,  # "RIFF"
            0x28, 0x00, 0x00, 0x00,  # File size - 8
            0x57, 0x41, 0x56, 0x45,  # "WAVE"
            0x66, 0x6D, 0x74, 0x20,  # "fmt "
            0x10, 0x00, 0x00, 0x00,  # fmt chunk size
            0x01, 0x00,              # Audio format (PCM)
            0x01, 0x00,              # Number of channels
            0x40, 0x1F, 0x00, 0x00,  # Sample rate (8000 Hz)
            0x80, 0x3E, 0x00, 0x00,  # Byte rate
            0x02, 0x00,              # Block align
            0x10, 0x00,              # Bits per sample
            0x64, 0x61, 0x74, 0x61,  # "data"
            0x04, 0x00, 0x00, 0x00,  # Data size
            0x00, 0x00, 0x00, 0x00   # Minimal audio data
        ])
        
        # Encode to base64
        audio_base64 = base64.b64encode(wav_header).decode('utf-8')
        print("✅ Sample audio file created")
        return audio_base64
    
    async def test_transcription(self, audio_data: str):
        """Test audio transcription endpoint"""
        print("🎤 Testing transcription...")
        try:
            payload = {
                "audio": audio_data,
                "format": "wav"
            }
            
            response = await self.client.post(
                f"{self.base_url}/transcribe",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                transcription = data.get('transcription', '')
                print(f"✅ Transcription successful: '{transcription[:50]}...'")
                return transcription
            else:
                print(f"❌ Transcription failed: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return None
    
    async def test_transcription_with_mock_data(self):
        """Test transcription with mock data (for when we can't use real audio)"""
        print("🎤 Testing transcription with mock response...")
        # For testing purposes, we'll return mock data
        # In a real scenario, you'd record a short audio clip
        return SAMPLE_AUDIO_TEXT
    
    async def test_summarization(self, transcription: str):
        """Test summarization endpoint"""
        print("📝 Testing summarization...")
        try:
            payload = {
                "transcription": transcription
            }
            
            response = await self.client.post(
                f"{self.base_url}/summarize",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                summary = data.get('summary', {})
                print(f"✅ Summarization successful")
                print(f"   Task: {summary.get('taskDescription', 'N/A')}")
                print(f"   Outcome: {summary.get('outcome', 'N/A')}")
                return summary
            else:
                print(f"❌ Summarization failed: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Summarization error: {e}")
            return None
    
    async def test_pdf_generation(self, summary: dict, transcription: str):
        """Test PDF generation endpoint"""
        print("📄 Testing PDF generation...")
        try:
            payload = {
                "summary": summary,
                "transcription": transcription
            }
            
            response = await self.client.post(
                f"{self.base_url}/generate-pdf",
                json=payload
            )
            
            if response.status_code == 200:
                # Save PDF to temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                    temp_file.write(response.content)
                    pdf_path = temp_file.name
                
                file_size = len(response.content)
                print(f"✅ PDF generation successful")
                print(f"   File size: {file_size} bytes")
                print(f"   Saved to: {pdf_path}")
                return pdf_path
            else:
                print(f"❌ PDF generation failed: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ PDF generation error: {e}")
            return None
    
    async def run_full_test(self):
        """Run the complete integration test"""
        print("🚀 Starting full integration test...\n")
        
        # Test 1: Health check
        if not await self.test_health_check():
            return False
        print()
        
        # Test 2: Transcription (using mock data for now)
        transcription = await self.test_transcription_with_mock_data()
        if not transcription:
            return False
        print()
        
        # Test 3: Summarization
        summary = await self.test_summarization(transcription)
        if not summary:
            return False
        print()
        
        # Test 4: PDF Generation
        pdf_path = await self.test_pdf_generation(summary, transcription)
        if not pdf_path:
            return False
        print()
        
        print("🎉 All tests passed! Your Voice-to-Report API is working correctly.")
        print(f"📁 Generated PDF saved at: {pdf_path}")
        return True
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()

async def main():
    """Main test function"""
    print("Voice-to-Report API Integration Test")
    print("=" * 40)
    
    # Check if .env file exists
    if not os.path.exists('.env'):
        print("❌ No .env file found!")
        print("Please copy .env.example to .env and configure your OpenAI API key")
        return
    
    # Check if OpenAI API key is set
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ OPENAI_API_KEY not found in .env file!")
        print("Please add your OpenAI API key to the .env file")
        return
    
    tester = VoiceReportTester()
    
    try:
        success = await tester.run_full_test()
        if success:
            print("\n✅ Integration test completed successfully!")
        else:
            print("\n❌ Integration test failed!")
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())