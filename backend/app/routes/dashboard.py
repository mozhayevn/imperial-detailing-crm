from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import (
    Material,
    MaterialStockMovement,
    Order,
    OrderChecklistItem,
    OrderItem,
    Payment,
    User,
)
from app.schemas import (
    DashboardChartsResponse,
    DashboardFinanceSummaryResponse,
    DashboardInventorySummaryResponse,
    DashboardMetricResponse,
    DashboardOrdersSummaryResponse,
    DashboardProductionSummaryResponse,
    DashboardSummaryResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


ACTIVE_ORDER_STATUSES = ["new", "in_progress", "waiting", "scheduled"]
COMPLETED_ORDER_STATUSES = ["completed"]
DELIVERED_ORDER_STATUSES = ["delivered"]
CANCELED_ORDER_STATUSES = ["canceled"]


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


def get_first_order_date(db: Session) -> date | None:
    first_created_at = db.query(func.min(Order.created_at)).scalar()

    if not first_created_at:
        return None

    return first_created_at.date()


def apply_order_period(query, period_start: datetime | None):
    if period_start is None:
        return query

    return query.filter(Order.created_at >= period_start)


def apply_payment_period(query, period_start: datetime | None):
    if period_start is None:
        return query

    return query.filter(Payment.created_at >= period_start)


def apply_order_item_period(query, period_start: datetime | None):
    if period_start is None:
        return query

    return query.join(Order, Order.id == OrderItem.order_id).filter(
        Order.created_at >= period_start,
    )


def get_orders_by_day_range(period: str) -> int:
    if period == "today":
        return 1

    if period == "30d":
        return 30

    if period == "7d":
        return 7

    return 7


def count_orders_by_status(
    db: Session,
    statuses: list[str],
    period_start: datetime | None,
) -> int:
    if not statuses:
        return 0

    query = db.query(Order).filter(Order.status.in_(statuses))
    query = apply_order_period(query, period_start)

    return query.count()


def get_order_count_for_day(db: Session, target_date: date) -> int:
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    return (
        db.query(Order)
        .filter(Order.created_at >= day_start, Order.created_at < day_end)
        .count()
    )


def get_inventory_summary(db: Session) -> DashboardInventorySummaryResponse:
    materials = db.query(Material).all()

    total_stock_value = 0
    in_stock_count = 0
    low_stock_count = 0
    out_of_stock_count = 0

    for material in materials:
        stock_quantity = (
            db.query(func.coalesce(func.sum(MaterialStockMovement.quantity), 0))
            .filter(MaterialStockMovement.material_id == material.id)
            .scalar()
        )

        stock_value = (
            db.query(func.coalesce(func.sum(MaterialStockMovement.total_cost), 0))
            .filter(MaterialStockMovement.material_id == material.id)
            .scalar()
        )

        total_stock_value += int(stock_value or 0)

        if stock_quantity <= 0:
            out_of_stock_count += 1
        elif stock_quantity <= 3:
            low_stock_count += 1
        else:
            in_stock_count += 1

    return DashboardInventorySummaryResponse(
        total_stock_value=total_stock_value,
        in_stock_count=in_stock_count,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
    )


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    period: str = Query("7d", pattern="^(today|7d|30d|all)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.read")),
):
    period_start = get_period_start(period)

    orders_query = apply_order_period(db.query(Order), period_start)
    total_orders = orders_query.count()

    new_count = count_orders_by_status(db, ["new"], period_start)
    in_progress_count = count_orders_by_status(db, ["in_progress"], period_start)
    completed_count = count_orders_by_status(db, COMPLETED_ORDER_STATUSES, period_start)
    delivered_count = count_orders_by_status(db, DELIVERED_ORDER_STATUSES, period_start)
    canceled_count = count_orders_by_status(db, CANCELED_ORDER_STATUSES, period_start)
    active_count = count_orders_by_status(db, ACTIVE_ORDER_STATUSES, period_start)

    total_price_query = apply_order_period(
        db.query(func.coalesce(func.sum(Order.total_price), 0)),
        period_start,
    )
    total_price = int(total_price_query.scalar() or 0)

    payment_query = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.status == "completed",
    )
    payment_query = apply_payment_period(payment_query, period_start)
    paid_amount = int(payment_query.scalar() or 0)

    remaining_amount = max(total_price - paid_amount, 0)

    profit_query = db.query(func.coalesce(func.sum(OrderItem.profit_snapshot), 0))
    profit_query = apply_order_item_period(profit_query, period_start)
    total_profit = int(profit_query.scalar() or 0)

    active_orders_query = db.query(Order).filter(
        Order.status.notin_(CANCELED_ORDER_STATUSES + DELIVERED_ORDER_STATUSES)
    )
    active_orders_query = apply_order_period(active_orders_query, period_start)

    active_orders = active_orders_query.count()

    orders_without_work_bay = active_orders_query.filter(
        Order.work_bay_id.is_(None)
    ).count()

    orders_without_master = active_orders_query.filter(
        Order.assigned_user_id.is_(None)
    ).count()

    orders_without_locked_pricing = active_orders_query.filter(
        Order.pricing_locked == False
    ).count()

    unfinished_checklist_query = (
        db.query(OrderChecklistItem.order_id)
        .join(Order, Order.id == OrderChecklistItem.order_id)
        .filter(
            Order.status.notin_(CANCELED_ORDER_STATUSES + DELIVERED_ORDER_STATUSES),
            OrderChecklistItem.status != "done",
        )
    )

    if period_start is not None:
        unfinished_checklist_query = unfinished_checklist_query.filter(
            Order.created_at >= period_start,
        )

    unfinished_checklist_order_ids = unfinished_checklist_query.distinct().count()

    inventory = get_inventory_summary(db)

    today = date.today()
    orders_by_day = []

    if period == "all":
        first_order_date = get_first_order_date(db)

        if first_order_date is None:
            chart_start_date = today
        else:
            chart_start_date = first_order_date

        days_range = (today - chart_start_date).days + 1

        for index in range(days_range):
            target_date = chart_start_date + timedelta(days=index)
            orders_by_day.append(
                DashboardMetricResponse(
                    label=target_date.strftime("%d.%m"),
                    value=get_order_count_for_day(db, target_date),
                )
            )
    else:
        days_range = get_orders_by_day_range(period)

        for index in range(days_range - 1, -1, -1):
            target_date = today - timedelta(days=index)
            orders_by_day.append(
                DashboardMetricResponse(
                    label=target_date.strftime("%d.%m"),
                    value=get_order_count_for_day(db, target_date),
                )
            )

    orders_summary = DashboardOrdersSummaryResponse(
        total=total_orders,
        new_count=new_count,
        in_progress_count=in_progress_count,
        completed_count=completed_count,
        delivered_count=delivered_count,
        canceled_count=canceled_count,
        active_count=active_count,
    )

    finance_summary = DashboardFinanceSummaryResponse(
        total_price=total_price,
        paid_amount=paid_amount,
        remaining_amount=remaining_amount,
        total_profit=total_profit,
    )

    production_summary = DashboardProductionSummaryResponse(
        active_orders=active_orders,
        orders_without_work_bay=orders_without_work_bay,
        orders_without_master=orders_without_master,
        orders_without_locked_pricing=orders_without_locked_pricing,
        orders_with_unfinished_checklist=unfinished_checklist_order_ids,
    )

    charts = DashboardChartsResponse(
        orders_by_status=[
            DashboardMetricResponse(label="Новые", value=new_count),
            DashboardMetricResponse(label="В работе", value=in_progress_count),
            DashboardMetricResponse(label="Завершены", value=completed_count),
            DashboardMetricResponse(label="Выданы", value=delivered_count),
            DashboardMetricResponse(label="Отменены", value=canceled_count),
        ],
        finance_breakdown=[
            DashboardMetricResponse(label="Оплачено", value=paid_amount),
            DashboardMetricResponse(label="Остаток", value=remaining_amount),
            DashboardMetricResponse(label="Прибыль", value=total_profit),
        ],
        inventory_status=[
            DashboardMetricResponse(label="В наличии", value=inventory.in_stock_count),
            DashboardMetricResponse(label="Мало", value=inventory.low_stock_count),
            DashboardMetricResponse(label="Нет остатка", value=inventory.out_of_stock_count),
        ],
        production_health=[
            DashboardMetricResponse(label="Без бокса", value=orders_without_work_bay),
            DashboardMetricResponse(label="Без мастера", value=orders_without_master),
            DashboardMetricResponse(label="Без pricing", value=orders_without_locked_pricing),
            DashboardMetricResponse(
                label="Незавершенный чеклист",
                value=unfinished_checklist_order_ids,
            ),
        ],
        orders_by_day=orders_by_day,
    )

    return DashboardSummaryResponse(
        orders=orders_summary,
        finance=finance_summary,
        production=production_summary,
        inventory=inventory,
        charts=charts,
    )