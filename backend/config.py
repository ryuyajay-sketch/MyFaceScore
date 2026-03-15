from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None
    anthropic_api_key: str
    allowed_origins: str = "http://localhost:3000"
    max_upload_size_mb: int = 10
    analysis_timeout_seconds: int = 45
    storage_mode: str = "local"  # "local" or "supabase"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
