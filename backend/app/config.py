from pathlib import Path

from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    upstream_api_base_url: str = "https://api.openai.com/v1"
    upstream_api_key: str = ""
    upstream_model: str = ""  # Override model name when forwarding to upstream; empty = use client-provided model
    sqlite_path: str = str(_BACKEND_DIR / "data" / "agent_lens.db")
    server_host: str = "0.0.0.0"
    server_port: int = 8000

    model_config = {
        "env_file": str(_BACKEND_DIR / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()

# Ensure data directory exists
Path(settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
