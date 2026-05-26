from aiogram.types import ReplyKeyboardMarkup, KeyboardButton


def start_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Оставить заявку")],
            [KeyboardButton(text="Мои заявки"), KeyboardButton(text="О компании")],
            [KeyboardButton(text="Помощь")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )


def skip_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Пропустить")],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def phone_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Отправить номер телефона", request_contact=True)],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def service_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Полировка"), KeyboardButton(text="Химчистка")],
            [KeyboardButton(text="Обклейка"), KeyboardButton(text="PDR")],
            [KeyboardButton(text="Шумоизоляция")],
            [KeyboardButton(text="Другое")],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def confirm_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Подтвердить заявку")],
            [KeyboardButton(text="Заполнить заново")],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )