from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    TELEGRAM_BOT_TOKEN: str

    CRM_BASE_URL: str = "http://127.0.0.1:8000"
    CRM_FRONTEND_URL: str = "http://localhost:3000"
    CRM_INTEGRATION_LEADS_TOKEN: str

    BOT_SOURCE: str = "telegram"

    MANAGER_CHAT_ID: int | None = None
    LEAVE_UNKNOWN_GROUPS: bool = True

    class Config:
        env_file = ".env"


settings = Settings()