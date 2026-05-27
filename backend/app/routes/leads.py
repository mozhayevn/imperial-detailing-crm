import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import (
    Car,
    CarType,
    Client,
    Lead,
    LeadAuditLog,
    LeadContact,
    LeadItem,
    MaterialBrand,
    Order,
    OrderAuditLog,
    OrderItem,
    OrderStatusHistory,
    Service,
    ServicePackage,
    User,
    WorkBay,
)
from app.schemas import (
    LeadConfirmRequest,
    LeadConfirmResponse,
    LeadCreate,
    LeadMatchesResponse,
    LeadResponse,
    LeadStatusUpdate,
    LeadUpdate,
    LeadAuditLogResponse,
    LeadContactResponse,
)

router = APIRouter(prefix="/leads", tags=["Leads"])

LEAD_STATUSES = {
    "new",
    "in_review",
    "confirmed",
    "rejected",
    "duplicate",
}


def normalize_phone(phone: str) -> str:
    return phone.strip()


def write_lead_audit_log(
    db: Session,
    lead_id: int,
    action: str,
    actor_user_id: int | None = None,
    details: dict | None = None,
) -> LeadAuditLog:
    audit_log = LeadAuditLog(
        lead_id=lead_id,
        actor_user_id=actor_user_id,
        action=action,
        details=json.dumps(details or {}, ensure_ascii=False),
    )

    db.add(audit_log)
    return audit_log


def get_or_create_lead_contact(
    db: Session,
    phone: str,
    full_name: str | None,
    source: str,
    external_user_id: str | None = None,
    external_username: str | None = None,
) -> LeadContact:
    normalized_phone = normalize_phone(phone)

    query = db.query(LeadContact)

    if external_user_id:
        existing_contact = (
            query.filter(
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


def validate_lead_item_references(
    db: Session,
    service_id: int | None = None,
    material_brand_id: int | None = None,
    service_package_id: int | None = None,
) -> None:
    if service_id is not None:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        if not service.is_active:
            raise HTTPException(status_code=400, detail="Service is archived")

    if material_brand_id is not None:
        material_brand = (
            db.query(MaterialBrand)
            .filter(MaterialBrand.id == material_brand_id)
            .first()
        )
        if not material_brand:
            raise HTTPException(status_code=404, detail="Material brand not found")

    if service_package_id is not None:
        service_package = (
            db.query(ServicePackage)
            .filter(ServicePackage.id == service_package_id)
            .first()
        )
        if not service_package:
            raise HTTPException(status_code=404, detail="Service package not found")

        if not service_package.is_active:
            raise HTTPException(status_code=400, detail="Service package is archived")


def replace_lead_items(
    db: Session,
    lead: Lead,
    items_data: list,
) -> None:
    db.query(LeadItem).filter(LeadItem.lead_id == lead.id).delete()

    for item_data in items_data:
        validate_lead_item_references(
            db=db,
            service_id=item_data.service_id,
            material_brand_id=item_data.material_brand_id,
            service_package_id=item_data.service_package_id,
        )

        if item_data.service_id is None and not item_data.service_name_text:
            raise HTTPException(
                status_code=400,
                detail="Lead item must have service_id or service_name_text",
            )

        quantity = item_data.quantity or 1

        if quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Lead item quantity must be greater than 0",
            )

        lead_item = LeadItem(
            lead_id=lead.id,
            service_id=item_data.service_id,
            service_name_text=item_data.service_name_text,
            material_brand_id=item_data.material_brand_id,
            service_package_id=item_data.service_package_id,
            quantity=quantity,
            comment=item_data.comment,
        )

        db.add(lead_item)


def get_lead_or_404(db: Session, lead_id: int) -> Lead:
    lead = (
        db.query(Lead)
        .options(
            joinedload(Lead.lead_contact),
            joinedload(Lead.assigned_user),
            joinedload(Lead.reviewed_by_user),
            joinedload(Lead.items).joinedload(LeadItem.service),
            joinedload(Lead.items).joinedload(LeadItem.material_brand),
            joinedload(Lead.items).joinedload(LeadItem.service_package),
        )
        .filter(Lead.id == lead_id)
        .first()
    )

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    return lead


def build_order_comment_from_lead(
    lead: Lead,
    extra_comment: str | None = None,
) -> str:
    parts = [
        f"Создано из заявки #{lead.id}.",
    ]

    if lead.source:
        parts.append(f"Источник: {lead.source}.")

    if lead.message:
        parts.append(f"Сообщение клиента: {lead.message}")

    if lead.comment:
        parts.append(f"Комментарий заявки: {lead.comment}")

    if extra_comment:
        parts.append(f"Комментарий при подтверждении: {extra_comment}")

    return "\n".join(parts)


@router.get("", response_model=list[LeadResponse])
def get_leads(
    status: str | None = Query(None),
    source: str | None = Query(None),
    phone: str | None = Query(None),
    assigned_user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    query = (
        db.query(Lead)
        .options(
            joinedload(Lead.lead_contact),
            joinedload(Lead.assigned_user),
            joinedload(Lead.reviewed_by_user),
            joinedload(Lead.items).joinedload(LeadItem.service),
            joinedload(Lead.items).joinedload(LeadItem.material_brand),
            joinedload(Lead.items).joinedload(LeadItem.service_package),
        )
    )

    if status:
        query = query.filter(Lead.status == status)

    if source:
        query = query.filter(Lead.source == source)

    if phone:
        query = query.filter(Lead.phone.ilike(f"%{phone}%"))

    if assigned_user_id:
        query = query.filter(Lead.assigned_user_id == assigned_user_id)

    return query.order_by(Lead.created_at.desc()).all()


@router.post("", response_model=LeadResponse)
def create_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.manage")),
):
    normalized_phone = normalize_phone(data.phone)

    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Phone is required")

    lead_contact = get_or_create_lead_contact(
        db=db,
        phone=normalized_phone,
        full_name=data.client_name,
        source=data.source,
        external_user_id=data.external_user_id,
        external_username=data.external_username,
    )

    lead = Lead(
        lead_contact_id=lead_contact.id,
        source=data.source,
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

    replace_lead_items(db=db, lead=lead, items_data=data.items)

    write_lead_audit_log(
        db=db,
        lead_id=lead.id,
        actor_user_id=current_user.id,
        action="lead_created",
        details={
            "message": "Заявка создана вручную в CRM",
            "source": data.source,
            "phone": normalized_phone,
        },
    )

    db.commit()

    return get_lead_or_404(db, lead.id)


@router.get("/contacts", response_model=list[LeadContactResponse])
def get_lead_contacts(
    phone: str | None = Query(None),
    source: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    query = db.query(LeadContact)

    if phone:
        query = query.filter(LeadContact.phone.ilike(f"%{phone}%"))

    if source:
        query = query.filter(LeadContact.source == source)

    return query.order_by(LeadContact.created_at.desc()).all()


@router.get("/contacts/{lead_contact_id}", response_model=LeadContactResponse)
def get_lead_contact(
    lead_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    lead_contact = (
        db.query(LeadContact)
        .filter(LeadContact.id == lead_contact_id)
        .first()
    )

    if not lead_contact:
        raise HTTPException(status_code=404, detail="Lead contact not found")

    return lead_contact


@router.get("/contacts/{lead_contact_id}/leads", response_model=list[LeadResponse])
def get_lead_contact_leads(
    lead_contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    lead_contact = (
        db.query(LeadContact)
        .filter(LeadContact.id == lead_contact_id)
        .first()
    )

    if not lead_contact:
        raise HTTPException(status_code=404, detail="Lead contact not found")

    return (
        db.query(Lead)
        .options(
            joinedload(Lead.lead_contact),
            joinedload(Lead.assigned_user),
            joinedload(Lead.reviewed_by_user),
            joinedload(Lead.items).joinedload(LeadItem.service),
            joinedload(Lead.items).joinedload(LeadItem.material_brand),
            joinedload(Lead.items).joinedload(LeadItem.service_package),
        )
        .filter(Lead.lead_contact_id == lead_contact_id)
        .order_by(Lead.created_at.desc())
        .all()
    )


@router.post("/{lead_id}/confirm", response_model=LeadConfirmResponse)
def confirm_lead(
    lead_id: int,
    data: LeadConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.confirm")),
):
    lead = get_lead_or_404(db, lead_id)

    if lead.status == "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Lead is already confirmed",
        )

    if lead.created_order_id:
        raise HTTPException(
            status_code=400,
            detail="Lead already has created order",
        )

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="At least one order item is required",
        )

    client = None

    if data.client_id is not None:
        client = db.query(Client).filter(Client.id == data.client_id).first()

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
    else:
        phone = (data.phone or lead.phone or "").strip()
        client_name = (data.client_name or lead.client_name or "").strip()

        if not phone:
            raise HTTPException(status_code=400, detail="Phone is required")

        if not client_name:
            raise HTTPException(status_code=400, detail="Client name is required")

        # 1. Телефон заявки — главный идентификатор настоящего CRM-клиента.
        client = db.query(Client).filter(Client.phone == phone).first()

        # 2. Старую связь LeadContact -> Client используем только если телефон совпадает.
        if client is None and lead.lead_contact and lead.lead_contact.created_client_id:
            linked_client = (
                db.query(Client)
                .filter(Client.id == lead.lead_contact.created_client_id)
                .first()
            )

            if linked_client and linked_client.phone == phone:
                client = linked_client

        # 3. Если клиента нет — создаем нового.
        if client is None:
            client = Client(
                full_name=client_name,
                phone=phone,
                preferences="Создано из входящей заявки",
            )
            db.add(client)
            db.flush()

    if client.phone != (data.phone or lead.phone or "").strip():
        write_lead_audit_log(
            db=db,
            lead_id=lead.id,
            actor_user_id=current_user.id,
            action="lead_client_phone_mismatch",
            details={
                "message": "Заявка привязана к клиенту по контакту заявки, но телефон в заявке отличается от телефона клиента CRM",
                "client_id": client.id,
                "client_phone": client.phone,
                "lead_phone": (data.phone or lead.phone or "").strip(),
            },
        )

    car = None

    if data.car_id is not None:
        car = db.query(Car).filter(Car.id == data.car_id).first()

        if not car:
            raise HTTPException(status_code=404, detail="Car not found")

        if car.client_id != client.id:
            raise HTTPException(
                status_code=400,
                detail="Selected car does not belong to selected client",
            )
    else:
        car_brand = (data.car_brand or lead.car_brand or "").strip()
        car_model = (data.car_model or lead.car_model or "").strip()
        plate_number = (data.plate_number or lead.plate_number or "").strip() or None

        if not car_brand:
            raise HTTPException(status_code=400, detail="Car brand is required")

        if not car_model:
            raise HTTPException(status_code=400, detail="Car model is required")

        if data.car_type_id is not None:
            car_type = db.query(CarType).filter(CarType.id == data.car_type_id).first()

            if not car_type:
                raise HTTPException(status_code=404, detail="Car type not found")

        if plate_number:
            existing_car = db.query(Car).filter(Car.plate_number == plate_number).first()

            if existing_car:
                if existing_car.client_id != client.id:
                    raise HTTPException(
                        status_code=400,
                        detail="Car with this plate number belongs to another client",
                    )

                car = existing_car

        if car is None:
            car = Car(
                client_id=client.id,
                car_type_id=data.car_type_id,
                brand=car_brand,
                model=car_model,
                year=data.car_year if data.car_year is not None else lead.car_year,
                color=data.car_color if data.car_color is not None else lead.car_color,
                plate_number=plate_number,
            )
            db.add(car)
            db.flush()

    if data.assigned_user_id is not None:
        assigned_user = db.query(User).filter(User.id == data.assigned_user_id).first()

        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")

    if data.work_bay_id is not None:
        work_bay = db.query(WorkBay).filter(WorkBay.id == data.work_bay_id).first()

        if not work_bay:
            raise HTTPException(status_code=404, detail="Work bay not found")

    order = Order(
        client_id=client.id,
        car_id=car.id,
        assigned_user_id=data.assigned_user_id,
        work_bay_id=data.work_bay_id,
        status="new",
        scheduled_at=data.scheduled_at,
        planned_start_at=data.planned_start_at,
        planned_end_at=data.planned_end_at,
        comment=build_order_comment_from_lead(lead, data.comment),
        total_price=0,
    )

    db.add(order)
    db.flush()

    for item_data in data.items:
        service = db.query(Service).filter(Service.id == item_data.service_id).first()

        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        if not service.is_active:
            raise HTTPException(status_code=400, detail="Service is archived")

        if item_data.material_brand_id is not None:
            material_brand = (
                db.query(MaterialBrand)
                .filter(MaterialBrand.id == item_data.material_brand_id)
                .first()
            )

            if not material_brand:
                raise HTTPException(status_code=404, detail="Material brand not found")

        if item_data.service_package_id is not None:
            service_package = (
                db.query(ServicePackage)
                .filter(ServicePackage.id == item_data.service_package_id)
                .first()
            )

            if not service_package:
                raise HTTPException(status_code=404, detail="Service package not found")

            if not service_package.is_active:
                raise HTTPException(status_code=400, detail="Service package is archived")

        quantity = item_data.quantity or 1

        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

        order_item = OrderItem(
            order_id=order.id,
            service_id=item_data.service_id,
            material_brand_id=item_data.material_brand_id,
            service_package_id=item_data.service_package_id,
            price=0,
            quantity=quantity,
            discount_amount=0,
            discount_percent=item_data.discount_percent or 0,
            discount_reason=item_data.discount_reason,
            discount_applied_by_user_id=current_user.id
            if item_data.discount_percent and item_data.discount_percent > 0
            else None,
            total=0,
            base_cost_snapshot=0,
            gross_price_snapshot=0,
            discount_amount_snapshot=0,
            final_price_snapshot=0,
            profit_snapshot=0,
        )

        db.add(order_item)

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            old_status=None,
            new_status="new",
        )
    )

    db.add(
        OrderAuditLog(
            order_id=order.id,
            actor_user_id=current_user.id,
            action="created_from_lead",
            details=f"Order #{order.id} created from lead #{lead.id}",
        )
    )

    lead.status = "confirmed"
    lead.reviewed_by_user_id = current_user.id
    lead.reviewed_at = datetime.utcnow()
    lead.updated_at = datetime.utcnow()
    lead.created_client_id = client.id
    lead.created_car_id = car.id
    lead.created_order_id = order.id

    if lead.lead_contact:
        lead.lead_contact.created_client_id = client.id
        lead.lead_contact.updated_at = datetime.utcnow()

    write_lead_audit_log(
        db=db,
        lead_id=lead.id,
        actor_user_id=current_user.id,
        action="lead_confirmed",
        details={
            "message": "Заявка подтверждена, создан заказ",
            "client_id": client.id,
            "car_id": car.id,
            "order_id": order.id,
        },
    )

    db.commit()

    return LeadConfirmResponse(
        lead=get_lead_or_404(db, lead.id),
        order=order,
    )


@router.get("/{lead_id}/matches", response_model=LeadMatchesResponse)
def get_lead_matches(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    existing_client = None

    if lead.phone:
        existing_client = (
            db.query(Client)
            .filter(Client.phone == lead.phone)
            .first()
        )

    existing_car = None

    if lead.plate_number:
        existing_car = (
            db.query(Car)
            .filter(Car.plate_number == lead.plate_number)
            .first()
        )

    active_duplicate_lead_ids = [
        row[0]
        for row in (
            db.query(Lead.id)
            .filter(
                Lead.id != lead.id,
                Lead.phone == lead.phone,
                Lead.status.in_(["new", "in_review"]),
            )
            .order_by(Lead.created_at.desc())
            .all()
        )
    ]

    existing_car_label = None

    if existing_car:
        existing_car_label = " ".join(
            part
            for part in [
                existing_car.brand,
                existing_car.model,
                str(existing_car.year) if existing_car.year else None,
                existing_car.plate_number,
            ]
            if part
        )

    return LeadMatchesResponse(
        existing_client_id=existing_client.id if existing_client else None,
        existing_client_full_name=(
            existing_client.full_name if existing_client else None
        ),
        existing_car_id=existing_car.id if existing_car else None,
        existing_car_label=existing_car_label,
        existing_car_client_id=existing_car.client_id if existing_car else None,
        active_duplicate_lead_ids=active_duplicate_lead_ids,
    )


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    return get_lead_or_404(db, lead_id)


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.manage")),
):
    lead = get_lead_or_404(db, lead_id)

    if lead.status == "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Confirmed lead cannot be edited",
        )

    update_data = data.model_dump(exclude_unset=True, exclude={"items"})

    if "phone" in update_data and update_data["phone"]:
        update_data["phone"] = normalize_phone(update_data["phone"])

    for key, value in update_data.items():
        setattr(lead, key, value)

    if data.assigned_user_id is not None:
        assigned_user = (
            db.query(User)
            .filter(User.id == data.assigned_user_id)
            .first()
        )

        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")

    if data.items is not None:
        replace_lead_items(db=db, lead=lead, items_data=data.items)

    lead.updated_at = datetime.utcnow()

    write_lead_audit_log(
        db=db,
        lead_id=lead.id,
        actor_user_id=current_user.id,
        action="lead_updated",
        details={
            "message": "Заявка обновлена",
        },
    )

    db.commit()

    return get_lead_or_404(db, lead.id)


@router.patch("/{lead_id}/status", response_model=LeadResponse)
def update_lead_status(
    lead_id: int,
    data: LeadStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.manage")),
):
    lead = get_lead_or_404(db, lead_id)

    if data.status not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid lead status")

    if lead.status == "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Confirmed lead status cannot be changed",
        )

    old_status = lead.status
    lead.status = data.status
    lead.reviewed_by_user_id = current_user.id
    lead.reviewed_at = datetime.utcnow()
    lead.updated_at = datetime.utcnow()

    write_lead_audit_log(
        db=db,
        lead_id=lead.id,
        actor_user_id=current_user.id,
        action="lead_status_changed",
        details={
            "old_status": old_status,
            "new_status": data.status,
            "comment": data.comment,
        },
    )

    db.commit()

    return get_lead_or_404(db, lead.id)


@router.get("/{lead_id}/audit-logs", response_model=list[LeadAuditLogResponse])
def get_lead_audit_logs(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leads.read")),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    return (
        db.query(LeadAuditLog)
        .options(joinedload(LeadAuditLog.actor_user))
        .filter(LeadAuditLog.lead_id == lead_id)
        .order_by(LeadAuditLog.created_at.desc())
        .all()
    )