from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import hashlib

from app.database import get_db
from app.deps import get_current_active_user, get_user_roles, get_user_permissions
from app.models import User, UserSession, TwoFactorChallenge
from app.schemas import (
    LoginRequest,
    LoginResponse,
    MyPermissionsResponse,
    Token,
    UserResponse,
    VerifyTwoFactorRequest,
    ResendTwoFactorRequest,
    ResendTwoFactorResponse,
)
from app.security import verify_password, create_access_token
from app.two_factor import (
    create_two_factor_challenge,
    mask_email,
    send_two_factor_email,
    validate_two_factor_challenge,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def make_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_request_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return None


def create_user_session(
    user: User,
    access_token: str,
    request: Request,
    db: Session,
) -> None:
    session = UserSession(
        user_id=user.id,
        token_hash=make_token_hash(access_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=get_request_ip(request),
        is_active=True,
        created_at=datetime.utcnow(),
        last_seen_at=datetime.utcnow(),
    )

    db.add(session)
    db.commit()


def finish_login(
    user: User,
    request: Request,
    db: Session,
) -> dict:
    access_token = create_access_token(subject=str(user.id))
    create_user_session(user, access_token, request, db)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
    }


def start_two_factor_login(
    user: User,
    db: Session,
) -> dict:
    challenge, code = create_two_factor_challenge(
        db=db,
        user=user,
        method=user.two_factor_method or "email",
    )

    send_two_factor_email(user.email, code)

    return {
        "requires_2fa": True,
        "challenge_id": challenge.id,
        "method": challenge.method,
        "destination_masked": mask_email(user.email),
    }


def authenticate_user(email: str, password: str, db: Session) -> User:
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")

    return user


@router.post("/login", response_model=LoginResponse)
def login_json(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = authenticate_user(data.email, data.password, db)

    if user.two_factor_enabled:
        return start_two_factor_login(user, db)

    return finish_login(user, request, db)


@router.post("/login-form", response_model=LoginResponse)
def login_form(
    response: Response,
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(form_data.username, form_data.password, db)

    if user.two_factor_enabled:
        return start_two_factor_login(user, db)

    result = finish_login(user, request, db)

    response.set_cookie(
        key="access_token",
        value=result["access_token"],
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=60 * 60 * 24,
    )

    return result


@router.post("/verify-2fa", response_model=Token)
def verify_two_factor_login(
    data: VerifyTwoFactorRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    user = validate_two_factor_challenge(
        db=db,
        challenge_id=data.challenge_id,
        code=data.code,
    )

    access_token = create_access_token(subject=str(user.id))
    create_user_session(user, access_token, request, db)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=60 * 60 * 24,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.get("/my-permissions", response_model=MyPermissionsResponse)
def get_my_permissions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    direct_roles = get_user_roles(current_user.id, db)
    role_names = [role.name for role in direct_roles]

    permissions = sorted(list(get_user_permissions(current_user, db)))

    return MyPermissionsResponse(
        user_id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        is_super_admin=current_user.is_super_admin,
        roles=role_names,
        permissions=permissions,
    )


@router.post("/resend-2fa", response_model=ResendTwoFactorResponse)
def resend_two_factor_code(
    data: ResendTwoFactorRequest,
    db: Session = Depends(get_db),
):
    old_challenge = (
        db.query(TwoFactorChallenge)
        .filter(TwoFactorChallenge.id == data.challenge_id)
        .first()
    )

    if not old_challenge:
        raise HTTPException(status_code=404, detail="2FA challenge not found")

    if old_challenge.is_used:
        raise HTTPException(status_code=400, detail="2FA challenge already used")

    user = db.query(User).filter(User.id == old_challenge.user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    challenge, code = create_two_factor_challenge(
        db=db,
        user=user,
        method=user.two_factor_method or "email",
    )

    send_two_factor_email(user.email, code)

    return ResendTwoFactorResponse(
        challenge_id=challenge.id,
        method=challenge.method,
        destination_masked=mask_email(user.email),
    )
