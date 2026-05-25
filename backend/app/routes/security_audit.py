from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import SecurityAuditLog, User
from app.schemas import SecurityAuditLogResponse

router = APIRouter(prefix="/security-audit", tags=["Security Audit"])


@router.get("", response_model=list[SecurityAuditLogResponse])
def get_security_audit_logs(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("security.audit.read")),
):
    return (
        db.query(SecurityAuditLog)
        .options(
            joinedload(SecurityAuditLog.actor_user),
            joinedload(SecurityAuditLog.target_user),
        )
        .order_by(SecurityAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )