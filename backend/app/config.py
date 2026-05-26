from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql://nadirmozhayev@localhost:5432/detailing_crm"

    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    FRONTEND_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str | None = None

    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 15 * 60
    LOGIN_RATE_LIMIT_BLOCK_SECONDS: int = 15 * 60

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "Imperial CRM"
    SMTP_USE_TLS: bool = True
    INTEGRATION_LEADS_TOKEN: str | None = None

    class Config:
        env_file = ".env"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def frontend_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.FRONTEND_ORIGINS.split(",")
            if origin.strip()
        ]


ADMIN_MAX_DISCOUNT_PERCENT = 20
MANAGER_MAX_DISCOUNT_PERCENT = 10

settings = Settings()
