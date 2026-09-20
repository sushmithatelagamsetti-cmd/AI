from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://fraud_user:fraud_pass@localhost:5432/fraud_db"
    SYNC_DATABASE_URL: str = "postgresql://fraud_user:fraud_pass@localhost:5432/fraud_db"
    SECRET_KEY: str = "supersecretkey_change_in_production_32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    MODEL_PATH: str = "./trained_models"
    DATA_PATH: str = "./data/preprocessed_dataset.csv"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
