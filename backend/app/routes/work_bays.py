from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import WorkBay, User, Order
from app.schemas import WorkBayCreate, WorkBayUpdate, WorkBayResponse, WorkBayAvailabilityResponse
from datetime import datetime

router = APIRouter(prefix="/work-bays", tags=["Work Bays"])


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
