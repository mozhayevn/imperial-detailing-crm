from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Order, OrderItem, Payment, User
from app.schemas import FinanceOverviewResponse

router = APIRouter(prefix="/finance", tags=["Finance"])


def get_period_start(period: str) -> datetime | None:
    now = datetime.utcnow()

    if period == "today":
        return datetime.combine(now.date(), datetime.min.time())

    if period == "7d":
        return now - timedelta(days=7)

    if period == "30d":
        return now - timedelta(days=30)

    if period == "all":
        return None

    return now - timedelta(days=7)


def apply_order_period(query, period_start: datetime | None):
    if period_start is None:
        return query

    return query.filter(Order.created_at >= period_start)


def apply_payment_period(query, period_start: datetime | None):
    if period_start is None:
        return query

    return query.filter(Payment.paid_at >= period_start)


@router.get("/overview", response_model=FinanceOverviewResponse)
def get_finance_overview(
    period: str = Query("30d", pattern="^(today|7d|30d|all)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.read")),
):
    period_start = get_period_start(period)

    locked_orders_query = db.query(Order).filter(
        Order.pricing_locked == True,
        Order.status != "canceled",
    )
    locked_orders_query = apply_order_period(locked_orders_query, period_start)

    locked_order_ids_subquery = locked_orders_query.with_entities(Order.id).subquery()

    orders_revenue = int(
        db.query(func.coalesce(func.sum(Order.total_price), 0))
        .filter(Order.id.in_(locked_order_ids_subquery))
        .scalar()
        or 0
    )

    cash_received = int(
        apply_payment_period(
            db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
                Payment.status == "completed",
            ),
            period_start,
        ).scalar()
        or 0
    )

    gross_profit = int(
        db.query(func.coalesce(func.sum(OrderItem.profit_snapshot * OrderItem.quantity), 0))
        .filter(OrderItem.order_id.in_(locked_order_ids_subquery))
        .scalar()
        or 0
    )

    locked_orders = locked_orders_query.all()

    paid_orders_count = 0
    partial_orders_count = 0
    unpaid_orders_count = 0

    for order in locked_orders:
        paid_amount = int(
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(
                Payment.order_id == order.id,
                Payment.status == "completed",
            )
            .scalar()
            or 0
        )

        if order.total_price <= 0 or paid_amount <= 0:
            unpaid_orders_count += 1
        elif paid_amount < order.total_price:
            partial_orders_count += 1
        else:
            paid_orders_count += 1

    accounts_receivable = max(orders_revenue - cash_received, 0)

    return FinanceOverviewResponse(
        period=period,
        orders_revenue=orders_revenue,
        cash_received=cash_received,
        accounts_receivable=accounts_receivable,
        gross_profit=gross_profit,
        locked_orders_count=len(locked_orders),
        paid_orders_count=paid_orders_count,
        partial_orders_count=partial_orders_count,
        unpaid_orders_count=unpaid_orders_count,
    )