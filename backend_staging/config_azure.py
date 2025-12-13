import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Azure-compatible configuration"""

    # Core settings
    openai_api_key: str
    environment: str = "development"

    # Server settings
    port: int = 8000
    debug: bool = False

    # Email settings (optional)
    email_user: str = ""
    email_password: str = ""
    email_recipients: str = ""
    smtp_server: str = "smtp.mail.yahoo.com"
    smtp_port: str = "587"
    smtp_ca_bundle: Optional[str] = None
    smtp_tls_insecure: bool = False
    bug_report_recipient: str = "colin.buchheit@beartechs.com"

    # GPT settings
    gpt_model: str = "gpt-5"
    gpt_max_tokens: int = 500
    gpt_temperature: float = 0.3

    # Audio settings
    max_audio_size_mb: int = 25
    supported_audio_formats: str = "m4a,mp4,wav,mp3,webm"

    # CORS settings
    allowed_origins: str = "*"

    class Config:
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Azure Key Vault integration
        if os.getenv('WEBSITE_INSTANCE_ID'):  # Running on Azure
            self._load_from_azure_key_vault()

    def _load_from_azure_key_vault(self):
        """Load secrets from Azure Key Vault when running on Azure"""
        try:
            from azure.identity import DefaultAzureCredential  # type: ignore
            from azure.keyvault.secrets import SecretClient  # type: ignore

            vault_url = os.getenv('KEY_VAULT_URL')
            if not vault_url:
                print("⚠️ KEY_VAULT_URL not set, using environment variables")
                return

            credential = DefaultAzureCredential()
            client = SecretClient(vault_url=vault_url, credential=credential)

            # Load OpenAI API key from Key Vault
            try:
                secret = client.get_secret("OPENAI-API-KEY")
                self.openai_api_key = secret.value
                print("✅ Loaded OPENAI_API_KEY from Azure Key Vault")
            except Exception as e:
                print(f"⚠️ Could not load OPENAI-API-KEY from Key Vault: {e}")

        except ImportError:
            print("⚠️ Azure SDK not installed, using environment variables")
        except Exception as e:
            print(f"⚠️ Error accessing Key Vault: {e}")


# Create global settings instance
settings = Settings()
