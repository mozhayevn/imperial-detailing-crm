import logging

from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, ReplyKeyboardRemove

from app.common.schemas import LeadItemPayload, LeadPayload
from app.config import settings
from app.crm_client import CrmClientError, create_lead
from app.telegram.keyboards import (
    confirm_keyboard,
    phone_keyboard,
    service_keyboard,
    skip_keyboard,
    start_keyboard,
)
from app.telegram.states import LeadForm


router = Router()
logger = logging.getLogger(__name__)

HELP_TEXT = (
    "Imperial Detailing CRM Bot\n\n"
    "Я помогу оставить заявку на детейлинг.\n\n"
    "Что можно сделать:\n"
    "/start — открыть главное меню\n"
    "/new — начать новую заявку\n"
    "/requests — мои заявки\n"
    "/about — о компании и услугах\n"
    "/cancel — отменить заполнение\n"
    "/help — помощь\n\n"
    "Как работает заявка:\n"
    "1. Вы заполняете данные автомобиля и услуги.\n"
    "2. Бот отправляет заявку в CRM.\n"
    "3. Менеджер проверяет заявку.\n"
    "4. После подтверждения менеджер создает заказ.\n\n"
    "Бот не рассчитывает финальную цену и не создает заказ автоматически."
)


START_TEXT = (
    "Здравствуйте! Это бот Imperial Detailing.\n\n"
    "Я помогу оставить заявку на услугу детейлинга. "
    "После отправки заявки менеджер свяжется с вами для подтверждения записи."
)

REQUESTS_STUB_TEXT = (
    "Раздел “Мои заявки” скоро будет доступен.\n\n"
    "Сейчас после отправки заявки менеджер Imperial Detailing получает ее в CRM "
    "и связывается с вами для подтверждения записи.\n\n"
    "Чтобы оставить новую заявку, нажмите “Оставить заявку” или отправьте /new."
)

ABOUT_TEXT = (
    "Imperial Detailing — детейлинг-сервис для ухода, защиты и восстановления автомобиля.\n\n"
    "Основные направления:\n"
    "• Полировка кузова\n"
    "• Химчистка салона\n"
    "• Обклейка защитной пленкой\n"
    "• PDR — удаление вмятин без покраски\n"
    "• Шумоизоляция\n\n"
    "Через этого бота вы можете оставить заявку. "
    "Менеджер получит ее в CRM, уточнит детали, рассчитает стоимость и подтвердит запись."
)

FALLBACK_TEXT = (
    "Я могу помочь оставить заявку на детейлинг.\n\n"
    "Выберите действие в меню или используйте команды:\n"
    "/new — оставить заявку\n"
    "/requests — мои заявки\n"
    "/about — о компании\n"
    "/help — помощь"
)


def normalize_optional_text(value: str | None) -> str | None:
    if not value:
        return None

    text = value.strip()

    if not text or text.lower() == "пропустить":
        return None

    return text


def normalize_required_text(value: str | None) -> str | None:
    if not value:
        return None

    text = value.strip()

    if not text:
        return None

    return text


def get_username(message: Message) -> str | None:
    if not message.from_user or not message.from_user.username:
        return None

    return f"@{message.from_user.username}"


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None

    phone = value.strip()
    phone = phone.replace(" ", "")
    phone = phone.replace("-", "")
    phone = phone.replace("(", "")
    phone = phone.replace(")", "")

    if phone.startswith("8") and len(phone) == 11:
        phone = "+7" + phone[1:]

    if phone.startswith("7") and len(phone) == 11:
        phone = "+" + phone

    return phone


def is_valid_phone(value: str | None) -> bool:
    phone = normalize_phone(value)

    if not phone:
        return False

    if not phone.startswith("+"):
        return False

    digits = phone[1:]

    return digits.isdigit() and 10 <= len(digits) <= 15


def format_empty(value: object | None) -> str:
    if value is None:
        return "не указано"

    text = str(value).strip()

    return text if text else "не указано"


def build_lead_summary(data: dict) -> str:
    car_parts = [
        data.get("car_brand"),
        data.get("car_model"),
        data.get("car_year"),
    ]

    car_label = " ".join(
        str(part).strip()
        for part in car_parts
        if part is not None and str(part).strip()
    )

    if not car_label:
        car_label = "не указано"

    return (
        "✅ Проверьте заявку перед отправкой\n\n"
        "👤 Клиент\n"
        f"Имя: {format_empty(data.get('client_name'))}\n"
        f"Телефон: {format_empty(data.get('phone'))}\n\n"
        "🚗 Автомобиль\n"
        f"Авто: {car_label}\n"
        f"Цвет: {format_empty(data.get('car_color'))}\n"
        f"Госномер: {format_empty(data.get('plate_number'))}\n\n"
        "🧾 Услуга\n"
        f"Интересует: {format_empty(data.get('service_name'))}\n\n"
        "🕒 Удобное время\n"
        f"{format_empty(data.get('preferred_time'))}\n\n"
        "💬 Комментарий\n"
        f"{format_empty(data.get('comment'))}\n\n"
        "Если все верно, нажмите “Подтвердить заявку”."
    )


async def start_lead_form(message: Message, state: FSMContext) -> None:
    await state.clear()

    await message.answer(
        "Начнем оформление заявки.\n\n"
        "Как вас зовут?",
        reply_markup=ReplyKeyboardRemove(),
    )
    await state.set_state(LeadForm.client_name)


@router.message(CommandStart())
async def start_handler(message: Message, state: FSMContext) -> None:
    await state.clear()

    await message.answer(
        START_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(Command("new"))
async def new_lead_handler(message: Message, state: FSMContext) -> None:
    await start_lead_form(message, state)


@router.message(Command("help"))
async def help_handler(message: Message) -> None:
    await message.answer(
        HELP_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(Command("requests"))
async def requests_handler(message: Message) -> None:
    await message.answer(
        REQUESTS_STUB_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(Command("about"))
async def about_handler(message: Message) -> None:
    await message.answer(
        ABOUT_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(lambda message: message.text == "Помощь")
async def help_button_handler(message: Message) -> None:
    await message.answer(
        HELP_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(lambda message: message.text == "Мои заявки")
async def requests_button_handler(message: Message) -> None:
    await message.answer(
        REQUESTS_STUB_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(lambda message: message.text == "О компании")
async def about_button_handler(message: Message) -> None:
    await message.answer(
        ABOUT_TEXT,
        reply_markup=start_keyboard(),
    )


@router.message(lambda message: message.text == "Оставить заявку")
async def start_lead_button_handler(message: Message, state: FSMContext) -> None:
    await start_lead_form(message, state)


@router.message(Command("cancel"))
async def cancel_handler(message: Message, state: FSMContext) -> None:
    await state.clear()

    await message.answer(
        "Заявка отменена. Вы можете начать новую заявку из меню.",
        reply_markup=start_keyboard(),
    )


@router.message(LeadForm.client_name)
async def client_name_handler(message: Message, state: FSMContext) -> None:
    client_name = normalize_required_text(message.text)

    if not client_name:
        await message.answer("Пожалуйста, укажите ваше имя.")
        return

    await state.update_data(client_name=client_name)

    await message.answer(
        "Укажите номер телефона.\n\n"
        "Можно нажать кнопку ниже или отправить номер текстом в формате +77001234567.",
        reply_markup=phone_keyboard(),
    )
    await state.set_state(LeadForm.phone)


@router.message(LeadForm.phone)
async def phone_handler(message: Message, state: FSMContext) -> None:
    phone = None

    if message.contact and message.contact.phone_number:
        phone = normalize_phone(message.contact.phone_number)
    elif message.text:
        phone = normalize_phone(message.text)

    if not is_valid_phone(phone):
        await message.answer(
            "Пожалуйста, отправьте корректный номер телефона.\n\n"
            "Пример: +77001234567",
            reply_markup=phone_keyboard(),
        )
        return

    await state.update_data(phone=phone)

    await message.answer(
        "Какая у вас марка автомобиля?",
        reply_markup=ReplyKeyboardRemove(),
    )
    await state.set_state(LeadForm.car_brand)


@router.message(LeadForm.car_brand)
async def car_brand_handler(message: Message, state: FSMContext) -> None:
    car_brand = normalize_required_text(message.text)

    if not car_brand:
        await message.answer("Пожалуйста, укажите марку автомобиля.")
        return

    await state.update_data(car_brand=car_brand)

    await message.answer("Какая модель автомобиля?")
    await state.set_state(LeadForm.car_model)


@router.message(LeadForm.car_model)
async def car_model_handler(message: Message, state: FSMContext) -> None:
    car_model = normalize_required_text(message.text)

    if not car_model:
        await message.answer("Пожалуйста, укажите модель автомобиля.")
        return

    await state.update_data(car_model=car_model)

    await message.answer(
        "Укажите год выпуска, если знаете.",
        reply_markup=skip_keyboard(),
    )
    await state.set_state(LeadForm.car_year)


@router.message(LeadForm.car_year)
async def car_year_handler(message: Message, state: FSMContext) -> None:
    car_year = normalize_optional_text(message.text)

    if car_year is not None:
        try:
            year = int(car_year)
        except ValueError:
            await message.answer("Введите год числом, например 2021, или нажмите “Пропустить”.")
            return

        if year < 1950 or year > 2100:
            await message.answer("Введите корректный год, например 2021, или нажмите “Пропустить”.")
            return

        await state.update_data(car_year=year)
    else:
        await state.update_data(car_year=None)

    await message.answer(
        "Укажите цвет автомобиля, если хотите.",
        reply_markup=skip_keyboard(),
    )
    await state.set_state(LeadForm.car_color)


@router.message(LeadForm.car_color)
async def car_color_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(car_color=normalize_optional_text(message.text))

    await message.answer(
        "Укажите госномер, если хотите.",
        reply_markup=skip_keyboard(),
    )
    await state.set_state(LeadForm.plate_number)


@router.message(LeadForm.plate_number)
async def plate_number_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(plate_number=normalize_optional_text(message.text))

    await message.answer(
        "Какая услуга вас интересует?\n\n"
        "Выберите популярную услугу или нажмите “Другое”.",
        reply_markup=service_keyboard(),
    )
    await state.set_state(LeadForm.service_name)


@router.message(LeadForm.service_name)
async def service_name_handler(message: Message, state: FSMContext) -> None:
    service_name = normalize_required_text(message.text)

    if not service_name:
        await message.answer("Пожалуйста, выберите услугу или нажмите “Другое”.")
        return

    if service_name.lower() == "другое":
        await message.answer(
            "Напишите, какая услуга вас интересует.",
            reply_markup=ReplyKeyboardRemove(),
        )
        await state.set_state(LeadForm.custom_service_name)
        return

    await state.update_data(service_name=service_name)

    await message.answer(
        "Когда вам удобно приехать?\n\n"
        "Например: завтра после 15:00 или на выходных.",
        reply_markup=skip_keyboard(),
    )
    await state.set_state(LeadForm.preferred_time)


@router.message(LeadForm.custom_service_name)
async def custom_service_name_handler(message: Message, state: FSMContext) -> None:
    service_name = normalize_required_text(message.text)

    if not service_name:
        await message.answer("Пожалуйста, напишите название услуги.")
        return

    await state.update_data(service_name=service_name)

    await message.answer(
        "Когда вам удобно приехать?\n\n"
        "Например: завтра после 15:00 или на выходных.",
        reply_markup=skip_keyboard(),
    )
    await state.set_state(LeadForm.preferred_time)


@router.message(LeadForm.preferred_time)
async def preferred_time_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(preferred_time=normalize_optional_text(message.text))

    await message.answer(
        "Есть ли комментарий или пожелания?",
        reply_markup=skip_keyboard(),
    )
    await state.set_state(LeadForm.comment)


@router.message(LeadForm.comment)
async def comment_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(comment=normalize_optional_text(message.text))

    data = await state.get_data()

    summary = build_lead_summary(data)

    await message.answer(summary, reply_markup=confirm_keyboard())
    await state.set_state(LeadForm.confirm)


@router.message(LeadForm.confirm)
async def confirm_handler(message: Message, state: FSMContext) -> None:
    text = message.text.strip().lower()

    if text == "заполнить заново":
        await state.clear()
        await message.answer(
            "Хорошо, начнем заново. Как вас зовут?",
            reply_markup=ReplyKeyboardRemove(),
        )
        await state.set_state(LeadForm.client_name)
        return

    if text != "подтвердить заявку":
        await message.answer("Нажмите “Подтвердить заявку” или “Заполнить заново”.")
        return

    data = await state.get_data()

    required_fields = {
        "client_name": "имя клиента",
        "phone": "телефон",
        "car_brand": "марка автомобиля",
        "car_model": "модель автомобиля",
        "service_name": "услуга",
    }

    missing_fields = [
        label
        for field, label in required_fields.items()
        if not normalize_required_text(str(data.get(field) or ""))
    ]

    if missing_fields:
        await message.answer(
            "Не хватает обязательных данных: "
            + ", ".join(missing_fields)
            + ".\n\nНачните заявку заново командой /new.",
            reply_markup=ReplyKeyboardRemove(),
        )
        await state.clear()
        return

    external_user_id = str(message.from_user.id) if message.from_user else None

    payload = LeadPayload(
        source=settings.BOT_SOURCE,
        client_name=data.get("client_name"),
        phone=data["phone"],
        message=f"Заявка из Telegram-бота. Интересующая услуга: {data.get('service_name')}",
        car_brand=data.get("car_brand"),
        car_model=data.get("car_model"),
        car_year=data.get("car_year"),
        car_color=data.get("car_color"),
        plate_number=data.get("plate_number"),
        preferred_time=data.get("preferred_time"),
        comment=data.get("comment"),
        external_user_id=external_user_id,
        external_username=get_username(message),
        items=[
            LeadItemPayload(
                service_name_text=data["service_name"],
                quantity=1,
                comment=data.get("comment"),
            )
        ],
    )

    try:
        created_lead = await create_lead(payload)
    except CrmClientError:
        logger.exception(
            "Failed to create lead in CRM from Telegram bot. telegram_user_id=%s username=%s",
            message.from_user.id if message.from_user else None,
            get_username(message),
        )

        await message.answer(
            "Не удалось отправить заявку в CRM.\n\n"
            "Пожалуйста, попробуйте позже или свяжитесь с менеджером Imperial Detailing.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await state.clear()

    await message.answer(
        "✅ Спасибо! Ваша заявка принята.\n\n"
        f"Номер заявки: #{created_lead.get('id')}.\n\n"
        "Менеджер Imperial Detailing скоро свяжется с вами, "
        "уточнит детали и подтвердит запись.\n\n"
        "Чтобы оставить новую заявку, нажмите /new.",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message()
async def fallback_handler(message: Message) -> None:
    await message.answer(
        FALLBACK_TEXT,
        reply_markup=start_keyboard(),
    )