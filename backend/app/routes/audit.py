from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import (
    OrderAuditLog,
    PricingAuditLog,
    PaymentAuditLog,
    UserRoleAuditLog,
    OrderChecklistAuditLog,
    User,
)
from app.schemas import RecentAuditEventResponse

router = APIRouter(prefix="/audit", tags=["Audit"])


SOURCE_LABELS = {
    "orders": "Заказы",
    "pricing": "Ценообразование",
    "payments": "Оплаты",
    "checklist": "Производственный чеклист",
    "access": "Роли и доступы",
}


ACTION_LABELS = {
    "created": "Заказ создан",
    "updated": "Заказ обновлен",
    "status_changed": "Статус заказа изменен",
    "canceled": "Заказ отменен",
    "rescheduled": "Заказ перенесен",

    "pricing_applied": "Цена зафиксирована",
    "pricing_unlocked": "Цена разблокирована",

    "payment_created": "Оплата добавлена",
    "payment_canceled": "Оплата отменена",

    "checklist_created": "Чеклист создан",
    "item_updated": "Пункт чеклиста изменен",
    "item_completed": "Пункт чеклиста выполнен",
    "item_reopened": "Пункт чеклиста открыт повторно",

    "user_created": "Пользователь создан",
    "role_assigned": "Роль назначена",
    "role_removed": "Роль удалена",
}


def get_source_label(source: str) -> str:
    return SOURCE_LABELS.get(source, source)


def get_action_label(action: str) -> str:
    return ACTION_LABELS.get(action, action)


def map_order_audit_event(log: OrderAuditLog) -> RecentAuditEventResponse:
    return RecentAuditEventResponse(
        id=f"orders-{log.id}",
        source="orders",
        source_label=get_source_label("orders"),
        action=log.action,
        action_label=get_action_label(log.action),
        actor_user_id=log.actor_user_id,
        actor_user_full_name=log.actor_user_full_name,
        order_id=log.order_id,
        details=log.details,
        created_at=log.created_at,
    )


def map_pricing_audit_event(log: PricingAuditLog) -> RecentAuditEventResponse:
    return RecentAuditEventResponse(
        id=f"pricing-{log.id}",
        source="pricing",
        source_label=get_source_label("pricing"),
        action=log.action,
        action_label=get_action_label(log.action),
        actor_user_id=log.actor_user_id,
        actor_user_full_name=log.actor_user_full_name,
        order_id=log.order_id,
        details=log.details,
        created_at=log.created_at,
    )


def map_payment_audit_event(log: PaymentAuditLog) -> RecentAuditEventResponse:
    return RecentAuditEventResponse(
        id=f"payments-{log.id}",
        source="payments",
        source_label=get_source_label("payments"),
        action=log.action,
        action_label=get_action_label(log.action),
        actor_user_id=log.actor_user_id,
        actor_user_full_name=log.actor_user_full_name,
        order_id=log.order_id,
        payment_id=log.payment_id,
        details=log.details,
        created_at=log.created_at,
    )


def map_checklist_audit_event(
    log: OrderChecklistAuditLog,
) -> RecentAuditEventResponse:
    return RecentAuditEventResponse(
        id=f"checklist-{log.id}",
        source="checklist",
        source_label=get_source_label("checklist"),
        action=log.action,
        action_label=get_action_label(log.action),
        actor_user_id=log.actor_user_id,
        actor_user_full_name=log.actor_user_full_name,
        order_id=log.order_id,
        checklist_item_id=log.checklist_item_id,
        details=log.details,
        created_at=log.created_at,
    )


def map_user_role_audit_event(
    log: UserRoleAuditLog,
) -> RecentAuditEventResponse:
    return RecentAuditEventResponse(
        id=f"access-{log.id}",
        source="access",
        source_label=get_source_label("access"),
        action=log.action,
        action_label=get_action_label(log.action),
        actor_user_id=log.actor_user_id,
        actor_user_full_name=log.actor_user_full_name,
        target_user_id=log.target_user_id,
        target_user_full_name=log.target_user_full_name,role_id=log.role_id,
        role_name=log.role_name,
        details=log.details,
        created_at=log.created_at,
    )


@router.get("/recent", response_model=list[RecentAuditEventResponse])
def get_recent_audit_events(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.read")),
):
    events: list[RecentAuditEventResponse] = []

    order_logs = (
        db.query(OrderAuditLog)
        .options(joinedload(OrderAuditLog.actor_user))
        .order_by(OrderAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    events.extend(map_order_audit_event(log) for log in order_logs)

    pricing_logs = (
        db.query(PricingAuditLog)
        .options(joinedload(PricingAuditLog.actor_user))
        .order_by(PricingAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    events.extend(map_pricing_audit_event(log) for log in pricing_logs)

    payment_logs = (
        db.query(PaymentAuditLog)
        .options(joinedload(PaymentAuditLog.actor_user))
        .order_by(PaymentAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    events.extend(map_payment_audit_event(log) for log in payment_logs)

    checklist_logs = (
        db.query(OrderChecklistAuditLog)
        .options(joinedload(OrderChecklistAuditLog.actor_user))
        .order_by(OrderChecklistAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    events.extend(map_checklist_audit_event(log) for log in checklist_logs)

    access_logs = (
        db.query(UserRoleAuditLog)
        .options(
            joinedload(UserRoleAuditLog.actor_user),
            joinedload(UserRoleAuditLog.target_user),
            joinedload(UserRoleAuditLog.role),
        )
        .order_by(UserRoleAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    events.extend(map_user_role_audit_event(log) for log in access_logs)

    events.sort(key=lambda event: event.created_at, reverse=True)

    return events[:limit]