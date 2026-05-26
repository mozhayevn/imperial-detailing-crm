from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from app.config import settings
from app.telegram.handlers import router


def create_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher(storage=MemoryStorage())
    dispatcher.include_router(router)

    return dispatcher


def create_bot() -> Bot:
    return Bot(token=settings.TELEGRAM_BOT_TOKEN)