from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import (
    OrderItem,
    OrderItemMaterial,
    Material,
    MaterialStockMovement,
    User,
    Order,
)
from app.schemas import OrderItemMaterialCreate, OrderItemMaterialResponse

router = APIRouter(prefix="/order-item-materials", tags=["Order Item Materials"])
TERMINAL_ORDER_STATUSES = {"canceled", "delivered"}


def get_material_current_stock(material_id: int, db: Session) -> int:
    from sqlalchemy import func

    return (
        db.query(func.coalesce(func.sum(MaterialStockMovement.quantity), 0))
        .filter(MaterialStockMovement.material_id == material_id)
        .scalar()
    )


def create_order_usage_stock_movement(
    *,
    db: Session,
    material: Material,
    order_item_material: OrderItemMaterial,
    quantity_delta: int,
    current_user: User,
    comment: str | None = None,
):
    if quantity_delta == 0:
        return None

    stock_quantity = get_material_current_stock(material.id, db)

    if quantity_delta > stock_quantity:
        raise HTTPException(
            status_code=400,
            detail="Material stock is not enough for order usage",
        )

    unit_cost = material.cost_per_unit
    movement_quantity = -abs(quantity_delta)

    movement = MaterialStockMovement(
        material_id=material.id,
        order_item_material_id=order_item_material.id,
        movement_type="order_usage",
        quantity=movement_quantity,
        unit_cost=unit_cost,
        total_cost=movement_quantity * unit_cost,
        comment=comment or f"Auto consumption for order item material #{order_item_material.id}",
        created_by_user_id=current_user.id,
    )

    db.add(movement)

    return movement


def create_order_usage_reversal_stock_movement(
    *,
    db: Session,
    row: OrderItemMaterial,
    current_user: User,
    comment: str | None = None,
):
    movement = MaterialStockMovement(
        material_id=row.material_id,
        order_item_material_id=row.id,
        movement_type="order_usage_reversal",
        quantity=abs(row.quantity),
        unit_cost=row.unit_cost,
        total_cost=abs(row.quantity) * row.unit_cost,
        comment=comment or f"Auto reversal for deleted order item material #{row.id}",
        created_by_user_id=current_user.id,
    )

    db.add(movement)

    return movement


@router.post("/{order_item_id}", response_model=OrderItemMaterialResponse)
def add_material_to_order_item(
    order_item_id: int,
    data: OrderItemMaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.consume")),
):
    order_item = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    order = db.query(Order).filter(Order.id == order_item.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.pricing_locked:
        raise HTTPException(status_code=400, detail="Pricing is locked for this order")

    if order.status in TERMINAL_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Materials cannot be changed for terminal orders",
        )

    material = db.query(Material).filter(Material.id == data.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if not material.is_active:
        raise HTTPException(
            status_code=400,
            detail="Archived material cannot be used in new consumption rows",
        )

    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    existing_row = (
        db.query(OrderItemMaterial)
        .filter(
            OrderItemMaterial.order_item_id == order_item_id,
            OrderItemMaterial.material_id == data.material_id,
        )
        .first()
    )

    if existing_row:
        create_order_usage_stock_movement(
            db=db,
            material=material,
            order_item_material=existing_row,
            quantity_delta=data.quantity,
            current_user=current_user,
            comment=f"Auto consumption added to existing order item material #{existing_row.id}",
        )

        existing_row.quantity += data.quantity
        existing_row.unit_cost = material.cost_per_unit
        existing_row.total_cost = existing_row.quantity * existing_row.unit_cost

        if data.comment:
            existing_row.comment = data.comment

        db.commit()
        db.refresh(existing_row)
        return existing_row
    total_cost = material.cost_per_unit * data.quantity

    row = OrderItemMaterial(
        order_item_id=order_item_id,
        material_id=data.material_id,
        quantity=data.quantity,
        unit_cost=material.cost_per_unit,
        total_cost=total_cost,
        comment=data.comment,
    )

    db.add(row)
    db.flush()

    create_order_usage_stock_movement(
        db=db,
        material=material,
        order_item_material=row,
        quantity_delta=data.quantity,
        current_user=current_user,
        comment=f"Auto consumption for order item #{order_item_id}",
    )

    db.commit()
    db.refresh(row)
    return row


@router.get("/{order_item_id}", response_model=list[OrderItemMaterialResponse])
def get_order_item_materials(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.read")),
):
    order_item = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    return (
        db.query(OrderItemMaterial)
        .filter(OrderItemMaterial.order_item_id == order_item_id)
        .order_by(OrderItemMaterial.id.desc())
        .all()
    )


@router.delete("/{order_item_material_id}")
def delete_order_item_material(
    order_item_material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.consume")),
):
    row = (
        db.query(OrderItemMaterial)
        .filter(OrderItemMaterial.id == order_item_material_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Order item material not found")

    order_item = db.query(OrderItem).filter(OrderItem.id == row.order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    order = db.query(Order).filter(Order.id == order_item.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.pricing_locked:
        raise HTTPException(status_code=400, detail="Pricing is locked for this order")

    if order.status in TERMINAL_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Materials cannot be changed for terminal orders",
        )

    create_order_usage_reversal_stock_movement(
        db=db,
        row=row,
        current_user=current_user,
        comment=f"Auto reversal before deleting order item material #{row.id}",
    )

    db.delete(row)
    db.commit()

    return {
        "detail": "Order item material deleted"
    }
