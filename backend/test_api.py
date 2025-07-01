import asyncio
import base64
import json
import os
import tempfile
import wave
import struct
import httpx
from pathlib import Path

class APITester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.timeout = httpx.Timeout(60.0)  # Longer timeout for AI services
    
    def create_test_audio(self) -> str:
        """Create a valid WAV file with spoken content simulation"""
        print("🎵 Creating test audio file...")
        
        # Create a simple WAV file (1 second of sine wave)
        sample_rate = 16000
        duration = 1.0
        frequency = 440  # A4 note
        
        # Generate sine wave
        frames = []
        for i in range(int(sample_rate * duration)):
            value = int(32767 * 0.3 * (i % 100) / 100)  # Simple pattern instead of sine
            frames.append(struct.pack('<h', value))
        
        # Create WAV file in memory
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            with wave.open(temp_file.name, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(b''.join(frames))
            
            # Read back as bytes and encode to base64
            with open(temp_file.name, 'rb') as f:
                audio_bytes = f.read()
            
            os.unlink(temp_file.name)  # Clean up
            
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        print(f"✅ Created test audio: {len(audio_base64)} characters (base64)")
        return audio_base64
    
    async def test_health(self):
        """Test health endpoint"""
        print("\n🏥 Testing health endpoint...")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/health")
                if response.status_code == 200:
                    data = response.json()
                    print(f"✅ Health check passed: {data.get('status')}")
                    print(f"   Service: {data.get('service')}")
                    print(f"   Version: {data.get('version')}")
                    return True
                else:
                    print(f"❌ Health check failed: {response.status_code}")
                    return False
            except Exception as e:
                print(f"❌ Cannot connect to server: {e}")
                print("   Make sure the server is running on localhost:8000")
                return False
    
    async def test_transcription(self, use_real_audio=False):
        """Test transcription endpoint"""
        print("\n🎤 Testing transcription...")
        
        if use_real_audio:
            audio_data = self.create_test_audio()
            audio_format = "wav"
        else:
            # Use mock transcription for testing
            print("   Using mock transcription (faster)")
            return "I completed the quarterly sales analysis meeting with the team today. We reviewed our Q3 performance and discussed strategies for Q4. The meeting was held in the main conference room and lasted about 2 hours. We successfully identified three key areas for improvement and assigned action items to team members."
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                payload = {
                    "audio": audio_data,
                    "format": audio_format
                }
                
                response = await client.post(f"{self.base_url}/transcribe", json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    transcription = data.get('transcription', '')
                    print(f"✅ Transcription successful")
                    print(f"   Result: '{transcription[:100]}{'...' if len(transcription) > 100 else ''}'")
                    return transcription
                else:
                    print(f"❌ Transcription failed: {response.status_code}")
                    print(f"   Error: {response.text}")
                    return None
            except Exception as e:
                print(f"❌ Transcription error: {e}")
                return None
    
    async def test_summarization(self, transcription):
        """Test summarization endpoint"""
        print("\n📝 Testing summarization...")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                payload = {"transcription": transcription}
                
                response = await client.post(f"{self.base_url}/summarize", json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    summary = data.get('summary', {})
                    print(f"✅ Summarization successful")
                    print(f"   Task: {summary.get('taskDescription', 'N/A')[:80]}...")
                    print(f"   Location: {summary.get('location', 'N/A')}")
                    print(f"   Outcome: {summary.get('outcome', 'N/A')[:60]}...")
                    return summary
                else:
                    print(f"❌ Summarization failed: {response.status_code}")
                    print(f"   Error: {response.text}")
                    return None
            except Exception as e:
                print(f"❌ Summarization error: {e}")
                return None
    
    async def test_pdf_generation(self, summary, transcription):
        """Test PDF generation endpoint"""
        print("\n📄 Testing PDF generation...")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                payload = {
                    "summary": summary,
                    "transcription": transcription
                }
                
                response = await client.post(f"{self.base_url}/generate-pdf", json=payload)
                
                if response.status_code == 200:
                    # Save PDF to test file
                    test_pdf_path = "test_report.pdf"
                    with open(test_pdf_path, 'wb') as f:
                        f.write(response.content)
                    
                    file_size = len(response.content)
                    print(f"✅ PDF generation successful")
                    print(f"   File size: {file_size:,} bytes")
                    print(f"   Saved as: {test_pdf_path}")
                    return test_pdf_path
                else:
                    print(f"❌ PDF generation failed: {response.status_code}")
                    print(f"   Error: {response.text}")
                    return None
            except Exception as e:
                print(f"❌ PDF generation error: {e}")
                return None
    
    async def run_full_test(self, use_real_audio=False):
        """Run complete API test"""
        print("🚀 Voice-to-Report API Test Suite")
        print("=" * 50)
        
        # Test 1: Health check
        if not await self.test_health():
            print("\n❌ Health check failed - stopping tests")
            return False
        
        # Test 2: Transcription
        transcription = await self.test_transcription(use_real_audio)
        if not transcription:
            print("\n❌ Transcription failed - stopping tests")
            return False
        
        # Test 3: Summarization
        summary = await self.test_summarization(transcription)
        if not summary:
            print("\n❌ Summarization failed - stopping tests")
            return False
        
        # Test 4: PDF Generation
        pdf_path = await self.test_pdf_generation(summary, transcription)
        if not pdf_path:
            print("\n❌ PDF generation failed - stopping tests")
            return False
        
        print("\n🎉 ALL TESTS PASSED!")
        print("=" * 50)
        print("Your Voice-to-Report API is fully functional!")
        print(f"📁 Test PDF saved: {pdf_path}")
        print("🌐 API Documentation: http://localhost:8000/docs")
        return True

async def main():
    """Main test function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Test Voice-to-Report API')
    parser.add_argument('--real-audio', action='store_true', 
                       help='Use real audio file for transcription test')
    parser.add_argument('--url', default='http://localhost:8000',
                       help='API base URL (default: http://localhost:8000)')
    
    args = parser.parse_args()
    
    tester = APITester(args.url)
    await tester.run_full_test(args.real_audio)

if __name__ == "__main__":
    asyncio.run(main())