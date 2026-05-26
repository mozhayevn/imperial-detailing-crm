import json
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models import Lead, LeadAuditLog, LeadContact, LeadItem
from app.schemas import IntegrationLeadCreate, LeadResponse

router = APIRouter(prefix="/integrations", tags=["Integrations"])

ALLOWED_INTEGRATION_SOURCES = {
    "telegram",
    "whatsapp",
    "instagram",
    "website",
    "bot",
}


def normalize_phone(phone: str) -> str:
    return phone.strip()


def validate_integration_token(x_integration_token: str | None) -> None:
    if not settings.INTEGRATION_LEADS_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Integration leads token is not configured",
        )

    if not x_integration_token:
        raise HTTPException(
            status_code=401,
            detail="Integration token is required",
        )

    if x_integration_token != settings.INTEGRATION_LEADS_TOKEN:
        raise HTTPException(
            status_code=403,
            detail="Invalid integration token",
        )


def get_or_create_lead_contact(
    db: Session,
    phone: str,
    full_name: str | None,
    source: str,
    external_user_id: str | None = None,
    external_username: str | None = None,
) -> LeadContact:
    normalized_phone = normalize_phone(phone)

    if external_user_id:
        existing_contact = (
            db.query(LeadContact)
            .filter(
                LeadContact.source == source,
                LeadContact.external_user_id == external_user_id,
            )
            .first()
        )

        if existing_contact:
            if full_name and not existing_contact.full_name:
                existing_contact.full_name = full_name

            if external_username:
                existing_contact.external_username = external_username

            existing_contact.updated_at = datetime.utcnow()
            return existing_contact

    existing_contact = (
        db.query(LeadContact)
        .filter(LeadContact.phone == normalized_phone)
        .first()
    )

    if existing_contact:
        if full_name and not existing_contact.full_name:
            existing_contact.full_name = full_name

        if external_user_id and not existing_contact.external_user_id:
            existing_contact.external_user_id = external_user_id

        if external_username:
            existing_contact.external_username = external_username

        existing_contact.updated_at = datetime.utcnow()
        return existing_contact

    lead_contact = LeadContact(
        full_name=full_name,
        phone=normalized_phone,
        source=source,
        external_user_id=external_user_id,
        external_username=external_username,
    )

    db.add(lead_contact)
    db.flush()

    return lead_contact


def write_lead_audit_log(
    db: Session,
    lead_id: int,
    action: str,
    details: dict | None = None,
) -> LeadAuditLog:
    audit_log = LeadAuditLog(
        lead_id=lead_id,
        actor_user_id=None,
        action=action,
        details=json.dumps(details or {}, ensure_ascii=False),
    )

    db.add(audit_log)
    return audit_log


def get_lead_with_relations(db: Session, lead_id: int) -> Lead:
    return (
        db.query(Lead)
        .options(
            joinedload(Lead.lead_contact),
            joinedload(Lead.items).joinedload(LeadItem.service),
            joinedload(Lead.items).joinedload(LeadItem.material_brand),
            joinedload(Lead.items).joinedload(LeadItem.service_package),
        )
        .filter(Lead.id == lead_id)
        .first()
    )


@router.post("/leads", response_model=LeadResponse)
def create_integration_lead(
    data: IntegrationLeadCreate,
    db: Session = Depends(get_db),
    x_integration_token: str | None = Header(None),
):
    validate_integration_token(x_integration_token)

    source = data.source.strip().lower()
    normalized_phone = normalize_phone(data.phone)

    if source not in ALLOWED_INTEGRATION_SOURCES:
        raise HTTPException(
            status_code=400,
            detail="Invalid integration source",
        )

    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Phone is required")

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="At least one lead item is required",
        )

    lead_contact = get_or_create_lead_contact(
        db=db,
        phone=normalized_phone,
        full_name=data.client_name,
        source=source,
        external_user_id=data.external_user_id,
        external_username=data.external_username,
    )

    lead = Lead(
        lead_contact_id=lead_contact.id,
        source=source,
        status="new",
        client_name=data.client_name,
        phone=normalized_phone,
        message=data.message,
        car_brand=data.car_brand,
        car_model=data.car_model,
        car_year=data.car_year,
        car_color=data.car_color,
        plate_number=data.plate_number,
        preferred_date=data.preferred_date,
        preferred_time=data.preferred_time,
        comment=data.comment,
    )

    db.add(lead)
    db.flush()

    for item_data in data.items:
        service_name_text = item_data.service_name_text.strip()

        if not service_name_text:
            raise HTTPException(
                status_code=400,
                detail="Lead item service_name_text is required",
            )

        quantity = item_data.quantity or 1

        if quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Lead item quantity must be greater than 0",
            )

        db.add(
            LeadItem(
                lead_id=lead.id,
                service_id=None,
                service_name_text=service_name_text,
                material_brand_id=None,
                service_package_id=None,
                quantity=quantity,
                comment=item_data.comment,
            )
        )

    write_lead_audit_log(
        db=db,
        lead_id=lead.id,
        action="lead_created_from_integration",
        details={
            "message": "Заявка создана через интеграцию",
            "source": source,
            "phone": normalized_phone,
            "external_user_id": data.external_user_id,
            "external_username": data.external_username,
        },
    )

    db.commit()

    created_lead = get_lead_with_relations(db, lead.id)

    return created_lead