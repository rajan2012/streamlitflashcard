"""Application configuration.

All secrets and the S3 file location are read from environment variables
(or a local .env file). Nothing sensitive is ever hard-coded.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- AWS credentials ---
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_default_region: str = "eu-central-1"

    # --- Where your CSV lives in S3 ---
    # Example: s3_bucket="my-vocab-bucket", s3_key="decks/german.csv"
    s3_bucket: str
    s3_key: str

    # --- CSV column names (change here if your headers differ) ---
    german_column: str = "german"
    english_column: str = "english"

    # How long (seconds) to keep the downloaded CSV cached in memory
    # before re-fetching it from S3. Set to 0 to always re-fetch.
    cache_ttl_seconds: int = 600

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (parsed once per process)."""
    return Settings()
