from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Car, Client, CarType, User, Order
from app.schemas import CarCreate, CarUpdate, CarResponse

router = APIRouter(prefix="/cars", tags=["Cars"])


@router.post("/", response_model=CarResponse)
def create_car(
    car: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cars.create")),
):
    client = db.query(Client).filter(Client.id == car.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if car.car_type_id is not None:
        car_type = db.query(CarType).filter(CarType.id == car.car_type_id).first()
        if not car_type:
            raise HTTPException(status_code=404, detail="Car type not found")

    if car.plate_number:
        existing_car = db.query(Car).filter(Car.plate_number == car.plate_number).first()
        if existing_car:
            raise HTTPException(status_code=400, detail="Car with this plate number already exists")

    new_car = Car(
        client_id=car.client_id,
        car_type_id=car.car_type_id,
        brand=car.brand,
        model=car.model,
        year=car.year,
        plate_number=car.plate_number,
        color=car.color,
    )

    db.add(new_car)
    db.commit()
    db.refresh(new_car)
    return new_car


@router.get("/", response_model=list[CarResponse])
def get_cars(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cars.read")),
):
    return db.query(Car).order_by(Car.id.desc()).all()


@router.get("/{car_id}", response_model=CarResponse)
def get_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cars.read")),
):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car


@router.put("/{car_id}", response_model=CarResponse)
def update_car(
    car_id: int,
    car_data: CarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cars.update")),
):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    update_data = car_data.model_dump(exclude_unset=True)

    if "client_id" in update_data:
        client = db.query(Client).filter(Client.id == update_data["client_id"]).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

    if "car_type_id" in update_data and update_data["car_type_id"] is not None:
        car_type = db.query(CarType).filter(CarType.id == update_data["car_type_id"]).first()
        if not car_type:
            raise HTTPException(status_code=404, detail="Car type not found")

    if "plate_number" in update_data and update_data["plate_number"]:
        existing_car = (
            db.query(Car)
            .filter(Car.plate_number == update_data["plate_number"], Car.id != car_id)
            .first()
        )
        if existing_car:
            raise HTTPException(status_code=400, detail="Another car with this plate number already exists")

    for key, value in update_data.items():
        setattr(car, key, value)

    db.commit()
    db.refresh(car)
    return car


@router.delete("/{car_id}")
def delete_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("cars.delete")),
):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    orders_count = db.query(Order).filter(Order.car_id == car_id).count()

    if orders_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Car cannot be deleted because it has related orders. "
                "Archive/soft delete should be used instead."
            ),
        )

    db.delete(car)
    db.commit()

    return {"message": "Car deleted successfully"}