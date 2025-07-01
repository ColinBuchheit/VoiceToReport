import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def test_whisper():
    """Test Whisper API with a simple audio file"""
    try:
        # First, let's check if the API key is loaded
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("❌ ERROR: No API key found in .env file!")
            return
        
        print(f"✅ API Key loaded: sk-...{api_key[-4:]}")
        
        # Create a test audio file (or use an existing one)
        test_audio_path = "test_audio.m4a"
        
        if not os.path.exists(test_audio_path):
            print(f"❌ No test audio file found at {test_audio_path}")
            print("Please record a short audio clip with your phone and save it as test_audio.m4a")
            return
        
        print("📤 Sending audio to Whisper API...")
        
        # Call Whisper API
        with open(test_audio_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
        
        print("✅ Success! Transcription:")
        print("-" * 50)
        print(response)
        print("-" * 50)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print("\nCommon issues:")
        print("1. Invalid API key - check your .env file")
        print("2. No credits - add payment method at platform.openai.com")
        print("3. Network issues - check your connection")

if __name__ == "__main__":
    print("🎤 Testing OpenAI Whisper API...")
    test_whisper()

# ===================================
# Simple cURL test (alternative method)
# ===================================
"""
# You can also test with cURL directly:
# Replace YOUR_API_KEY with your actual key

curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@test_audio.m4a" \
  -F model="whisper-1"
"""