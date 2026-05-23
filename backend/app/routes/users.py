from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission, get_user_roles, get_user_permissions
from app.models import User, Role, UserRole, UserRoleAuditLog
from app.schemas import (
    UserCreate,
    UserResponse,
    UserRoleAssign,
    MyPermissionsResponse,
    UserRolesResponse,
    UserRoleAuditLogResponse,
)
from app.security import get_password_hash

router = APIRouter(prefix="/users", tags=["Users"])


ADMIN_ALLOWED_ROLE_NAMES = {"manager", "master", "viewer"}


def get_user_role_names(user_id: int, db: Session) -> set[str]:
    rows = (
        db.query(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    )
    return {row[0] for row in rows}


def can_manage_users(current_user: User, db: Session) -> bool:
    if current_user.is_super_admin:
        return True

    role_names = get_user_role_names(current_user.id, db)
    return "admin" in role_names


def can_assign_role(current_user: User, target_role_name: str, db: Session) -> bool:
    if current_user.is_super_admin:
        return True

    role_names = get_user_role_names(current_user.id, db)
    if "admin" in role_names and target_role_name in ADMIN_ALLOWED_ROLE_NAMES:
        return True

    return False


@router.post("/", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    if not can_manage_users(current_user, db):
        raise HTTPException(status_code=403, detail="Not enough permissions to create users")

    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    if user_data.phone:
        existing_phone = db.query(User).filter(User.phone == user_data.phone).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone already exists")

    if user_data.is_super_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="Only super admin can create another super admin"
        )

    selected_roles = []

    if user_data.role_ids:
        selected_roles = db.query(Role).filter(Role.id.in_(user_data.role_ids)).all()

        found_role_ids = {role.id for role in selected_roles}
        missing_role_ids = set(user_data.role_ids) - found_role_ids

        if missing_role_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Roles not found: {sorted(missing_role_ids)}",
            )

        for role in selected_roles:
            if not can_assign_role(current_user, role.name, db):
                raise HTTPException(
                    status_code=403,
                    detail=f"You cannot assign role '{role.name}'",
                )

    user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        is_active=user_data.is_active,
        is_super_admin=user_data.is_super_admin,
        must_change_password=user_data.must_change_password,
    )

    db.add(user)
    db.flush()

    audit_log = UserRoleAuditLog(
        actor_user_id=current_user.id,
        target_user_id=user.id,
        role_id=None,
        action="user_created",
        details=f"User {user.email} was created",
    )
    db.add(audit_log)

    for role in selected_roles:
        user_role = UserRole(
            user_id=user.id,
            role_id=role.id,
        )
        db.add(user_role)

        role_audit_log = UserRoleAuditLog(
            actor_user_id=current_user.id,
            target_user_id=user.id,
            role_id=role.id,
            action="role_assigned",
            details=f"Role '{role.name}' assigned to user {user.email} during user creation",
        )
        db.add(role_audit_log)

    db.commit()
    db.refresh(user)

    return user


@router.get("/", response_model=list[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    query = db.query(User)

    if not current_user.is_super_admin:
        query = query.filter(User.is_super_admin == False)

    return query.order_by(User.id.desc()).all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_super_admin and not current_user.is_super_admin:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.get("/{user_id}/permissions", response_model=MyPermissionsResponse)
def get_user_permissions_view(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_super_admin and not current_user.is_super_admin:
        raise HTTPException(status_code=404, detail="User not found")

    direct_roles = get_user_roles(user.id, db)
    role_names = [role.name for role in direct_roles]

    permissions = sorted(list(get_user_permissions(user, db)))

    return MyPermissionsResponse(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_super_admin=user.is_super_admin,
        roles=role_names,
        permissions=permissions,
    )


@router.get("/{user_id}/roles", response_model=UserRolesResponse)
def get_user_roles_view(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    roles = get_user_roles(user.id, db)
    role_names = [role.name for role in roles]

    return UserRolesResponse(
        user_id=user.id,
        full_name=user.full_name,
        roles=role_names,
    )


@router.get("/{user_id}/audit-logs", response_model=list[UserRoleAuditLogResponse])
def get_user_audit_logs(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logs = (
        db.query(UserRoleAuditLog)
        .options(
            joinedload(UserRoleAuditLog.actor_user),
            joinedload(UserRoleAuditLog.target_user),
            joinedload(UserRoleAuditLog.role),
        )
        .filter(UserRoleAuditLog.target_user_id == user_id)
        .order_by(UserRoleAuditLog.created_at.desc())
        .all()
    )

    return logs


@router.post("/assign-role")
def assign_role_to_user(
    data: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    if not can_manage_users(current_user, db):
        raise HTTPException(status_code=403, detail="Not enough permissions to assign roles")

    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if not can_assign_role(current_user, role.name, db):
        raise HTTPException(
            status_code=403,
            detail=f"You cannot assign role '{role.name}'"
        )

    if user.is_super_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="You cannot change roles of super admin"
        )

    existing = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == data.user_id,
            UserRole.role_id == data.role_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Role already assigned to user")

    user_role = UserRole(user_id=data.user_id, role_id=data.role_id)
    db.add(user_role)
    db.commit()

    audit_log = UserRoleAuditLog(
        actor_user_id=current_user.id,
        target_user_id=user.id,
        role_id=role.id,
        action="role_assigned",
        details=f"Role '{role.name}' assigned to user {user.email}",
    )
    db.add(audit_log)
    db.commit()
    return {"message": "Role assigned to user"}


@router.delete("/{user_id}/roles/{role_id}")
def remove_role_from_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    if not can_manage_users(current_user, db):
        raise HTTPException(status_code=403, detail="Not enough permissions to remove roles")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if not can_assign_role(current_user, role.name, db):
        raise HTTPException(
            status_code=403,
            detail=f"You cannot remove role '{role.name}'"
        )

    if user.is_super_admin and not current_user.is_super_admin:
        raise HTTPException(
            status_code=403,
            detail="You cannot change roles of super admin"
        )

    user_role = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
        .first()
    )
    if not user_role:
        raise HTTPException(status_code=404, detail="User does not have this role")

    db.delete(user_role)
    db.commit()

    audit_log = UserRoleAuditLog(
        actor_user_id=current_user.id,
        target_user_id=user.id,
        role_id=role.id,
        action="role_removed",
        details=f"Role '{role.name}' removed from user {user.email}",
    )
    db.add(audit_log)
    db.commit()
    return {"message": "Role removed from user"}
