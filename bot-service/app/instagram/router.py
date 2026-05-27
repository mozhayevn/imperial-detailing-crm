import logging

from fastapi import APIRouter, Query, Request

from app.instagram.schemas import InstagramWebhookPayload
from app.instagram.verification import verify_instagram_webhook_token


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/instagram", tags=["Instagram"])


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    return verify_instagram_webhook_token(
        mode=hub_mode,
        token=hub_verify_token,
        challenge=hub_challenge,
    )


@router.post("/webhook")
async def receive_webhook(
    payload: InstagramWebhookPayload,
    request: Request,
):
    events_count = sum(len(entry.messaging) for entry in payload.entry)

    logger.info(
        "Received Instagram webhook. object=%s entries=%s events=%s",
        payload.object,
        len(payload.entry),
        events_count,
    )

    for entry in payload.entry:
        for event in entry.messaging:
            sender_id = event.sender.id
            text = event.message.text if event.message else None

            logger.info(
                "Instagram message received. sender_id=%s has_text=%s",
                sender_id,
                bool(text),
            )

    return {"status": "ok"}