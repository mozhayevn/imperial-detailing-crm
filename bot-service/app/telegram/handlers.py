from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, ReplyKeyboardRemove

from app.common.schemas import LeadItemPayload, LeadPayload
from app.config import settings
from app.crm_client import CrmClientError, create_lead
from app.telegram.keyboards import confirm_keyboard, skip_keyboard
from app.telegram.states import LeadForm


router = Router()


def normalize_optional_text(value: str | None) -> str | None:
    if not value:
        return None

    text = value.strip()

    if not text or text.lower() == "пропустить":
        return None

    return text


def get_username(message: Message) -> str | None:
    if not message.from_user or not message.from_user.username:
        return None

    return f"@{message.from_user.username}"


@router.message(CommandStart())
async def start_handler(message: Message, state: FSMContext) -> None:
    await state.clear()

    await message.answer(
        "Здравствуйте! Я помогу оставить заявку в Imperial Detailing.\n\n"
        "Как вас зовут?"
    )
    await state.set_state(LeadForm.client_name)


@router.message(Command("new"))
async def new_lead_handler(message: Message, state: FSMContext) -> None:
    await state.clear()

    await message.answer("Начнем новую заявку. Как вас зовут?")
    await state.set_state(LeadForm.client_name)


@router.message(Command("cancel"))
async def cancel_handler(message: Message, state: FSMContext) -> None:
    await state.clear()

    await message.answer(
        "Заявка отменена. Чтобы начать заново, нажмите /start.",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(LeadForm.client_name)
async def client_name_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(client_name=message.text.strip())

    await message.answer("Укажите номер телефона.")
    await state.set_state(LeadForm.phone)


@router.message(LeadForm.phone)
async def phone_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(phone=message.text.strip())

    await message.answer("Какая у вас марка автомобиля?")
    await state.set_state(LeadForm.car_brand)


@router.message(LeadForm.car_brand)
async def car_brand_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(car_brand=message.text.strip())

    await message.answer("Какая модель автомобиля?")
    await state.set_state(LeadForm.car_model)


@router.message(LeadForm.car_model)
async def car_model_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(car_model=message.text.strip())

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
        "Например: Полировка, Химчистка, Обклейка, PDR.",
        reply_markup=ReplyKeyboardRemove(),
    )
    await state.set_state(LeadForm.service_name)


@router.message(LeadForm.service_name)
async def service_name_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(service_name=message.text.strip())

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

    summary = (
        "Проверьте заявку:\n\n"
        f"Имя: {data.get('client_name')}\n"
        f"Телефон: {data.get('phone')}\n"
        f"Авто: {data.get('car_brand')} {data.get('car_model')}\n"
        f"Год: {data.get('car_year') or 'не указан'}\n"
        f"Цвет: {data.get('car_color') or 'не указан'}\n"
        f"Госномер: {data.get('plate_number') or 'не указан'}\n"
        f"Услуга: {data.get('service_name')}\n"
        f"Удобное время: {data.get('preferred_time') or 'не указано'}\n"
        f"Комментарий: {data.get('comment') or 'нет'}"
    )

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
        await message.answer(
            "Не удалось отправить заявку в CRM. Попробуйте позже или свяжитесь с менеджером.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await state.clear()

    await message.answer(
        "Спасибо! Ваша заявка принята.\n\n"
        f"Номер заявки: #{created_lead.get('id')}.\n"
        "Менеджер Imperial Detailing скоро свяжется с вами для подтверждения записи.",
        reply_markup=ReplyKeyboardRemove(),
    )