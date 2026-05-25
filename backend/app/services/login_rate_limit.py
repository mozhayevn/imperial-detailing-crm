from datetime import datetime, timedelta
from threading import Lock

from fastapi import HTTPException, Request

from app.config import settings


_lock = Lock()
_attempts_by_key: dict[str, list[datetime]] = {}
_blocked_until_by_key: dict[str, datetime] = {}


def get_request_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return "unknown"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_rate_limit_keys(request: Request, email: str) -> list[str]:
    ip_address = get_request_ip(request)
    normalized_email = normalize_email(email)

    return [
        f"ip:{ip_address}",
        f"email:{normalized_email}",
        f"combo:{ip_address}:{normalized_email}",
    ]


def cleanup_old_attempts(now: datetime) -> None:
    window_start = now - timedelta(seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS)

    for key in list(_attempts_by_key.keys()):
        _attempts_by_key[key] = [
            attempt_at
            for attempt_at in _attempts_by_key[key]
            if attempt_at >= window_start
        ]

        if not _attempts_by_key[key]:
            _attempts_by_key.pop(key, None)

    for key in list(_blocked_until_by_key.keys()):
        if _blocked_until_by_key[key] <= now:
            _blocked_until_by_key.pop(key, None)


def check_login_rate_limit(request: Request, email: str) -> None:
    now = datetime.utcnow()

    with _lock:
        cleanup_old_attempts(now)

        for key in get_rate_limit_keys(request, email):
            blocked_until = _blocked_until_by_key.get(key)

            if blocked_until and blocked_until > now:
                raise HTTPException(
                    status_code=429,
                    detail="Слишком много попыток входа. Попробуйте позже.",
                )


def record_login_failure(request: Request, email: str) -> None:
    now = datetime.utcnow()
    keys = get_rate_limit_keys(request, email)

    with _lock:
        cleanup_old_attempts(now)

        for key in keys:
            attempts = _attempts_by_key.setdefault(key, [])
            attempts.append(now)

            if len(attempts) >= settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
                _blocked_until_by_key[key] = now + timedelta(
                    seconds=settings.LOGIN_RATE_LIMIT_BLOCK_SECONDS,
                )
                _attempts_by_key[key] = []


def clear_login_failures(request: Request, email: str) -> None:
    keys = get_rate_limit_keys(request, email)

    with _lock:
        for key in keys:
            _attempts_by_key.pop(key, None)
            _blocked_until_by_key.pop(key, None)