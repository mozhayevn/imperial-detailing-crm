import httpx

from app.common.schemas import LeadPayload
from app.config import settings


class CrmClientError(Exception):
    pass


async def create_lead(payload: LeadPayload) -> dict:
    url = f"{settings.CRM_BASE_URL.rstrip('/')}/integrations/leads"

    headers = {
        "x-integration-token": settings.CRM_INTEGRATION_LEADS_TOKEN,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            headers=headers,
            json=payload.model_dump(),
        )

    if response.status_code >= 400:
        raise CrmClientError(
            f"CRM returned {response.status_code}: {response.text}"
        )

    return response.json()