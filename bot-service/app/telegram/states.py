from aiogram.fsm.state import State, StatesGroup


class LeadForm(StatesGroup):
    client_name = State()
    phone = State()

    car_brand = State()
    car_model = State()
    car_year = State()
    car_color = State()
    plate_number = State()

    service_name = State()
    custom_service_name = State()
    preferred_time = State()
    comment = State()

    confirm = State()