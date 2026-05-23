from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased, joinedload
from sqlalchemy import func
from datetime import datetime, date
import json

from app.config import ADMIN_MAX_DISCOUNT_PERCENT, MANAGER_MAX_DISCOUNT_PERCENT
from app.deps import get_current_active_user, require_permission
from app.database import get_db
from app.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
    Client,
    Car,
    Service,
    ServicePriceRule,
    User,
    WorkBay,
    OrderAuditLog,
    MaterialBrand,
    ServicePackage,
    OrderItemMaterial,
)
from app.schemas import (
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
    OrderUpdate,
    OrderStatusHistoryResponse,
    OrderReschedule,
    OrderCancel,
    OrderAuditLogResponse,
    #new
    OrderListItemResponse,
    OrderStatusHistoryResponse,
)

router = APIRouter(prefix="/orders", tags=["Orders"])


VALID_STATUSES = [
    "new",
    "confirmed",
    "in_progress",
    "completed",
    "delivered",
    "canceled",
]


#new def
def apply_order_filters(
    query,
    status: str | None = None,
    client_id: int | None = None,
    car_id: int | None = None,
    phone: str | None = None,
    plate_number: str | None = None,
    work_bay_id: int | None = None,
    assigned_user_id: int | None = None,
):
    if status:
        query = query.filter(Order.status == status)

    if client_id:
        query = query.filter(Order.client_id == client_id)

    if car_id:
        query = query.filter(Order.car_id == car_id)

    if work_bay_id:
        query = query.filter(Order.work_bay_id == work_bay_id)

    if assigned_user_id:
        query = query.filter(Order.assigned_user_id == assigned_user_id)

    if phone:
        query = query.join(Client).filter(Client.phone.ilike(f"%{phone}%"))

    if plate_number:
        query = query.join(Car).filter(Car.plate_number.ilike(f"%{plate_number}%"))

    return query


#end def
# =========================
# TIME CONFLICT CHECK
# =========================
def check_time_conflict(
    db: Session,
    planned_start_at: datetime | None,
    planned_end_at: datetime | None,
    work_bay_id: int | None = None,
    exclude_order_id: int | None = None,
):
    if not planned_start_at or not planned_end_at or not work_bay_id:
        return

    query = db.query(Order).filter(
        Order.planned_start_at.isnot(None),
        Order.planned_end_at.isnot(None),
        Order.work_bay_id == work_bay_id,
        Order.status != "canceled",
        Order.status != "delivered",
    )

    if exclude_order_id:
        query = query.filter(Order.id != exclude_order_id)

    conflict = query.filter(
        Order.planned_start_at < planned_end_at,
        Order.planned_end_at > planned_start_at,
    ).first()

    if conflict:
        raise HTTPException(
            status_code=400,
            detail=f"Time conflict in work bay #{work_bay_id} with order #{conflict.id}"
        )


def user_has_permission(user: User, permission_code: str, db: Session) -> bool:
    if user.is_super_admin:
        return True

    from app.models import UserRole, RolePermission, Permission

    permission_exists = (
        db.query(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(
            UserRole.user_id == user.id,
            Permission.code == permission_code,
        )
        .first()
    )

    return permission_exists is not None


def get_user_max_discount_percent(user: User, db: Session) -> int:
    if user.is_super_admin:
        return 100

    from app.models import UserRole, Role

    role_names = [
        row[0]
        for row in (
            db.query(Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .filter(UserRole.user_id == user.id)
            .all()
        )
    ]

    if "admin" in role_names:
        return ADMIN_MAX_DISCOUNT_PERCENT

    if "manager" in role_names:
        return MANAGER_MAX_DISCOUNT_PERCENT

    return 0


def ensure_service_can_be_used_for_order_item(
    service: Service,
    existing_order_item: OrderItem | None = None,
):
    if service.is_active:
        return

    if existing_order_item and existing_order_item.service_id == service.id:
        return

    raise HTTPException(
        status_code=400,
        detail="Archived service cannot be used in new order items",
    )


def ensure_service_package_can_be_used_for_order_item(
    service_package: ServicePackage,
    existing_order_item: OrderItem | None = None,
):
    if service_package.is_active:
        return

    if (
        existing_order_item
        and existing_order_item.service_package_id == service_package.id
    ):
        return

    raise HTTPException(
        status_code=400,
        detail="Archived service package cannot be used in new order items",
    )


# =========================
# BUILD ITEMS
# =========================
def build_order_items_and_total(
        order_id: int,
        car: Car,
        items_data: list,
        db: Session,
        current_user: User,
):
    total_price = 0
    created_items = []

    for item in items_data:
        service = db.query(Service).filter(Service.id == item.service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        ensure_service_can_be_used_for_order_item(service)

        if service.requires_brand and item.material_brand_id is None:
            raise HTTPException(status_code=400, detail="Brand required")

        if service.requires_package and item.service_package_id is None:
            raise HTTPException(status_code=400, detail="Package required")

        if item.material_brand_id is not None:
            brand = db.query(MaterialBrand).filter(MaterialBrand.id == item.material_brand_id).first()
            if not brand:
                raise HTTPException(status_code=404, detail="Material brand not found")

        if item.service_package_id is not None:
            package = (
                db.query(ServicePackage)
                .filter(ServicePackage.id == item.service_package_id)
                .first()
            )
            if not package:
                raise HTTPException(status_code=404, detail="Service package not found")

            ensure_service_package_can_be_used_for_order_item(package)

        quantity = item.quantity or 1
        discount_percent = item.discount_percent or 0

        max_discount_percent = get_user_max_discount_percent(current_user, db)

        if discount_percent < 0 or discount_percent > max_discount_percent:
            raise HTTPException(
                status_code=400,
                detail=f"Discount percent must be between 0 and {max_discount_percent} for your role"
            )

        if discount_percent > 0 and not item.discount_reason:
            raise HTTPException(
                status_code=400,
                detail="Discount reason is required when discount percent is greater than 0"
            )

        if discount_percent > 0 and not user_has_permission(current_user, "discounts.apply", db):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to apply discounts"
            )

        if discount_percent < 0 or discount_percent > 100:
            raise HTTPException(status_code=400, detail="Discount percent must be between 0 and 100")

        if discount_percent > 0 and not item.discount_reason:
            raise HTTPException(status_code=400,
                                detail="Discount reason is required when discount percent is greater than 0")

        order_item = OrderItem(
            order_id=order_id,
            service_id=item.service_id,
            material_brand_id=item.material_brand_id,
            service_package_id=item.service_package_id,
            price=0,
            quantity=quantity,
            discount_amount=0,
            discount_percent=discount_percent,
            discount_reason=item.discount_reason,
            discount_applied_by_user_id=current_user.id if discount_percent > 0 else None,
            total=0,
            base_cost_snapshot=0,
            gross_price_snapshot=0,
            discount_amount_snapshot=0,
            final_price_snapshot=0,
            profit_snapshot=0,
        )

        created_items.append(order_item)

    return created_items, total_price


# =========================
# CREATE ORDER
# =========================
@router.post("/", response_model=OrderResponse)
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.create")),
):
    try:
        client = db.query(Client).filter(Client.id == order_data.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        car = db.query(Car).filter(Car.id == order_data.car_id).first()
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")

        if order_data.assigned_user_id:
            user = db.query(User).filter(User.id == order_data.assigned_user_id).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

        if order_data.work_bay_id:
            work_bay = db.query(WorkBay).filter(WorkBay.id == order_data.work_bay_id).first()
            if not work_bay:
                raise HTTPException(status_code=404, detail="Work bay not found")

        check_time_conflict(
            db=db,
            planned_start_at=order_data.planned_start_at,
            planned_end_at=order_data.planned_end_at,
            work_bay_id=order_data.work_bay_id,
        )

        new_order = Order(
            client_id=order_data.client_id,
            car_id=order_data.car_id,
            assigned_user_id=order_data.assigned_user_id,
            work_bay_id=order_data.work_bay_id,
            status="new",
            scheduled_at=order_data.scheduled_at,
            planned_start_at=order_data.planned_start_at,
            planned_end_at=order_data.planned_end_at,
            comment=order_data.comment,
            total_price=0,
        )

        db.add(new_order)

        # Важно: flush дает new_order.id без окончательного commit.
        db.flush()

        created_items, total_price = build_order_items_and_total(
            new_order.id,
            car,
            order_data.items,
            db,
            current_user,
        )

        for item in created_items:
            db.add(item)

        new_order.total_price = total_price

        db.add(
            OrderStatusHistory(
                order_id=new_order.id,
                old_status=None,
                new_status="new",
            )
        )

        db.add(
            OrderAuditLog(
                order_id=new_order.id,
                actor_user_id=current_user.id,
                action="created",
                details=f"Order #{new_order.id} created",
            )
        )

        # Один commit в самом конце.
        db.commit()
        db.refresh(new_order)

        return new_order

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


# =========================
# GET ORDERS WITH FILTERS
# =========================
@router.get("/", response_model=list[OrderListItemResponse])
def get_orders(
    status: str | None = Query(None),
    client_id: int | None = Query(None),
    car_id: int | None = Query(None),
    client_name: str | None = Query(None),
    phone: str | None = Query(None),
    plate_number: str | None = Query(None),
    work_bay_id: int | None = Query(None),
    assigned_user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.read")),
):
    query = db.query(Order)

    if status:
        query = query.filter(Order.status == status)

    if client_id:
        query = query.filter(Order.client_id == client_id)

    if car_id:
        query = query.filter(Order.car_id == car_id)

    if work_bay_id:
        query = query.filter(Order.work_bay_id == work_bay_id)

    if assigned_user_id:
        query = query.filter(Order.assigned_user_id == assigned_user_id)

    if phone:
        query = query.join(Client).filter(Client.phone.ilike(f"%{phone}%"))

    if client_name:
        query = query.join(Client).filter(Client.full_name.ilike(f"%{client_name}%"))

    if plate_number:
        query = query.join(Car).filter(Car.plate_number.ilike(f"%{plate_number}%"))

    orders = query.order_by(Order.created_at.desc()).all()

    result = []

    for order in orders:
        result.append(
            OrderListItemResponse(
                id=order.id,
                status=order.status,
                total_price=order.total_price,
                pricing_locked=order.pricing_locked,

                created_at=order.created_at,
                scheduled_at=order.scheduled_at,
                planned_start_at=order.planned_start_at,
                planned_end_at=order.planned_end_at,

                client_id=order.client_id,
                client_full_name=order.client.full_name if order.client else None,
                client_phone=order.client.phone if order.client else None,

                car_id=order.car_id,
                car_brand=order.car.brand if order.car else None,
                car_model=order.car.model if order.car else None,
                car_plate_number=order.car.plate_number if order.car else None,

                work_bay_id=order.work_bay_id,
                work_bay_name=order.work_bay.name if order.work_bay else None,

                assigned_user_id=order.assigned_user_id,
                assigned_user_full_name=order.assigned_user.full_name if order.assigned_user else None,
            )
        )

    return result


# =========================
# GET ONE ORDER
# =========================
@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_permission("orders.read"))):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def serialize_order_item(item: OrderItem) -> dict:
    return {
        "id": item.id,
        "service_id": item.service_id,
        "material_brand_id": item.material_brand_id,
        "service_package_id": item.service_package_id,
        "quantity": item.quantity,
        "discount_percent": item.discount_percent,
        "discount_reason": item.discount_reason,
        "price": item.price,
        "discount_amount": item.discount_amount,
        "total": item.total,
        "base_cost_snapshot": item.base_cost_snapshot,
        "gross_price_snapshot": item.gross_price_snapshot,
        "discount_amount_snapshot": item.discount_amount_snapshot,
        "final_price_snapshot": item.final_price_snapshot,
        "profit_snapshot": item.profit_snapshot,
    }


# =========================
# UPDATE ORDER
# =========================
@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.update")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.pricing_locked:
        raise HTTPException(status_code=400, detail="Pricing is locked for this order")

    if data.client_id is not None:
        client = db.query(Client).filter(Client.id == data.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

    if data.car_id is not None:
        car = db.query(Car).filter(Car.id == data.car_id).first()
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")

        if data.client_id is not None and car.client_id != data.client_id:
            raise HTTPException(
                status_code=400,
                detail="Car does not belong to selected client",
            )

        if data.client_id is None and car.client_id != order.client_id:
            raise HTTPException(
                status_code=400,
                detail="Car does not belong to current order client",
            )

    effective_car_id = data.car_id if data.car_id is not None else order.car_id
    car = db.query(Car).filter(Car.id == effective_car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    old_order_data = {
        "client_id": order.client_id,
        "car_id": order.car.id,
        "assigned_user_id": order.assigned_user_id,
        "work_bay_id": order.work_bay_id,
        "scheduled_at": str(order.scheduled_at) if order.scheduled_at else None,
        "planned_start_at": str(order.planned_start_at) if order.planned_start_at else None,
        "planned_end_at": str(order.planned_end_at) if order.planned_end_at else None,
        "comment": order.comment,
        "status": order.status,
    }

    check_time_conflict(
        db=db,
        planned_start_at=data.planned_start_at,
        planned_end_at=data.planned_end_at,
        work_bay_id=data.work_bay_id,
        exclude_order_id=order.id,
    )

    if data.client_id is not None:
        order.client_id = data.client_id

    if data.car_id is not None:
        order.car_id = data.car_id

    order.assigned_user_id = data.assigned_user_id
    order.work_bay_id = data.work_bay_id
    order.scheduled_at = data.scheduled_at
    order.planned_start_at = data.planned_start_at
    order.planned_end_at = data.planned_end_at
    order.comment = data.comment

    existing_items = {
        item.id: item
        for item in db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    }

    old_items_snapshot = {
        item_id: serialize_order_item(item)
        for item_id, item in existing_items.items()
    }

    incoming_item_ids = set()

    added_items = []
    updated_items = []
    removed_items = []

    for item_data in data.items:
        service = db.query(Service).filter(Service.id == item_data.service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        existing_item_for_validation = None

        if item_data.id is not None:
            existing_item_for_validation = existing_items.get(item_data.id)

        ensure_service_can_be_used_for_order_item(
            service,
            existing_item_for_validation,
        )

        if service.requires_brand and item_data.material_brand_id is None:
            raise HTTPException(status_code=400, detail="Brand required")

        if service.requires_package and item_data.service_package_id is None:
            raise HTTPException(status_code=400, detail="Package required")

        if item_data.material_brand_id is not None:
            brand = db.query(MaterialBrand).filter(MaterialBrand.id == item_data.material_brand_id).first()
            if not brand:
                raise HTTPException(status_code=404, detail="Material brand not found")

        if item_data.service_package_id is not None:
            package = (
                db.query(ServicePackage)
                .filter(ServicePackage.id == item_data.service_package_id)
                .first()
            )
            if not package:
                raise HTTPException(status_code=404, detail="Service package not found")

            ensure_service_package_can_be_used_for_order_item(
                package,
                existing_item_for_validation,
            )

        quantity = item_data.quantity or 1
        discount_percent = item_data.discount_percent or 0

        max_discount_percent = get_user_max_discount_percent(current_user, db)

        if discount_percent < 0 or discount_percent > max_discount_percent:
            raise HTTPException(
                status_code=400,
                detail=f"Discount percent must be between 0 and {max_discount_percent} for your role"
            )

        if discount_percent > 0 and not item_data.discount_reason:
            raise HTTPException(
                status_code=400,
                detail="Discount reason is required when discount percent is greater than 0"
            )

        if discount_percent > 0 and not user_has_permission(current_user, "discounts.apply", db):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to apply discounts"
            )

        if item_data.id is not None:
            existing_item = existing_items.get(item_data.id)

            if not existing_item:
                raise HTTPException(
                    status_code=404,
                    detail=f"Order item with id {item_data.id} not found"
                )

            if existing_item.order_id != order.id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Order item {item_data.id} does not belong to order {order.id}"
                )

            before_update = serialize_order_item(existing_item)

            existing_item.service_id = item_data.service_id
            existing_item.material_brand_id = item_data.material_brand_id
            existing_item.service_package_id = item_data.service_package_id
            existing_item.quantity = quantity
            existing_item.discount_percent = discount_percent
            existing_item.discount_reason = item_data.discount_reason
            existing_item.discount_applied_by_user_id = current_user.id if discount_percent > 0 else None

            existing_item.price = 0
            existing_item.total = 0
            existing_item.discount_amount = 0

            existing_item.base_cost_snapshot = 0
            existing_item.gross_price_snapshot = 0
            existing_item.discount_amount_snapshot = 0
            existing_item.final_price_snapshot = 0
            existing_item.profit_snapshot = 0

            after_update = serialize_order_item(existing_item)

            if before_update != after_update:
                updated_items.append(
                    {
                        "before": before_update,
                        "after": after_update,
                    }
                )

            incoming_item_ids.add(existing_item.id)

        else:
            new_item = OrderItem(
                order_id=order.id,
                service_id=item_data.service_id,
                material_brand_id=item_data.material_brand_id,
                service_package_id=item_data.service_package_id,
                price=0,
                quantity=quantity,
                discount_amount=0,
                discount_percent=discount_percent,
                discount_reason=item_data.discount_reason,
                discount_applied_by_user_id=current_user.id if discount_percent > 0 else None,
                total=0,
                base_cost_snapshot=0,
                gross_price_snapshot=0,
                discount_amount_snapshot=0,
                final_price_snapshot=0,
                profit_snapshot=0,
            )
            db.add(new_item)
            db.flush()
            added_items.append(serialize_order_item(new_item))
            incoming_item_ids.add(new_item.id)

    items_to_delete = [
        item for item_id, item in existing_items.items()
        if item_id not in incoming_item_ids
    ]

    for item in items_to_delete:
        removed_items.append(serialize_order_item(item))
        db.query(OrderItemMaterial).filter(OrderItemMaterial.order_item_id == item.id).delete()
        db.delete(item)

    order.total_price = 0

    new_order_data = {
        "client_id": order.client_id,
        "car_id": order.car_id,
        "assigned_user_id": order.assigned_user_id,
        "work_bay_id": order.work_bay_id,
        "scheduled_at": str(order.scheduled_at) if order.scheduled_at else None,
        "planned_start_at": str(order.planned_start_at) if order.planned_start_at else None,
        "planned_end_at": str(order.planned_end_at) if order.planned_end_at else None,
        "comment": order.comment,
        "status": order.status,
    }

    db.commit()
    db.refresh(order)

    audit_details = {
        "order_before": old_order_data,
        "order_after": new_order_data,
        "items_added": added_items,
        "items_updated": updated_items,
        "items_removed": removed_items,
    }

    audit_log = OrderAuditLog(
        order_id=order.id,
        actor_user_id=current_user.id,
        action="updated",
        details=json.dumps(audit_details, ensure_ascii=False),
    )
    db.add(audit_log)
    db.commit()

    return order


# =========================
# UPDATE STATUS
# =========================
@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_permission("orders.update"))):
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    old_status = order.status
    order.status = data.status

    if data.status == "completed":
        order.completed_at = datetime.utcnow()

    if data.status == "delivered":
        order.delivered_at = datetime.utcnow()

    db.add(OrderStatusHistory(
        order_id=order.id,
        old_status=old_status,
        new_status=data.status
    ))

    db.commit()
    db.refresh(order)
    audit_log = OrderAuditLog(
        order_id=order.id,
        actor_user_id=current_user.id,
        action="status_changed",
        details=f"Status changed from {old_status} to {order.status}",
    )
    db.add(audit_log)
    db.commit()
    return order


# =========================
# RESCHEDULE
# =========================
@router.patch("/{order_id}/reschedule", response_model=OrderResponse)
def reschedule(order_id: int, data: OrderReschedule, db: Session = Depends(get_db), current_user: User = Depends(require_permission("orders.update"))):
    order = db.query(Order).filter(Order.id == order_id).first()
    if order.pricing_locked:
        raise HTTPException(status_code=400, detail="Pricing is locked for this order")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_start = order.planned_start_at
    old_end = order.planned_end_at

    check_time_conflict(
        db=db,
        planned_start_at=data.planned_start_at,
        planned_end_at=data.planned_end_at,
        work_bay_id=order.work_bay_id,
        exclude_order_id=order.id,
    )

    order.rescheduled_from = order.scheduled_at
    order.scheduled_at = data.scheduled_at
    order.planned_start_at = data.planned_start_at
    order.planned_end_at = data.planned_end_at

    db.commit()
    db.refresh(order)

    audit_log = OrderAuditLog(
        order_id=order.id,
        actor_user_id=current_user.id,
        action="rescheduled",
        details=f"Rescheduled from {old_start}-{old_end} to {order.planned_start_at}-{order.planned_end_at}",
    )
    db.add(audit_log)
    db.commit()

    return order


# =========================
# CANCEL
# =========================
@router.patch("/{order_id}/cancel", response_model=OrderResponse)
def cancel(order_id: int, data: OrderCancel, db: Session = Depends(get_db), current_user: User = Depends(require_permission("orders.update"))):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = "canceled"
    order.cancellation_reason = data.reason

    db.add(OrderStatusHistory(
        order_id=order.id,
        old_status=old_status,
        new_status="canceled"
    ))

    db.commit()
    db.refresh(order)

    audit_log = OrderAuditLog(
        order_id=order.id,
        actor_user_id=current_user.id,
        action="canceled",
        details=f"Order canceled. Reason: {data.reason}",
    )
    db.add(audit_log)
    db.commit()

    return order


# =========================
# STATUS HISTORY
# =========================
@router.get("/{order_id}/status-history", response_model=list[OrderStatusHistoryResponse])
def get_status_history(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_permission("orders.read"))):
    return (
        db.query(OrderStatusHistory)
        .filter(OrderStatusHistory.order_id == order_id)
        .order_by(OrderStatusHistory.changed_at.asc())
        .all()
    )


@router.get("/{order_id}/audit-logs", response_model=list[OrderAuditLogResponse])
def get_order_audit_logs(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.read")),
):
    logs = (
        db.query(OrderAuditLog)
        .options(joinedload(OrderAuditLog.actor_user))
        .filter(OrderAuditLog.order_id == order_id)
        .order_by(OrderAuditLog.created_at.desc())
        .all()
    )

    return logs
