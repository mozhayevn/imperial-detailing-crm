import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import Order, Payment, PaymentAuditLog, User
from app.schemas import (
    PaymentCreate,
    PaymentCancel,
    PaymentResponse,
    PaymentSummaryResponse,
    PaymentAuditLogResponse,
)

router = APIRouter(tags=["Payments"])

VALID_PAYMENT_METHODS = [
    "cash",
    "kaspi",
    "card",
    "bank_transfer",
    "other",
]

VALID_PAYMENT_STATUSES = [
    "completed",
    "canceled",
    "refunded",
]


def get_payment_summary_data(order_id: int, db: Session) -> dict:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    paid_amount = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.order_id == order_id,
            Payment.status == "completed",
        )
        .scalar()
    )

    remaining_amount = order.total_price - paid_amount

    if order.total_price <= 0:
        payment_status = "unpriced"
    elif paid_amount <= 0:
        payment_status = "unpaid"
    elif paid_amount < order.total_price:
        payment_status = "partial"
    elif paid_amount == order.total_price:
        payment_status = "paid"
    else:
        payment_status = "overpaid"

    return {
        "order_id": order.id,
        "total_price": order.total_price,
        "paid_amount": paid_amount,
        "remaining_amount": remaining_amount,
        "payment_status": payment_status,
    }


@router.get(
    "/orders/{order_id}/payments",
    response_model=list[PaymentResponse],
)
def get_order_payments(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.read")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return (
        db.query(Payment)
        .options(
            joinedload(Payment.created_by_user),
            joinedload(Payment.canceled_by_user),
        )
        .filter(Payment.order_id == order_id)
        .order_by(Payment.created_at.desc())
        .all()
    )


@router.get(
    "/orders/{order_id}/payments/summary",
    response_model=PaymentSummaryResponse,
)
def get_order_payment_summary(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.read")),
):
    return PaymentSummaryResponse(**get_payment_summary_data(order_id, db))


@router.post(
    "/orders/{order_id}/payments",
    response_model=PaymentResponse,
)
def create_order_payment(
    order_id: int,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.create")),
):
    try:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.status == "canceled":
            raise HTTPException(
                status_code=400,
                detail="Cannot create payment for canceled order",
            )

        if not order.pricing_locked:
            raise HTTPException(
                status_code=400,
                detail="Pricing must be applied and locked before payment",
            )

        if data.amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="Payment amount must be greater than zero",
            )

        summary_before = get_payment_summary_data(order.id, db)

        if summary_before["payment_status"] == "paid":
            raise HTTPException(
                status_code=400,
                detail="Order is already fully paid",
            )

        if data.amount > summary_before["remaining_amount"]:
            raise HTTPException(
                status_code=400,
                detail="Payment amount exceeds remaining order balance",
            )

        if data.method not in VALID_PAYMENT_METHODS:
            raise HTTPException(
                status_code=400,
                detail="Invalid payment method",
            )

        payment = Payment(
            order_id=order.id,
            amount=data.amount,
            method=data.method,
            status="completed",
            comment=data.comment,
            paid_at=data.paid_at or datetime.utcnow(),
            created_by_user_id=current_user.id,
        )

        db.add(payment)
        db.flush()

        summary_after = get_payment_summary_data(order.id, db)

        audit_log = PaymentAuditLog(
            order_id=order.id,
            payment_id=payment.id,
            actor_user_id=current_user.id,
            action="payment_created",
            details=json.dumps(
                {
                    "payment": {
                        "id": payment.id,
                        "amount": payment.amount,
                        "method": payment.method,
                        "status": payment.status,
                        "comment": payment.comment,
                        "paid_at": str(payment.paid_at),
                    },
                    "summary_after": summary_after,
                },
                ensure_ascii=False,
            ),
        )

        db.add(audit_log)
        db.commit()
        db.refresh(payment)

        return payment

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.patch(
    "/payments/{payment_id}/cancel",
    response_model=PaymentResponse,
)
def cancel_payment(
    payment_id: int,
    data: PaymentCancel,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.cancel")),
):
    try:
        payment = (
            db.query(Payment)
            .options(
                joinedload(Payment.created_by_user),
                joinedload(Payment.canceled_by_user),
            )
            .filter(Payment.id == payment_id)
            .first()
        )

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        if payment.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Only completed payments can be canceled",
            )

        if not data.reason or not data.reason.strip():
            raise HTTPException(
                status_code=400,
                detail="Cancel reason is required",
            )

        order = db.query(Order).filter(Order.id == payment.order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        payment.status = "canceled"
        payment.canceled_at = datetime.utcnow()
        payment.canceled_by_user_id = current_user.id
        payment.cancel_reason = data.reason.strip()

        summary_after = get_payment_summary_data(order.id, db)

        audit_log = PaymentAuditLog(
            order_id=order.id,
            payment_id=payment.id,
            actor_user_id=current_user.id,
            action="payment_canceled",
            details=json.dumps(
                {
                    "payment": {
                        "id": payment.id,
                        "amount": payment.amount,
                        "method": payment.method,
                        "status": payment.status,
                        "cancel_reason": payment.cancel_reason,
                        "canceled_at": str(payment.canceled_at),
                    },
                    "summary_after": summary_after,
                },
                ensure_ascii=False,
            ),
        )

        db.add(audit_log)
        db.commit()
        db.refresh(payment)

        return payment

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.get(
    "/orders/{order_id}/payments/audit-logs",
    response_model=list[PaymentAuditLogResponse],
)
def get_payment_audit_logs(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.read")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return (
        db.query(PaymentAuditLog)
        .options(joinedload(PaymentAuditLog.actor_user))
        .filter(PaymentAuditLog.order_id == order_id)
        .order_by(PaymentAuditLog.created_at.desc())
        .all()
    )