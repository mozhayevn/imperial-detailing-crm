import logging

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.common.schemas import LeadPayload
from app.config import settings


logger = logging.getLogger(__name__)


def format_empty(value: object | None) -> str:
    if value is None:
        return "не указано"

    text = str(value).strip()

    return text if text else "не указано"


def build_crm_url(path: str) -> str:
    base_url = settings.CRM_FRONTEND_URL.rstrip("/")
    normalized_path = path if path.startswith("/") else f"/{path}"

    return f"{base_url}{normalized_path}"


def can_use_inline_crm_links() -> bool:
    frontend_url = settings.CRM_FRONTEND_URL.strip().lower()

    return not (
        frontend_url.startswith("http://localhost")
        or frontend_url.startswith("http://127.0.0.1")
        or frontend_url.startswith("https://localhost")
        or frontend_url.startswith("https://127.0.0.1")
    )


def build_manager_new_lead_keyboard(created_lead: dict) -> InlineKeyboardMarkup:
    lead_id = created_lead.get("id")

    buttons = [
        [
            InlineKeyboardButton(
                text="Открыть заявку в CRM",
                url=build_crm_url(f"/leads/{lead_id}"),
            )
        ],
        [
            InlineKeyboardButton(
                text="Все заявки",
                url=build_crm_url("/leads"),
            )
        ],
    ]

    return InlineKeyboardMarkup(inline_keyboard=buttons)


def build_manager_new_lead_message(
    created_lead: dict,
    payload: LeadPayload,
) -> str:
    lead_id = created_lead.get("id")

    car_parts = [
        payload.car_brand,
        payload.car_model,
        payload.car_year,
    ]

    car_label = " ".join(
        str(part).strip()
        for part in car_parts
        if part is not None and str(part).strip()
    )

    if not car_label:
        car_label = "не указано"

    service_names = [
        item.service_name_text
        for item in payload.items
        if item.service_name_text
    ]

    services_label = ", ".join(service_names) if service_names else "не указано"

    return (
        f"🆕 Новая заявка #{lead_id}\n\n"
        "👤 Клиент\n"
        f"Имя: {format_empty(payload.client_name)}\n"
        f"Телефон: {format_empty(payload.phone)}\n\n"
        "🚗 Автомобиль\n"
        f"Авто: {car_label}\n"
        f"Цвет: {format_empty(payload.car_color)}\n"
        f"Госномер: {format_empty(payload.plate_number)}\n\n"
        "🧾 Услуга\n"
        f"{services_label}\n\n"
        "🕒 Удобное время\n"
        f"{format_empty(payload.preferred_time)}\n\n"
        "💬 Комментарий\n"
        f"{format_empty(payload.comment)}\n\n"
        "Источник: Telegram bot\n"
        f"CRM: /leads/{lead_id}\n"
        "Откройте CRM → Заявки."
    )


async def notify_managers_about_new_lead(
    bot: Bot,
    created_lead: dict,
    payload: LeadPayload,
) -> None:
    if settings.MANAGER_CHAT_ID is None:
        logger.info("Manager chat id is not configured. Notification skipped.")
        return

    message_text = build_manager_new_lead_message(
        created_lead=created_lead,
        payload=payload,
    )

    try:
        reply_markup = (
            build_manager_new_lead_keyboard(created_lead)
            if can_use_inline_crm_links()
            else None
        )

        await bot.send_message(
            chat_id=settings.MANAGER_CHAT_ID,
            text=message_text,
            reply_markup=reply_markup,
        )
    except Exception:
        logger.exception(
            "Failed to send new lead notification to manager chat. chat_id=%s lead_id=%s",
            settings.MANAGER_CHAT_ID,
            created_lead.get("id"),
        )