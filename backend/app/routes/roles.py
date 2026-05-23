from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission, get_current_active_user
from app.models import Role, RolePermission, Permission, User
from app.schemas import RoleCreate, RoleResponse, RolePermissionsResponse

router = APIRouter(prefix="/roles", tags=["Roles"])


def collect_parent_roles(role: Role, db: Session, collected: dict[int, Role]) -> None:
    if role.parent_role_id is None:
        return

    parent = db.query(Role).filter(Role.id == role.parent_role_id).first()
    if not parent:
        return

    if parent.id in collected:
        return

    collected[parent.id] = parent
    collect_parent_roles(parent, db, collected)


def get_direct_permission_codes(role_id: int, db: Session) -> list[str]:
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id == role_id)
        .all()
    )
    return sorted([row[0] for row in rows])


@router.post("/", response_model=RoleResponse)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles.manage")),
):
    existing = db.query(Role).filter(Role.name == role_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role already exists")

    if role_data.parent_role_id is not None:
        parent = db.query(Role).filter(Role.id == role_data.parent_role_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent role not found")

    role = Role(
        name=role_data.name,
        description=role_data.description,
        parent_role_id=role_data.parent_role_id,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.get("/", response_model=list[RoleResponse])
def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(Role).order_by(Role.id.desc()).all()


@router.get("/{role_id}/permissions", response_model=RolePermissionsResponse)
def get_role_permissions_view(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles.manage")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    direct_permissions = get_direct_permission_codes(role.id, db)

    collected_parents: dict[int, Role] = {}
    collect_parent_roles(role, db, collected_parents)

    inherited_permissions_set = set()
    for parent_role in collected_parents.values():
        parent_permissions = get_direct_permission_codes(parent_role.id, db)
        inherited_permissions_set.update(parent_permissions)

    inherited_permissions = sorted(list(inherited_permissions_set))
    all_permissions = sorted(list(set(direct_permissions) | set(inherited_permissions)))

    parent_role_name = None
    if role.parent_role_id is not None:
        parent = db.query(Role).filter(Role.id == role.parent_role_id).first()
        if parent:
            parent_role_name = parent.name

    return RolePermissionsResponse(
        role_id=role.id,
        role_name=role.name,
        parent_role_id=role.parent_role_id,
        parent_role_name=parent_role_name,
        direct_permissions=direct_permissions,
        inherited_permissions=inherited_permissions,
        all_permissions=all_permissions,
    )


@router.delete("/{role_id}/permissions/{permission_id}")
def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles.manage")),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    role_permission = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
        .first()
    )
    if not role_permission:
        raise HTTPException(status_code=404, detail="Permission is not assigned to this role")

    db.delete(role_permission)
    db.commit()

    return {"message": "Permission removed from role"}