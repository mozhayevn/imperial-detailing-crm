from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import Material, MaterialStockMovement, User
from app.schemas import (
    MaterialStockMovementCreate,
    MaterialStockMovementResponse,
    MaterialStockSummaryResponse,
)

router = APIRouter(prefix="/materials", tags=["Material Stock"])

VALID_MANUAL_MOVEMENT_TYPES = [
    "receipt",
    "write_off",
    "adjustment",
]


def get_stock_status(current_quantity: int, min_stock_quantity: int) -> str:
    if current_quantity <= 0:
        return "out_of_stock"

    if min_stock_quantity > 0 and current_quantity <= min_stock_quantity:
        return "low_stock"

    return "in_stock"


def normalize_stock_quantity(movement_type: str, quantity: int) -> int:
    if movement_type == "receipt":
        return abs(quantity)

    if movement_type == "write_off":
        return -abs(quantity)

    if movement_type == "adjustment":
        return quantity

    raise HTTPException(status_code=400, detail="Invalid stock movement type")


def calculate_material_stock(material_id: int, db: Session) -> dict:
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    current_quantity = (
        db.query(func.coalesce(func.sum(MaterialStockMovement.quantity), 0))
        .filter(MaterialStockMovement.material_id == material_id)
        .scalar()
    )

    stock_value = (
        db.query(func.coalesce(func.sum(MaterialStockMovement.total_cost), 0))
        .filter(MaterialStockMovement.material_id == material_id)
        .scalar()
    )

    last_movement = (
        db.query(MaterialStockMovement)
        .filter(
            MaterialStockMovement.material_id == material_id,
            MaterialStockMovement.unit_cost > 0,
        )
        .order_by(MaterialStockMovement.created_at.desc())
        .first()
    )

    return {
        "material": material,
        "current_quantity": current_quantity,
        "stock_value": stock_value,
        "last_unit_cost": last_movement.unit_cost if last_movement else None,
    }


@router.get(
    "/{material_id}/stock",
    response_model=MaterialStockSummaryResponse,
)
def get_material_stock(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.read")),
):
    stock = calculate_material_stock(material_id, db)
    material = stock["material"]

    return MaterialStockSummaryResponse(
        material_id=material.id,
        material_name=material.name,
        unit_id=material.unit_id,
        unit_name=material.unit.name if material.unit else None,
        unit_code=material.unit.code if material.unit else None,
        current_quantity=stock["current_quantity"],
        min_stock_quantity=material.min_stock_quantity,
        stock_status=get_stock_status(
            current_quantity=stock["current_quantity"],
            min_stock_quantity=material.min_stock_quantity,
        ),
        stock_value=stock["stock_value"],
        last_unit_cost=stock["last_unit_cost"],
    )


@router.get(
    "/{material_id}/stock-movements",
    response_model=list[MaterialStockMovementResponse],
)
def get_material_stock_movements(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.read")),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    return (
        db.query(MaterialStockMovement)
        .options(joinedload(MaterialStockMovement.created_by_user))
        .filter(MaterialStockMovement.material_id == material_id)
        .order_by(MaterialStockMovement.created_at.desc())
        .all()
    )


@router.post(
    "/{material_id}/stock-movements",
    response_model=MaterialStockMovementResponse,
)
def create_material_stock_movement(
    material_id: int,
    data: MaterialStockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.manage")),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if data.movement_type not in VALID_MANUAL_MOVEMENT_TYPES:
        raise HTTPException(status_code=400,detail="Invalid stock movement type")

    if data.quantity == 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be zero")

    quantity = normalize_stock_quantity(data.movement_type, data.quantity)

    stock = calculate_material_stock(material_id, db)

    if data.movement_type == "write_off" and abs(quantity) > stock["current_quantity"]:
        raise HTTPException(
            status_code=400,
            detail="Write-off quantity exceeds current stock",
        )

    unit_cost = data.unit_cost

    if unit_cost is None:
        unit_cost = material.cost_per_unit

    if unit_cost < 0:
        raise HTTPException(status_code=400, detail="Unit cost cannot be negative")

    total_cost = quantity * unit_cost

    movement = MaterialStockMovement(
        material_id=material.id,
        order_item_material_id=None,
        movement_type=data.movement_type,
        quantity=quantity,
        unit_cost=unit_cost,
        total_cost=total_cost,
        comment=data.comment,
        created_by_user_id=current_user.id,
    )

    db.add(movement)
    db.commit()
    db.refresh(movement)

    return movement
