import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.deps import require_permission
from app.models import (
    Order,
    OrderItem,
    OrderItemMaterial,
    Car,
    Service,
    ServicePriceRule,
    CarTypePricingRule,
    User,
    PricingAuditLog,
)
from app.schemas import OrderItemPricingResponse, OrderPricingResponse, PricingAuditLogResponse, PricingUnlockRequest

router = APIRouter(prefix="/pricing", tags=["Pricing"])


def find_service_price_rule(
    db: Session,
    service_id: int,
    car_type_id: int,
    material_brand_id: int | None,
    service_package_id: int | None,
):
    candidates = [
        {
            "material_brand_id": material_brand_id,
            "service_package_id": service_package_id,
        },
        {
            "material_brand_id": material_brand_id,
            "service_package_id": None,
        },
        {
            "material_brand_id": None,
            "service_package_id": service_package_id,
        },
        {
            "material_brand_id": None,
            "service_package_id": None,
        },
    ]

    seen_keys = set()

    for candidate in candidates:
        key = (
            candidate["material_brand_id"],
            candidate["service_package_id"],
        )

        if key in seen_keys:
            continue

        seen_keys.add(key)

        rule = (
            db.query(ServicePriceRule)
            .filter(
                ServicePriceRule.service_id == service_id,
                ServicePriceRule.car_type_id == car_type_id,
                ServicePriceRule.material_brand_id
                == candidate["material_brand_id"],
                ServicePriceRule.service_package_id
                == candidate["service_package_id"],
            )
            .first()
        )

        if rule:
            return rule

    return None


def calculate_order_item_values(order_item_id: int, db: Session):
    order_item = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    order = db.query(Order).filter(Order.id == order_item.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    car = db.query(Car).filter(Car.id == order.car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    if car.car_type_id is None:
        raise HTTPException(status_code=400, detail="Car has no car type assigned")

    service = db.query(Service).filter(Service.id == order_item.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    car_type_rule = (
        db.query(CarTypePricingRule)
        .filter(CarTypePricingRule.car_type_id == car.car_type_id)
        .first()
    )
    if not car_type_rule:
        raise HTTPException(status_code=404, detail="Car type pricing rule not found")

    materials_cost = (
        db.query(func.coalesce(func.sum(OrderItemMaterial.total_cost), 0))
        .filter(OrderItemMaterial.order_item_id == order_item_id)
        .scalar()
    )

    labor_cost = service.base_labor_cost
    multiplier = car_type_rule.multiplier

    base_cost = materials_cost + labor_cost

    price_rule = find_service_price_rule(
        db=db,
        service_id=order_item.service_id,
        car_type_id=car.car_type_id,
        material_brand_id=order_item.material_brand_id,
        service_package_id=order_item.service_package_id,
    )

    if price_rule:
        gross_price = price_rule.price
        pricing_source = "service_price_rule"
        service_price_rule_id = price_rule.id
    else:
        gross_price = base_cost * multiplier // 100
        pricing_source = "fallback_multiplier"
        service_price_rule_id = None

    discount_percent = order_item.discount_percent or 0
    if discount_percent < 0 or discount_percent > 100:
        raise HTTPException(status_code=400, detail="Discount percent must be between 0 and 100")

    discount_amount = gross_price * discount_percent // 100
    final_price = max(gross_price - discount_amount, 0)
    profit = final_price - base_cost

    has_warning = False
    warning_level = "none"
    warning_message = None

    profit_percent = 0
    if final_price > 0:
        profit_percent = profit / final_price * 100

    if profit < 0:
        has_warning = True
        warning_level = "negative_profit"
        warning_message = "Order item is unprofitable"
    elif profit_percent <= 10:
        has_warning = True
        warning_level = "low_margin"
        warning_message = "Order item has low margin"

    return {
        "order_item": order_item,
        "order": order,
        "car": car,
        "service": service,
        "materials_cost": materials_cost,
        "labor_cost": labor_cost,
        "multiplier": multiplier,
        "base_cost": base_cost,
        "gross_price": gross_price,
        "pricing_source": pricing_source,
        "service_price_rule_id": service_price_rule_id,
        "discount_percent": discount_percent,
        "discount_amount": discount_amount,
        "final_price": final_price,
        "profit": profit,
        "has_warning": has_warning,
        "warning_message": warning_message,
        "warning_level": warning_level,
    }


@router.get("/order-item/{order_item_id}", response_model=OrderItemPricingResponse)
def calculate_order_item_pricing(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    result = calculate_order_item_values(order_item_id, db)

    return OrderItemPricingResponse(
        order_item_id=result["order_item"].id,
        order_id=result["order"].id,
        service_id=result["service"].id,
        car_type_id=result["car"].car_type_id,
        materials_cost=result["materials_cost"],
        labor_cost=result["labor_cost"],
        car_type_multiplier=result["multiplier"],
        pricing_source=result["pricing_source"],
        service_price_rule_id=result["service_price_rule_id"],
        base_cost=result["base_cost"],
        gross_price=result["gross_price"],
        discount_percent=result["discount_percent"],
        discount_amount=result["discount_amount"],
        final_price=result["final_price"],
        profit=result["profit"],
        has_warning=result["has_warning"],
        warning_level=result["warning_level"],
        warning_message=result["warning_message"],
    )


@router.get("/order/{order_id}", response_model=OrderPricingResponse)
def calculate_order_pricing(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "canceled":
        raise HTTPException(
            status_code=400,
            detail="Pricing preview is not available for canceled orders",
        )

    order_items = (
        db.query(OrderItem)
        .filter(OrderItem.order_id == order_id)
        .order_by(OrderItem.id.asc())
        .all()
    )

    total_gross_price = 0
    total_discount_amount = 0
    total_materials_cost = 0
    total_labor_cost = 0
    total_final_price = 0
    total_profit = 0

    has_warning = False
    warning_level = "none"
    warning_messages = []

    item_summaries = []

    for item in order_items:
        result = calculate_order_item_values(item.id, db)

        item_summaries.append(
            {
                "order_item_id": item.id,
                "service_id": item.service_id,
                "quantity": item.quantity,
                "materials_cost": result["materials_cost"],
                "labor_cost": result["labor_cost"],
                "base_cost": result["base_cost"],
                "car_type_multiplier": result["multiplier"],
                "pricing_source": result["pricing_source"],
                "service_price_rule_id": result["service_price_rule_id"],
                "gross_price": result["gross_price"],
                "discount_percent": result["discount_percent"],
                "discount_amount": result["discount_amount"],
                "final_price": result["final_price"],
                "profit": result["profit"],
                "has_warning": result["has_warning"],
                "warning_level": result["warning_level"],
                "warning_message": result["warning_message"],
            }
        )

        if result["has_warning"]:
            has_warning = True
            warning_messages.append(f"Order item #{item.id}: {result['warning_message']}")

            if result["warning_level"] == "negative_profit":
                warning_level = "negative_profit"
            elif result["warning_level"] == "low_margin" and warning_level != "negative_profit":
                warning_level = "low_margin"
        total_materials_cost += result["materials_cost"]
        total_labor_cost += result["labor_cost"]
        total_gross_price += result["gross_price"] * item.quantity
        total_discount_amount += result["discount_amount"] * item.quantity
        total_final_price += result["final_price"] * item.quantity
        total_profit += result["profit"] * item.quantity

    return OrderPricingResponse(
        order_id=order.id,
        items_count=len(order_items),
        total_materials_cost=total_materials_cost,
        total_labor_cost=total_labor_cost,
        total_gross_price=total_gross_price,
        total_discount_amount=total_discount_amount,
        total_final_price=total_final_price,
        total_profit=total_profit,
        has_warning=has_warning,
        warning_level=warning_level,
        warning_message="; ".join(warning_messages) if warning_messages else None,
        items=item_summaries,
    )


@router.post("/order/{order_id}/apply", response_model=OrderPricingResponse)
def apply_order_pricing(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.pricing_locked:
            raise HTTPException(status_code=400, detail="Pricing is already applied and locked")

        if order.status in ["canceled", "delivered"]:
            raise HTTPException(
                status_code=400,
                detail=f"Pricing cannot be applied to order with status {order.status}",
            )

        order_items = (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order_id)
            .order_by(OrderItem.id.asc())
            .all()
        )

        if not order_items:
            raise HTTPException(status_code=400, detail="Order has no items")

        total_gross_price = 0
        total_discount_amount = 0
        total_materials_cost = 0
        total_labor_cost = 0
        total_final_price = 0
        total_profit = 0

        has_warning = False
        warning_level = "none"
        warning_messages = []

        item_summaries = []

        for item in order_items:
            result = calculate_order_item_values(item.id, db)

            item_summaries.append(
                {
                    "order_item_id": item.id,
                    "service_id": item.service_id,
                    "quantity": item.quantity,
                    "materials_cost": result["materials_cost"],
                    "labor_cost": result["labor_cost"],
                    "base_cost": result["base_cost"],
                    "multiplier": result["multiplier"],
                    "pricing_source": result["pricing_source"],
                    "service_price_rule_id": result["service_price_rule_id"],
                    "gross_price": result["gross_price"],
                    "discount_percent": result["discount_percent"],
                    "discount_amount": result["discount_amount"],
                    "final_price": result["final_price"],
                    "profit": result["profit"],
                    "has_warning": result["has_warning"],
                    "warning_level": result["warning_level"],
                    "warning_message": result["warning_message"],
                }
            )

            if result["has_warning"]:
                has_warning = True
                warning_messages.append(f"Order item #{item.id}: {result['warning_message']}")

                if result["warning_level"] == "negative_profit":
                    warning_level = "negative_profit"
                elif result["warning_level"] == "low_margin" and warning_level != "negative_profit":
                    warning_level = "low_margin"

            item.price = result["final_price"]
            item.discount_amount = result["discount_amount"]
            item.total = result["final_price"] * item.quantity

            item.base_cost_snapshot = result["base_cost"]
            item.gross_price_snapshot = result["gross_price"]
            item.discount_amount_snapshot = result["discount_amount"]
            item.final_price_snapshot = result["final_price"]
            item.profit_snapshot = result["profit"]

            if item.discount_percent > 0:
                item.discount_applied_by_user_id = current_user.id

            total_gross_price += result["gross_price"] * item.quantity
            total_discount_amount += result["discount_amount"] * item.quantity
            total_materials_cost += result["materials_cost"]
            total_labor_cost += result["labor_cost"]
            total_final_price += item.total
            total_profit += result["profit"] * item.quantity

        order.total_price = total_final_price
        order.pricing_locked = True

        audit_log = PricingAuditLog(
            order_id=order.id,
            actor_user_id=current_user.id,
            action="pricing_applied",
            details=json.dumps(
                {
                    "totals": {
                        "gross": total_gross_price,
                        "discount": total_discount_amount,
                        "materials_cost": total_materials_cost,
                        "labor_cost": total_labor_cost,
                        "final_price": total_final_price,
                        "profit": total_profit,
                        "warning_level": warning_level,
                        "warning": warning_messages if warning_messages else [],
                        "items_count": len(order_items),
                    },
                    "items": item_summaries,
                },
                ensure_ascii=False,
            ),
        )

        db.add(audit_log)
        db.commit()
        db.refresh(order)

        return OrderPricingResponse(
            order_id=order.id,
            items_count=len(order_items),
            total_materials_cost=total_materials_cost,
            total_labor_cost=total_labor_cost,
            total_gross_price=total_gross_price,
            total_discount_amount=total_discount_amount,
            total_final_price=total_final_price,
            total_profit=total_profit,
            has_warning=has_warning,
            warning_level=warning_level,
            warning_message="; ".join(warning_messages) if warning_messages else None,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.get("/order/{order_id}/audit-logs", response_model=list[PricingAuditLogResponse])
def get_pricing_audit_logs(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    logs = (
        db.query(PricingAuditLog)
        .options(joinedload(PricingAuditLog.actor_user))
        .filter(PricingAuditLog.order_id == order_id)
        .order_by(PricingAuditLog.created_at.desc())
        .all()
    )

    return logs


@router.post("/order/{order_id}/unlock", response_model=OrderPricingResponse)
def unlock_order_pricing(
    order_id: int,
    data: PricingUnlockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if not order.pricing_locked:
            raise HTTPException(status_code=400, detail="Pricing is already unlocked")

        if order.status in ["canceled", "delivered"]:
            raise HTTPException(
                status_code=400,
                detail=f"Pricing cannot be unlocked for order with status {order.status}",
            )

        if not data.reason or not data.reason.strip():
            raise HTTPException(status_code=400, detail="Unlock reason is required")

        order.pricing_locked = False

        order_items = (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order_id)
            .order_by(OrderItem.id.asc())
            .all()
        )

        total_gross_price = 0
        total_discount_amount = 0
        total_materials_cost = 0
        total_labor_cost = 0
        total_final_price = 0
        total_profit = 0
        has_warning = False
        warning_level = "none"
        warning_messages = []

        for item in order_items:
            result = calculate_order_item_values(item.id, db)

            total_materials_cost += result["materials_cost"]
            total_labor_cost += result["labor_cost"]
            total_gross_price += result["gross_price"] * item.quantity
            total_discount_amount += result["discount_amount"] * item.quantity
            total_final_price += result["final_price"] * item.quantity
            total_profit += result["profit"] * item.quantity

            if result["has_warning"]:
                has_warning = True
                warning_messages.append(f"Order item #{item.id}: {result['warning_message']}")

                if result["warning_level"] == "negative_profit":
                    warning_level = "negative_profit"
                elif result["warning_level"] == "low_margin" and warning_level != "negative_profit":
                    warning_level = "low_margin"

        audit_log = PricingAuditLog(
            order_id=order.id,
            actor_user_id=current_user.id,
            action="pricing_unlocked",
            details=f"Pricing unlocked for recalculation. Reason: {data.reason}",
        )

        db.add(audit_log)
        db.commit()
        db.refresh(order)

        return OrderPricingResponse(
            order_id=order.id,
            items_count=len(order_items),
            total_materials_cost=total_materials_cost,
            total_labor_cost=total_labor_cost,
            total_gross_price=total_gross_price,
            total_discount_amount=total_discount_amount,
            total_final_price=total_final_price,
            total_profit=total_profit,
            has_warning=has_warning,
            warning_level=warning_level,
            warning_message="; ".join(warning_messages) if warning_messages else None,
        )

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise