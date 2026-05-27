from fastapi import HTTPException

from app.config import settings


def verify_instagram_webhook_token(
    mode: str | None,
    token: str | None,
    challenge: str | None,
) -> str:
    if not settings.INSTAGRAM_VERIFY_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Instagram verify token is not configured",
        )

    if mode != "subscribe":
        raise HTTPException(status_code=403, detail="Invalid webhook mode")

    if token != settings.INSTAGRAM_VERIFY_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid verify token")

    if not challenge:
        raise HTTPException(status_code=400, detail="Missing challenge")

    return challenge