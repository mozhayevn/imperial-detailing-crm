import logging
import re
from typing import Any


logger = logging.getLogger("imperial_crm")


SENSITIVE_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "secret_key",
    "code",
    "two_factor_code",
    "smtp_password",
    "authorization",
    "cookie",
}


def mask_email(value: str) -> str:
    if "@" not in value:
        return value

    local, domain = value.split("@", 1)

    if len(local) <= 2:
        masked_local = local[:1] + "***"
    else:
        masked_local = local[:2] + "***"

    return f"{masked_local}@{domain}"


def mask_string(value: str) -> str:
    if not value:
        return value

    value = re.sub(
        r"([A-Za-z0-9._%+-]{2})[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
        r"\1***\2",
        value,
    )

    value = re.sub(
        r"(Bearer\s+)[A-Za-z0-9._\-]+",
        r"\1***",
        value,
        flags=re.IGNORECASE,
    )

    value = re.sub(
        r"\b\d{6}\b",
        "***",
        value,
    )

    return value


def sanitize_log_value(key: str, value: Any) -> Any:
    normalized_key = key.lower()

    if any(sensitive_key in normalized_key for sensitive_key in SENSITIVE_KEYS):
        return "***"

    if isinstance(value, str):
        return mask_string(value)

    if isinstance(value, dict):
        return sanitize_log_data(value)

    if isinstance(value, list):
        return [
            sanitize_log_value(key, item)
            for item in value
        ]

    return value


def sanitize_log_data(data: dict[str, Any]) -> dict[str, Any]:
    return {
        key: sanitize_log_value(key, value)
        for key, value in data.items()
    }


def safe_log_info(message: str, **data: Any) -> None:
    if data:
        logger.info("%s | %s", message, sanitize_log_data(data))
    else:
        logger.info("%s", message)


def safe_log_warning(message: str, **data: Any) -> None:
    if data:
        logger.warning("%s | %s", message, sanitize_log_data(data))
    else:
        logger.warning("%s", message)


def safe_log_error(message: str, **data: Any) -> None:
    if data:
        logger.error("%s | %s", message, sanitize_log_data(data))
    else:
        logger.error("%s", message)