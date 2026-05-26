import logging

import httpx

from app.common.schemas import LeadPayload
from app.config import settings


logger = logging.getLogger(__name__)


class CrmClientError(Exception):
    pass


def build_safe_error_message(response: httpx.Response) -> str:
    response_text = response.text

    if len(response_text) > 500:
        response_text = response_text[:500] + "..."

    return f"CRM returned {response.status_code}: {response_text}"


async def create_lead(payload: LeadPayload) -> dict:
    url = f"{settings.CRM_BASE_URL.rstrip('/')}/integrations/leads"

    headers = {
        "x-integration-token": settings.CRM_INTEGRATION_LEADS_TOKEN,
        "Content-Type": "application/json",
    }

    safe_context = {
        "source": payload.source,
        "external_user_id": payload.external_user_id,
        "external_username": payload.external_username,
        "has_phone": bool(payload.phone),
        "items_count": len(payload.items),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload.model_dump(),
            )
    except httpx.RequestError as error:
        logger.exception(
            "Failed to connect to CRM integrations endpoint. context=%s",
            safe_context,
        )
        raise CrmClientError("Failed to connect to CRM") from error

    if response.status_code >= 400:
        logger.error(
            "CRM integrations endpoint returned error. status_code=%s context=%s response=%s",
            response.status_code,
            safe_context,
            build_safe_error_message(response),
        )
        raise CrmClientError(build_safe_error_message(response))

    logger.info(
        "Lead successfully sent to CRM. context=%s",
        safe_context,
    )

    return response.json()