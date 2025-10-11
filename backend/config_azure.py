import os
from typing import Optional
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Azure-compatible configuration"""

    # Core settings
    openai_api_key: Optional[SecretStr] = None
    environment: str = "development"

    # Server settings
    port: int = 8000
    debug: bool = False
    log_level: str = "INFO"

    # Email settings (optional)
    email_user: str = ""
    email_password: Optional[SecretStr] = None
    email_recipients: str = "colbol42@gmail.com"
    smtp_server: str = "smtp.mail.yahoo.com"
    smtp_port: str = "587"
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

    # Pydantic v2 settings config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
        case_sensitive=False,
        extra="ignore",
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Azure Key Vault integration
        if os.getenv('WEBSITE_INSTANCE_ID'):  # Running on Azure
            self._load_from_azure_key_vault()

    def _load_from_azure_key_vault(self):
        """Load secrets from Azure Key Vault when running on Azure"""
        try:
            from azure.identity import DefaultAzureCredential
            from azure.keyvault.secrets import SecretClient

            vault_url = os.getenv('KEY_VAULT_URL')
            if not vault_url:
                print("⚠️ KEY_VAULT_URL not set, using environment variables")
                return

            credential = DefaultAzureCredential()
            client = SecretClient(vault_url=vault_url, credential=credential)

            # Load OpenAI API key from Key Vault
            try:
                secret = client.get_secret("OPENAI-API-KEY")
                # store as plain string if SecretStr not convenient in Azure context
                self.openai_api_key = SecretStr(secret.value)
                print("✅ Loaded OPENAI_API_KEY from Azure Key Vault")
            except Exception as e:
                print(f"⚠️ Could not load OPENAI-API-KEY from Key Vault: {e}")

        except ImportError:
            print("⚠️ Azure SDK not installed, using environment variables")
        except Exception as e:
            print(f"⚠️ Error accessing Key Vault: {e}")


# Create global settings instance
settings = Settings()
