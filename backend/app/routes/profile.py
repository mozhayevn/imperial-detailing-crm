import hashlib
import os
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_active_user
from app.models import User, UserSession
from app.schemas import (
    ChangePasswordRequest,
    ProfilePrivacyUpdateRequest,
    ProfileResponse,
    ProfileUpdateRequest,
    UserSessionResponse,
)
from app.security import get_password_hash, verify_password
from app.schemas import (
    TwoFactorDisableRequest,
    TwoFactorEnableRequest,
    TwoFactorSendCodeRequest,
    TwoFactorStatusResponse,
)
from app.services.security_audit import write_security_audit_log
from app.two_factor import (
    create_two_factor_challenge,
    mask_email,
    send_two_factor_email,
    validate_two_factor_challenge,
)

router = APIRouter(prefix="/profile", tags=["Profile"])

AVATAR_UPLOAD_DIR = Path("uploads/avatars")
ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_AVATAR_SIZE_BYTES = 3 * 1024 * 1024


def make_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")

    if authorization and authorization.lower().startswith("bearer "):
      return authorization.split(" ", 1)[1].strip()

    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token

    return None


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(
    current_user: User = Depends(get_current_active_user),
):
    return current_user


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if data.full_name is not None:
        full_name = data.full_name.strip()

        if not full_name:
            raise HTTPException(status_code=400, detail="Full name is required")

        current_user.full_name = full_name

    if data.phone is not None:
        phone = data.phone.strip() or None

        if phone:
            existing_user = (
                db.query(User)
                .filter(User.phone == phone, User.id != current_user.id)
                .first()
            )

            if existing_user:
                raise HTTPException(status_code=409, detail="Phone already exists")

        current_user.phone = phone

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/avatar", response_model=ProfileResponse)
def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if file.content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG and WEBP images are allowed",
        )

    AVATAR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    extension_by_type = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    extension = extension_by_type[file.content_type]
    filename = f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}{extension}"
    file_path = AVATAR_UPLOAD_DIR / filename

    size = 0

    with file_path.open("wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)

            if not chunk:
                break

            size += len(chunk)

            if size > MAX_AVATAR_SIZE_BYTES:
                buffer.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail="Avatar file is too large. Max size is 3 MB",
                )

            buffer.write(chunk)

    current_user.avatar_url = f"/uploads/avatars/{filename}"

    db.commit()
    db.refresh(current_user)

    return current_user


@router.patch("/privacy", response_model=ProfileResponse)
def update_my_privacy(
    data: ProfilePrivacyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    current_user.privacy_show_phone = data.privacy_show_phone
    current_user.privacy_show_email = data.privacy_show_email
    current_user.privacy_show_activity = data.privacy_show_activity
    current_user.privacy_show_online_status = data.privacy_show_online_status
    current_user.privacy_show_order_load = data.privacy_show_order_load
    current_user.privacy_show_audit_history = data.privacy_show_audit_history

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/change-password")
def change_my_password(
    data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_password = data.new_password.strip()

    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must contain at least 8 characters",
        )

    if verify_password(new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = get_password_hash(new_password)
    current_user.must_change_password = False

    write_security_audit_log(
        db=db,
        action="password_changed",
        actor_user_id=current_user.id,
        target_user_id=current_user.id,
        request=request,
        details={
            "message": "Пользователь изменил пароль",
        },
    )

    db.commit()

    return {"message": "Password changed successfully"}


@router.get("/sessions", response_model=list[UserSessionResponse])
def get_my_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id)
        .order_by(UserSession.last_seen_at.desc())
        .all()
    )


@router.delete("/sessions/{session_id}")
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = (
        db.query(UserSession)
        .filter(
            UserSession.id == session_id,
            UserSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False
    session.revoked_at = datetime.utcnow()

    write_security_audit_log(
        db=db,
        action="session_revoked",
        actor_user_id=current_user.id,
        target_user_id=current_user.id,
        request=request,
        details={
            "message": "Пользователь отключил активную сессию",
            "session_id": session.id,
            "session_user_agent": session.user_agent,
            "session_ip_address": session.ip_address,
        },
    )

    db.commit()

    return {"message": "Session revoked"}


@router.get("/2fa/status", response_model=TwoFactorStatusResponse)
def get_two_factor_status(
    current_user: User = Depends(get_current_active_user),
):
    return TwoFactorStatusResponse(
        enabled=current_user.two_factor_enabled,
        method=current_user.two_factor_method,
        destination_masked=mask_email(current_user.email),
        email_verified=current_user.email_verified,
        phone_verified=current_user.phone_verified,
    )


@router.post("/2fa/send-code")
def send_two_factor_setup_code(
    data: TwoFactorSendCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if data.method != "email":
        raise HTTPException(
            status_code=400,
            detail="Only email 2FA is available now",
        )

    challenge, code = create_two_factor_challenge(
        db=db,
        user=current_user,
        method="email",
    )

    send_two_factor_email(current_user.email, code)

    write_security_audit_log(
        db=db,
        action="two_factor_setup_code_sent",
        actor_user_id=current_user.id,
        target_user_id=current_user.id,
        request=request,
        details={
            "message": "Пользователь запросил код для настройки двухфакторной защиты",
            "method": "email",
            "destination_masked": mask_email(current_user.email),
        },
    )

    db.commit()

    return {
        "challenge_id": challenge.id,
        "method": "email",
        "destination_masked": mask_email(current_user.email),
    }


@router.post("/2fa/enable", response_model=TwoFactorStatusResponse)
def enable_two_factor(
    data: TwoFactorEnableRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    verified_user = validate_two_factor_challenge(
        db=db,
        challenge_id=data.challenge_id,
        code=data.code,
    )

    if verified_user.id != current_user.id:
        raise HTTPException(status_code=403, detail="Invalid 2FA challenge")

    current_user.two_factor_enabled = True
    current_user.two_factor_method = "email"
    current_user.email_verified = True

    write_security_audit_log(
        db=db,
        action="two_factor_enabled",
        actor_user_id=current_user.id,
        target_user_id=current_user.id,
        request=request,
        details={
            "message": "Пользователь включил двухфакторную защиту",
            "method": "email",
            "destination_masked": mask_email(current_user.email),
        },
    )

    db.commit()
    db.refresh(current_user)

    return TwoFactorStatusResponse(
        enabled=current_user.two_factor_enabled,
        method=current_user.two_factor_method,
        destination_masked=mask_email(current_user.email),
        email_verified=current_user.email_verified,
        phone_verified=current_user.phone_verified,
    )


@router.post("/2fa/disable", response_model=TwoFactorStatusResponse)
def disable_two_factor(
    data: TwoFactorDisableRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.two_factor_enabled = False
    current_user.two_factor_method = None

    write_security_audit_log(
        db=db,
        action="two_factor_disabled",
        actor_user_id=current_user.id,
        target_user_id=current_user.id,
        request=request,
        details={
            "message": "Пользователь отключил двухфакторную защиту",
            "method": "email",
            "destination_masked": mask_email(current_user.email),
        },
    )

    db.commit()
    db.refresh(current_user)

    return TwoFactorStatusResponse(
        enabled=current_user.two_factor_enabled,
        method=current_user.two_factor_method,
        destination_masked=mask_email(current_user.email),
        email_verified=current_user.email_verified,
        phone_verified=current_user.phone_verified,
    )
