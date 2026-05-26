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


class MyLeadItem(BaseModel):
    id: int
    service_name: str | None = None
    quantity: int


class MyLead(BaseModel):
    id: int
    status: str
    source: str

    client_name: str | None = None
    phone: str

    car_brand: str | None = None
    car_model: str | None = None
    car_year: int | None = None

    preferred_time: str | None = None

    created_order_id: int | None = None
    created_at: str

    items: list[MyLeadItem] = []


class MyLeadsResponse(BaseModel):
    lead_contact_id: int | None = None
    leads: list[MyLead] = []