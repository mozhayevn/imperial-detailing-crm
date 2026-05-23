from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ClientCreate, ClientResponse, ClientUpdate, OrderResponse, ClientHistoryItemResponse, CarResponse
from app.deps import require_permission
from app.models import Order, User, Client, Car

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post("/", response_model=ClientResponse)
def create_client(
        client: ClientCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(require_permission("clients.create"))
):
    existing_client = db.query(Client).filter(Client.phone == client.phone).first()
    if existing_client:
        raise HTTPException(status_code=400, detail="Client with this phone already exists")

    new_client = Client(
        full_name=client.full_name,
        phone=client.phone,
        birth_date=client.birth_date,
        preferences=client.preferences,
    )

    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client


@router.get("/", response_model=list[ClientResponse])
def get_clients(db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.read"))):
    return db.query(Client).order_by(Client.id.desc()).all()


@router.get("/search", response_model=list[ClientResponse])
def search_clients(
    phone: str | None = Query(None),
    full_name: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.read")),
):
    query = db.query(Client)

    if phone:
        query = query.filter(Client.phone.ilike(f"%{phone}%"))

    if full_name:
        query = query.filter(Client.full_name.ilike(f"%{full_name}%"))

    return query.order_by(Client.id.desc()).all()


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.read"))):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, client_data: ClientUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.update"))):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = client_data.model_dump(exclude_unset=True)

    if "phone" in update_data:
        existing_client = (
            db.query(Client)
            .filter(Client.phone == update_data["phone"], Client.id != client_id)
            .first()
        )
        if existing_client:
            raise HTTPException(status_code=400, detail="Another client with this phone already exists")

    for key, value in update_data.items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.delete")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    cars_count = db.query(Car).filter(Car.client_id == client_id).count()
    orders_count = db.query(Order).filter(Order.client_id == client_id).count()

    if cars_count > 0 or orders_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Client cannot be deleted because they have related cars or orders. "
                "Archive/soft delete should be used instead."
            ),
        )

    db.delete(client)
    db.commit()

    return {"message": "Client deleted successfully"}


@router.get("/{client_id}/orders", response_model=list[OrderResponse])
def get_client_orders(client_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_permission("clients.read"))):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    orders = (
        db.query(Order)
        .filter(Order.client_id == client_id)
        .order_by(Order.created_at.desc())
        .all()
    )

    return orders

@router.get("/{client_id}/history", response_model=list[ClientHistoryItemResponse])
def get_client_history(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.read")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    orders = (
        db.query(Order)
        .filter(Order.client_id == client_id)
        .order_by(Order.created_at.desc())
        .all()
    )

    result = []
    for order in orders:
        result.append(
            ClientHistoryItemResponse(
                order_id=order.id,
                status=order.status,
                created_at=order.created_at,
                scheduled_at=order.scheduled_at,
                planned_start_at=order.planned_start_at,
                planned_end_at=order.planned_end_at,
                total_price=order.total_price,
                comment=order.comment,
                items_count=len(order.items) if order.items else 0,
            )
        )

    return result


@router.get("/{client_id}/cars", response_model=list[CarResponse])
def get_client_cars(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients.read")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    cars = (
        db.query(Car)
        .filter(Car.client_id == client_id)
        .order_by(Car.id.desc())
        .all()
    )

    return cars
