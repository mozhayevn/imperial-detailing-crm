import hashlib
from datetime import datetime

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    User,
    Role,
    UserRole,
    RolePermission,
    Permission,
    UserSession,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login-form", auto_error=False)


def make_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_token_from_request(
    request: Request,
    token_from_header: str | None = Depends(oauth2_scheme),
) -> str | None:
    if token_from_header:
        return token_from_header
    return request.cookies.get("access_token")


def get_current_user(
    token: str | None = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id: str | None = payload.get("sub")

        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user:
        raise credentials_exception

    token_hash = make_token_hash(token)

    session = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user.id,
            UserSession.token_hash == token_hash,
        )
        .first()
    )

    if not session:
        raise credentials_exception

    if not session.is_active:
        raise credentials_exception

    session.last_seen_at = datetime.utcnow()
    db.commit()

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user


def require_super_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


def get_user_roles(user_id: int, db: Session) -> list[Role]:
    return (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    )


def collect_role_hierarchy(role: Role, db: Session, collected: dict[int, Role]) -> None:
    if role.id in collected:
        return

    collected[role.id] = role

    if role.parent_role_id is not None:
        parent = db.query(Role).filter(Role.id == role.parent_role_id).first()
        if parent:
            collect_role_hierarchy(parent, db, collected)


def get_all_user_roles_with_inheritance(user_id: int, db: Session) -> list[Role]:
    direct_roles = get_user_roles(user_id, db)
    collected: dict[int, Role] = {}

    for role in direct_roles:
        collect_role_hierarchy(role, db, collected)

    return list(collected.values())


def get_user_permissions(current_user: User, db: Session) -> set[str]:
    if current_user.is_super_admin:
        return {"*"}

    roles = get_all_user_roles_with_inheritance(current_user.id, db)
    role_ids = [role.id for role in roles]

    if not role_ids:
        return set()

    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .filter(RolePermission.role_id.in_(role_ids))
        .all()
    )

    return {row[0] for row in rows}


def require_permission(permission_code: str):
    def checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        permissions = get_user_permissions(current_user, db)

        if "*" in permissions:
            return current_user

        if permission_code not in permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Permission '{permission_code}' required",
            )

        return current_user

    return checker
