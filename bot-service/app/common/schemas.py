from pydantic import BaseModel


class LeadItemPayload(BaseModel):
    service_name_text: str
    quantity: int = 1
    comment: str | None = None


class LeadPayload(BaseModel):
    source: str

    client_name: str | None = None
    phone: str

    message: str | None = None

    car_brand: str | None = None
    car_model: str | None = None
    car_year: int | None = None
    car_color: str | None = None
    plate_number: str | None = None

    preferred_time: str | None = None
    comment: str | None = None

    external_user_id: str | None = None
    external_username: str | None = None

    items: list[LeadItemPayload]