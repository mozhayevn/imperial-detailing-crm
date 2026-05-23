from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import CarType, User
from app.schemas import CarTypeCreate, CarTypeUpdate, CarTypeResponse

router = APIRouter(prefix="/car-types", tags=["Car Types"])


@router.post("/", response_model=CarTypeResponse)
def create_car_type(
    car_type: CarTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("car_types.manage")),
):
    existing = db.query(CarType).filter(CarType.name == car_type.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Car type already exists")

    new_car_type = CarType(name=car_type.name)
    db.add(new_car_type)
    db.commit()
    db.refresh(new_car_type)
    return new_car_type


@router.get("/", response_model=list[CarTypeResponse])
def get_car_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("car_types.read")),
):
    return db.query(CarType).order_by(CarType.id.desc()).all()


@router.get("/{car_type_id}", response_model=CarTypeResponse)
def get_car_type(
    car_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("car_types.read")),
):
    car_type = db.query(CarType).filter(CarType.id == car_type_id).first()
    if not car_type:
        raise HTTPException(status_code=404, detail="Car type not found")
    return car_type


@router.put("/{car_type_id}", response_model=CarTypeResponse)
def update_car_type(
    car_type_id: int,
    car_type_data: CarTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("car_types.manage")),
):
    car_type = db.query(CarType).filter(CarType.id == car_type_id).first()
    if not car_type:
        raise HTTPException(status_code=404, detail="Car type not found")

    update_data = car_type_data.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(CarType)
            .filter(CarType.name == update_data["name"], CarType.id != car_type_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Another car type with this name already exists")

    for key, value in update_data.items():
        setattr(car_type, key, value)

    db.commit()
    db.refresh(car_type)
    return car_type


@router.delete("/{car_type_id}")
def delete_car_type(
    car_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("car_types.manage")),
):
    car_type = db.query(CarType).filter(CarType.id == car_type_id).first()
    if not car_type:
        raise HTTPException(status_code=404, detail="Car type not found")

    db.delete(car_type)
    db.commit()
    return {"message": "Car type deleted successfully"}