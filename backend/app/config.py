from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "Imperial CRM"
    SMTP_USE_TLS: bool = True

    class Config:
        env_file = ".env"


ADMIN_MAX_DISCOUNT_PERCENT = 20
MANAGER_MAX_DISCOUNT_PERCENT = 10

settings = Settings()
