import asyncio
import logging

from fastapi import FastAPI

from app.instagram.router import router as instagram_router
from app.telegram.bot import create_bot, create_dispatcher


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="Imperial Detailing Bot Service")
app.include_router(instagram_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


async def run_telegram_polling() -> None:
    bot = create_bot()
    dispatcher = create_dispatcher()

    await dispatcher.start_polling(bot)


async def main() -> None:
    await run_telegram_polling()


if __name__ == "__main__":
    asyncio.run(main())