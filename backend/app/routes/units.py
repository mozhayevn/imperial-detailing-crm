from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Unit, User
from app.schemas import UnitCreate, UnitResponse

router = APIRouter(prefix="/units", tags=["Units"])


@router.post("/", response_model=UnitResponse)
def create_unit(
    data: UnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.manage")),
):
    existing_name = db.query(Unit).filter(Unit.name == data.name).first()
    if existing_name:
        raise HTTPException(status_code=400, detail="Unit name already exists")

    existing_code = db.query(Unit).filter(Unit.code == data.code).first()
    if existing_code:
        raise HTTPException(status_code=400, detail="Unit code already exists")

    unit = Unit(name=data.name, code=data.code)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.get("/", response_model=list[UnitResponse])
def get_units(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.read")),
):
    return db.query(Unit).order_by(Unit.id.desc()).all()