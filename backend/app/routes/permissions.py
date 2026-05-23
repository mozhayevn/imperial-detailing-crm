from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission, get_current_active_user
from app.models import Permission, Role, RolePermission, User
from app.schemas import PermissionCreate, PermissionResponse, RolePermissionAssign

router = APIRouter(prefix="/permissions", tags=["Permissions"])


@router.post("/", response_model=PermissionResponse)
def create_permission(
    permission_data: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("permissions.manage")),
):
    existing = db.query(Permission).filter(Permission.code == permission_data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Permission already exists")

    permission = Permission(
        code=permission_data.code,
        description=permission_data.description,
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission


@router.get("/", response_model=list[PermissionResponse])
def get_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(Permission).order_by(Permission.id.desc()).all()


@router.post("/assign-role")
def assign_permission_to_role(
    data: RolePermissionAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("permissions.manage")),
):
    role = db.query(Role).filter(Role.id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    permission = db.query(Permission).filter(Permission.id == data.permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    existing = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == data.role_id,
            RolePermission.permission_id == data.permission_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Permission already assigned to role")

    rp = RolePermission(role_id=data.role_id, permission_id=data.permission_id)
    db.add(rp)
    db.commit()
    return {"message": "Permission assigned to role"}