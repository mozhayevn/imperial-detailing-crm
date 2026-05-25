import json

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import SecurityAuditLog


def get_request_ip(request: Request | None) -> str | None:
    if request is None:
        return None

    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return None


def write_security_audit_log(
    db: Session,
    action: str,
    actor_user_id: int | None = None,
    target_user_id: int | None = None,
    request: Request | None = None,
    details: dict | None = None,
) -> SecurityAuditLog:
    audit_log = SecurityAuditLog(
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        action=action,
        details=json.dumps(details or {}, ensure_ascii=False),
        ip_address=get_request_ip(request),
        user_agent=request.headers.get("user-agent") if request else None,
    )

    db.add(audit_log)

    return audit_log