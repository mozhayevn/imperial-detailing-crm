import hashlib
import random
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.services.safe_logging import safe_log_error, safe_log_warning
from app.models import TwoFactorChallenge, User


TWO_FACTOR_CODE_TTL_MINUTES = 10
TWO_FACTOR_MAX_ATTEMPTS = 5
TWO_FACTOR_RESEND_COOLDOWN_SECONDS = 45
TWO_FACTOR_MAX_CODES_PER_WINDOW = 5
TWO_FACTOR_RATE_LIMIT_WINDOW_MINUTES = 10


def generate_two_factor_code() -> str:
    return f"{random.randint(100000, 999999)}"


def hash_two_factor_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def verify_two_factor_code(raw_code: str, code_hash: str) -> bool:
    return hash_two_factor_code(raw_code.strip()) == code_hash


def mask_email(email: str) -> str:
    if "@" not in email:
        return "***"

    local, domain = email.split("@", 1)

    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[:2] + "***"

    return f"{masked_local}@{domain}"


def mask_phone(phone: str | None) -> str:
    if not phone:
        return "—"

    cleaned = phone.strip()

    if len(cleaned) <= 4:
        return "***"

    return f"{cleaned[:2]}***{cleaned[-2:]}"


def ensure_two_factor_rate_limit(
    db: Session,
    user: User,
    method: str,
) -> None:
    now = datetime.utcnow()

    latest_challenge = (
        db.query(TwoFactorChallenge)
        .filter(
            TwoFactorChallenge.user_id == user.id,
            TwoFactorChallenge.method == method,
        )
        .order_by(TwoFactorChallenge.created_at.desc())
        .first()
    )

    if latest_challenge:
        seconds_since_last = (now - latest_challenge.created_at).total_seconds()

        if seconds_since_last < TWO_FACTOR_RESEND_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Подождите немного перед повторной отправкой кода подтверждения."
                ),
            )

    window_start = now - timedelta(minutes=TWO_FACTOR_RATE_LIMIT_WINDOW_MINUTES)

    recent_codes_count = (
        db.query(TwoFactorChallenge)
        .filter(
            TwoFactorChallenge.user_id == user.id,
            TwoFactorChallenge.method == method,
            TwoFactorChallenge.created_at >= window_start,
        )
        .count()
    )

    if recent_codes_count >= TWO_FACTOR_MAX_CODES_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Слишком много запросов кода подтверждения. Попробуйте позже.",
        )


def create_two_factor_challenge(
    db: Session,
    user: User,
    method: str = "email",
) -> tuple[TwoFactorChallenge, str]:
    if method != "email":
        raise HTTPException(
            status_code=400,
            detail="Only email 2FA is available now",
        )

    ensure_two_factor_rate_limit(db=db, user=user, method=method)

    code = generate_two_factor_code()

    challenge = TwoFactorChallenge(
        user_id=user.id,
        method="email",
        destination=user.email,
        code_hash=hash_two_factor_code(code),
        is_used=False,
        attempts_count=0,
        expires_at=datetime.utcnow()
        + timedelta(minutes=TWO_FACTOR_CODE_TTL_MINUTES),
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    return challenge, code


def send_two_factor_email(email: str, code: str) -> None:
    subject = "Код подтверждения входа в Imperial CRM"

    text_body = f"""
Ваш код подтверждения входа в Imperial CRM: {code}

Код действует ограниченное время.
Если вы не пытались войти в CRM, просто проигнорируйте это письмо.
"""

    html_body = f"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;color:#e5e7eb;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="border:1px solid rgba(45,212,191,0.22);background:rgba(15,23,42,0.92);border-radius:24px;padding:28px;">
        <div style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#5eead4;font-weight:700;">
          Imperial CRM
        </div>

        <h1 style="margin:18px 0 8px;font-size:24px;line-height:32px;color:#ffffff;">
          Код подтверждения входа
        </h1>

        <p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#94a3b8;">
          Введите этот код на странице входа, чтобы подтвердить доступ к аккаунту.
        </p>

        <div style="margin:24px 0;padding:20px;border-radius:20px;background:rgba(45,212,191,0.10);border:1px solid rgba(45,212,191,0.25);text-align:center;">
          <div style="font-size:34px;letter-spacing:10px;font-weight:800;color:#ffffff;">
            {code}
          </div>
        </div>

        <p style="margin:0;font-size:13px;line-height:21px;color:#94a3b8;">
          Код действует ограниченное время. Если вы не пытались войти в CRM,
          просто проигнорируйте это письмо.
        </p>
      </div>
    </div>
  </body>
</html>
"""

    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        if settings.is_production:
            safe_log_error(
                "2FA email delivery is not configured",
                email=email,
            )
            raise HTTPException(
                status_code=500,
                detail="2FA email delivery is not configured",
            )

        safe_log_warning(
            "2FA development fallback code generated",
            email=email,
            two_factor_code=code,
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()

            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            smtp.send_message(message)
    except Exception as error:
        if settings.is_production:
            safe_log_error(
                "Failed to send 2FA email",
                email=email,
                error=str(error),
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to send 2FA email",
            ) from error

        safe_log_warning(
            "Failed to send 2FA email in development",
            email=email,
            error=str(error),
            two_factor_code=code,
        )


def validate_two_factor_challenge(
    db: Session,
    challenge_id: int,
    code: str,
) -> User:
    challenge = (
        db.query(TwoFactorChallenge)
        .filter(TwoFactorChallenge.id == challenge_id)
        .first()
    )

    if not challenge:
        raise HTTPException(status_code=404, detail="2FA challenge not found")

    if challenge.is_used:
        raise HTTPException(status_code=400, detail="2FA challenge already used")

    if challenge.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="2FA code expired")

    if challenge.attempts_count >= TWO_FACTOR_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many 2FA attempts")

    challenge.attempts_count += 1

    if not verify_two_factor_code(code, challenge.code_hash):
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid 2FA code")

    challenge.is_used = True
    challenge.used_at = datetime.utcnow()

    user = db.query(User).filter(User.id == challenge.user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.commit()

    return user
