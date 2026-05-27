from pydantic import BaseModel


class InstagramMessageSender(BaseModel):
    id: str


class InstagramMessageRecipient(BaseModel):
    id: str


class InstagramMessageContent(BaseModel):
    mid: str | None = None
    text: str | None = None


class InstagramMessagingEvent(BaseModel):
    sender: InstagramMessageSender
    recipient: InstagramMessageRecipient
    timestamp: int | None = None
    message: InstagramMessageContent | None = None


class InstagramEntry(BaseModel):
    id: str
    time: int | None = None
    messaging: list[InstagramMessagingEvent] = []


class InstagramWebhookPayload(BaseModel):
    object: str
    entry: list[InstagramEntry] = []