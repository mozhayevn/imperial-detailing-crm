from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import (
    BusinessExpense,
    Car,
    Client,
    ExpenseCategory,
    Order,
    OrderItem,
    Payment,
    User,
)
from app.schemas import (
    FinanceChartMetricResponse,
    FinanceChartsResponse,
    FinanceDailyChartItemResponse,
    FinanceOrderMarginResponse,
    FinanceOverviewResponse,
)

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


def get_payment_status(total_price: int, paid_amount: int) -> str:
    if total_price <= 0:
        return "Без суммы"

    if paid_amount <= 0:
        return "Не оплачено"

    if paid_amount < total_price:
        return "Частично оплачено"

    if paid_amount == total_price:
        return "Оплачено"

    return "Переплата"


def get_car_label(car: Car | None) -> str | None:
    if not car:
        return None

    parts = [car.brand, car.model]

    if car.plate_number:
        parts.append(f"({car.plate_number})")

    return " ".join(part for part in parts if part)


@router.get("/overview", response_model=FinanceOverviewResponse)
def get_finance_overview(
    period: str = Query("30d", pattern="^(today|7d|30d|all)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.read")),
):
    period_start = get_period_start(period)

    locked_orders_query = db.query(Order).filter(
        Order.pricing_locked == True,
        Order.status != "canceled",
    )
    locked_orders_query = apply_order_period(locked_orders_query, period_start)

    locked_orders = locked_orders_query.all()
    locked_order_ids = [order.id for order in locked_orders]

    if not locked_order_ids:
        expense_query = db.query(func.coalesce(func.sum(BusinessExpense.amount), 0)).filter(
            BusinessExpense.is_deleted == False,
        )
        if period_start is not None:
            expense_query = expense_query.filter(BusinessExpense.expense_date >= period_start)

        business_expenses = int(expense_query.scalar() or 0)
        net_profit = -business_expenses

        return FinanceOverviewResponse(
            period=period,
            orders_revenue=0,
            cash_received=0,
            accounts_receivable=0,
            gross_profit=0,
            business_expenses=business_expenses,
            net_profit=net_profit,
            average_order_value=0,
            payment_rate_percent=0,
            gross_margin_percent=0,
            net_margin_percent=0,
            orders_with_debt_count=0,
            locked_orders_count=0,
            paid_orders_count=0,
            partial_orders_count=0,
            unpaid_orders_count=0,
        )

    orders_revenue = int(
        db.query(func.coalesce(func.sum(Order.total_price), 0))
        .filter(Order.id.in_(locked_order_ids))
        .scalar()
        or 0
    )

    payment_query = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.status == "completed",
        Payment.order_id.in_(locked_order_ids),
    )
    payment_query = apply_payment_period(payment_query, period_start)

    cash_received = int(payment_query.scalar() or 0)

    gross_profit = int(
        db.query(func.coalesce(func.sum(OrderItem.profit_snapshot * OrderItem.quantity), 0))
        .filter(OrderItem.order_id.in_(locked_order_ids))
        .scalar()
        or 0
    )

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

    expense_query = db.query(func.coalesce(func.sum(BusinessExpense.amount), 0)).filter(
        BusinessExpense.is_deleted == False,
    )
    if period_start is not None:
        expense_query = expense_query.filter(BusinessExpense.expense_date >= period_start)

    business_expenses = int(expense_query.scalar() or 0)

    accounts_receivable = max(orders_revenue - cash_received, 0)
    net_profit = gross_profit - business_expenses
    orders_with_debt_count = partial_orders_count + unpaid_orders_count

    average_order_value = 0
    if locked_orders:
        average_order_value = round(orders_revenue / len(locked_orders))

    payment_rate_percent = 0
    if orders_revenue > 0:
        payment_rate_percent = min(round(cash_received / orders_revenue * 100), 100)

    gross_margin_percent = 0
    if orders_revenue > 0:
        gross_margin_percent = round(gross_profit / orders_revenue * 100)

    net_margin_percent = 0
    if orders_revenue > 0:
        net_margin_percent = round(net_profit / orders_revenue * 100)

    return FinanceOverviewResponse(
        period=period,
        orders_revenue=orders_revenue,
        cash_received=cash_received,
        accounts_receivable=accounts_receivable,
        gross_profit=gross_profit,
        business_expenses=business_expenses,
        net_profit=net_profit,
        average_order_value=average_order_value,
        payment_rate_percent=payment_rate_percent,
        gross_margin_percent=gross_margin_percent,
        net_margin_percent=net_margin_percent,
        orders_with_debt_count=orders_with_debt_count,
        locked_orders_count=len(locked_orders),
        paid_orders_count=paid_orders_count,
        partial_orders_count=partial_orders_count,
        unpaid_orders_count=unpaid_orders_count,
    )


@router.get(
    "/orders-margin",
    response_model=list[FinanceOrderMarginResponse],
)
def get_orders_margin_report(
    period: str = Query("30d", pattern="^(today|7d|30d|all)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.read")),
):
    period_start = get_period_start(period)

    orders_query = (
        db.query(Order)
        .options(
            joinedload(Order.client),
            joinedload(Order.car),
        )
        .filter(
            Order.pricing_locked == True,
            Order.status != "canceled",
        )
    )

    orders_query = apply_order_period(orders_query, period_start)

    orders = orders_query.order_by(Order.created_at.desc()).all()

    result: list[FinanceOrderMarginResponse] = []

    for order in orders:
        paid_amount = int(
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(
                Payment.order_id == order.id,
                Payment.status == "completed",
            )
            .scalar()
            or 0
        )

        base_cost = int(
            db.query(func.coalesce(func.sum(OrderItem.base_cost_snapshot * OrderItem.quantity), 0))
            .filter(OrderItem.order_id == order.id)
            .scalar()
            or 0
        )

        gross_profit = int(
            db.query(func.coalesce(func.sum(OrderItem.profit_snapshot * OrderItem.quantity), 0))
            .filter(OrderItem.order_id == order.id)
            .scalar()
            or 0
        )

        items_count = int(
            db.query(func.count(OrderItem.id))
            .filter(OrderItem.order_id == order.id)
            .scalar()
            or 0
        )

        margin_percent = 0
        if order.total_price > 0:
            margin_percent = round(gross_profit / order.total_price * 100)

        remaining_amount = max(order.total_price - paid_amount, 0)

        result.append(
            FinanceOrderMarginResponse(
                order_id=order.id,
                status=order.status,
                created_at=order.created_at,
                scheduled_at=order.scheduled_at,
                client_id=order.client_id,
                client_full_name=order.client.full_name if order.client else None,
                car_id=order.car_id,
                car_label=get_car_label(order.car),
                total_price=order.total_price,
                paid_amount=paid_amount,
                remaining_amount=remaining_amount,
                payment_status=get_payment_status(order.total_price, paid_amount),
                base_cost=base_cost,
                gross_profit=gross_profit,
                margin_percent=margin_percent,
                items_count=items_count,
                pricing_locked=order.pricing_locked,
            )
        )

    return result


def get_chart_dates(period: str, db: Session) -> list[datetime.date]:
    today = datetime.utcnow().date()

    if period == "today":
        start_date = today
    elif period == "7d":
        start_date = today - timedelta(days=6)
    elif period == "30d":
        start_date = today - timedelta(days=29)
    else:
        dates = [
            db.query(func.min(Order.created_at)).scalar(),
            db.query(func.min(Payment.paid_at)).scalar(),
            db.query(func.min(BusinessExpense.expense_date)).scalar(),
        ]
        existing_dates = [value.date() for value in dates if value is not None]
        start_date = min(existing_dates) if existing_dates else today

    days_count = (today - start_date).days + 1

    return [start_date + timedelta(days=index) for index in range(days_count)]


@router.get(
    "/charts",
    response_model=FinanceChartsResponse,
)
def get_finance_charts(
    period: str = Query("30d", pattern="^(today|7d|30d|all)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.read")),
):
    chart_dates = get_chart_dates(period, db)
    period_start = get_period_start(period)

    daily_items: list[FinanceDailyChartItemResponse] = []

    for target_date in chart_dates:
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        orders_revenue = int(
            db.query(func.coalesce(func.sum(Order.total_price), 0))
            .filter(
                Order.pricing_locked == True,
                Order.status != "canceled",
                Order.created_at >= day_start,
                Order.created_at < day_end,
            )
            .scalar()
            or 0
        )

        cash_received = int(
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .join(Order, Order.id == Payment.order_id)
            .filter(
                Payment.status == "completed",
                Payment.paid_at >= day_start,
                Payment.paid_at < day_end,
                Order.pricing_locked == True,
                Order.status != "canceled",
            )
            .scalar()
            or 0
        )

        business_expenses = int(
            db.query(func.coalesce(func.sum(BusinessExpense.amount), 0))
            .filter(
                BusinessExpense.is_deleted == False,
                BusinessExpense.expense_date >= day_start,
                BusinessExpense.expense_date < day_end,
            )
            .scalar()
            or 0
        )

        gross_profit = int(
            db.query(func.coalesce(func.sum(OrderItem.profit_snapshot * OrderItem.quantity), 0))
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                Order.pricing_locked == True,
                Order.status != "canceled",
                Order.created_at >= day_start,
                Order.created_at < day_end,
            )
            .scalar()
            or 0
        )

        net_profit = gross_profit - business_expenses

        daily_items.append(
            FinanceDailyChartItemResponse(
                label=target_date.strftime("%d.%m"),
                date=target_date.isoformat(),
                orders_revenue=orders_revenue,
                cash_received=cash_received,
                business_expenses=business_expenses,
                gross_profit=gross_profit,
                net_profit=net_profit,
            )
        )

    expenses_query = (
        db.query(
            ExpenseCategory.name,
            func.coalesce(func.sum(BusinessExpense.amount), 0),
        )
        .join(ExpenseCategory, ExpenseCategory.id == BusinessExpense.category_id)
        .filter(BusinessExpense.is_deleted == False)
    )

    if period_start is not None:
        expenses_query = expenses_query.filter(BusinessExpense.expense_date >= period_start)

    expenses_by_category = [
        FinanceChartMetricResponse(
            label=row[0],
            value=int(row[1] or 0),
        )
        for row in expenses_query.group_by(ExpenseCategory.name)
        .order_by(func.coalesce(func.sum(BusinessExpense.amount), 0).desc())
        .all()
    ]

    return FinanceChartsResponse(
        period=period,
        daily=daily_items,
        expenses_by_category=expenses_by_category,
    )
