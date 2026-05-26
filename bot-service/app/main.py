import asyncio
import logging

from app.telegram.bot import create_bot, create_dispatcher


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


async def main() -> None:
    bot = create_bot()
    dispatcher = create_dispatcher()

    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())