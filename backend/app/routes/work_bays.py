from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import WorkBay, User, Order
from app.schemas import (
    WorkBayCreate,
    WorkBayUpdate,
    WorkBayResponse,
    WorkBayAvailabilityResponse,
    WorkBayScheduleBayResponse,
    WorkBayScheduleOrderResponse,
    WorkBayScheduleResponse,
)
from datetime import datetime, date, time

router = APIRouter(prefix="/work-bays", tags=["Work Bays"])


def build_schedule_order_response(order: Order) -> WorkBayScheduleOrderResponse:
    client_name = order.client.full_name if order.client else None

    car_label = None
    if order.car:
        car_label = " ".join(
            part
            for part in [
                order.car.brand,
                order.car.model,
                str(order.car.year) if order.car.year else None,
            ]
            if part
        )

    return WorkBayScheduleOrderResponse(
        id=order.id,
        client_id=order.client_id,
        car_id=order.car_id,
        work_bay_id=order.work_bay_id,
        client_name=client_name,
        car_label=car_label,
        status=order.status,
        planned_start_at=order.planned_start_at,
        planned_end_at=order.planned_end_at,
        total_price=order.total_price,
    )


@router.post("/", response_model=WorkBayResponse)
def create_work_bay(
    data: WorkBayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.manage")),
):
    existing = db.query(WorkBay).filter(WorkBay.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Work bay already exists")

    bay = WorkBay(
        name=data.name,
        description=data.description,
    )

    db.add(bay)
    db.commit()
    db.refresh(bay)
    return bay


@router.get("/", response_model=list[WorkBayResponse])
def get_work_bays(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.read")),
):
    return db.query(WorkBay).order_by(WorkBay.id.desc()).all()


@router.get("/available", response_model=list[WorkBayAvailabilityResponse])
def get_available_work_bays(
    planned_start_at: datetime = Query(...),
    planned_end_at: datetime = Query(...),
    exclude_order_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.read")),
):
    if planned_start_at >= planned_end_at:
        raise HTTPException(status_code=400, detail="planned_end_at must be greater than planned_start_at")

    bays = db.query(WorkBay).order_by(WorkBay.id.asc()).all()
    result = []

    for bay in bays:
        query = db.query(Order).filter(
            Order.work_bay_id == bay.id,
            Order.planned_start_at.isnot(None),
            Order.planned_end_at.isnot(None),
            Order.status != "canceled",
            Order.status != "delivered",
            Order.planned_start_at < planned_end_at,
            Order.planned_end_at > planned_start_at,
        )

        if exclude_order_id is not None:
            query = query.filter(Order.id != exclude_order_id)

        conflict = query.first()

        result.append(
            WorkBayAvailabilityResponse(
                id=bay.id,
                name=bay.name,
                description=bay.description,
                is_available=conflict is None,
                conflicting_order_id=conflict.id if conflict else None,
            )
        )

    return result


@router.get("/schedule", response_model=WorkBayScheduleResponse)
def get_work_bays_schedule(
    schedule_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.read")),
):
    day_start = datetime.combine(schedule_date, time.min)
    day_end = datetime.combine(schedule_date, time.max)

    bays = (
        db.query(WorkBay)
        .filter(WorkBay.is_active.is_(True))
        .order_by(WorkBay.id.asc())
        .all()
    )

    orders = (
        db.query(Order)
        .options(
            joinedload(Order.client),
            joinedload(Order.car),
            joinedload(Order.work_bay),
        )
        .filter(
            Order.planned_start_at.isnot(None),
            Order.planned_end_at.isnot(None),
            Order.planned_start_at < day_end,
            Order.planned_end_at > day_start,
            Order.status != "canceled",
            Order.status != "delivered",
        )
        .order_by(Order.planned_start_at.asc())
        .all()
    )

    orders_by_bay_id: dict[int, list[Order]] = {}

    unscheduled_orders: list[Order] = []

    for order in orders:
        if order.work_bay_id is None:
            unscheduled_orders.append(order)
            continue

        orders_by_bay_id.setdefault(order.work_bay_id, []).append(order)

    return WorkBayScheduleResponse(
        date=schedule_date,
        bays=[
            WorkBayScheduleBayResponse(
                id=bay.id,
                name=bay.name,
                description=bay.description,
                orders=[
                    build_schedule_order_response(order)
                    for order in orders_by_bay_id.get(bay.id, [])
                ],
            )
            for bay in bays
        ],
        unscheduled_orders=[
            build_schedule_order_response(order)
            for order in unscheduled_orders
        ],
    )


@router.get("/{bay_id}", response_model=WorkBayResponse)
def get_work_bay(
    bay_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.read")),
):
    bay = db.query(WorkBay).filter(WorkBay.id == bay_id).first()
    if not bay:
        raise HTTPException(status_code=404, detail="Work bay not found")
    return bay


@router.put("/{bay_id}", response_model=WorkBayResponse)
def update_work_bay(
    bay_id: int,
    data: WorkBayUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.manage")),
):
    bay = db.query(WorkBay).filter(WorkBay.id == bay_id).first()
    if not bay:
        raise HTTPException(status_code=404, detail="Work bay not found")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(WorkBay)
            .filter(WorkBay.name == update_data["name"], WorkBay.id != bay_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Another work bay with this name already exists")

    for key, value in update_data.items():
        setattr(bay, key, value)

    db.commit()
    db.refresh(bay)
    return bay


@router.delete("/{bay_id}")
def delete_work_bay(
    bay_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("work_bays.manage")),
):
    bay = db.query(WorkBay).filter(WorkBay.id == bay_id).first()
    if not bay:
        raise HTTPException(status_code=404, detail="Work bay not found")

    db.delete(bay)
    db.commit()
    return {"message": "Work bay deleted successfully"}
