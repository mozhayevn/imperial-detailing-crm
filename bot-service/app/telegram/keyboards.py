from aiogram.types import ReplyKeyboardMarkup, KeyboardButton


def skip_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Пропустить")],
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