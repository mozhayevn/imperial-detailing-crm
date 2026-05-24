from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routes.clients import router as clients_router
from app.routes.cars import router as cars_router
from app.routes.services import router as services_router
from app.routes.car_types import router as car_types_router
from app.routes.pricing import router as pricing_router
from app.routes.material_brands import router as brands_router
from app.routes.service_packages import router as packages_router
from app.routes.service_price_rules import router as service_price_rules_router
from app.routes.orders import router as orders_router
from app.routes.roles import router as roles_router
from app.routes.permissions import router as permissions_router
from app.routes.users import router as users_router
from app.routes.work_bays import router as work_bays_router
from app.routes.auth import router as auth_router
from app.routes.units import router as units_router
from app.routes.materials import router as materials_router
from app.routes.order_item_materials import router as order_item_materials_router
from app.routes.car_type_pricing_rules import router as car_type_pricing_rules_router
from app.routes.payments import router as payments_router
from app.routes.order_checklist import router as order_checklist_router
from fastapi.staticfiles import StaticFiles
from app.routes.order_photos import router as orders_photos_router
from app.routes import material_stock, audit, dashboard, profile, finance
from pathlib import Path

Base.metadata.create_all(bind=engine)

app = FastAPI()

Path("uploads").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(

    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials = True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients_router)
app.include_router(cars_router)
app.include_router(services_router)
app.include_router(car_types_router)
app.include_router(pricing_router)
app.include_router(brands_router)
app.include_router(packages_router)
app.include_router(service_price_rules_router)
app.include_router(orders_router)
app.include_router(roles_router)
app.include_router(permissions_router)
app.include_router(users_router)
app.include_router(work_bays_router)
app.include_router(auth_router)
app.include_router(units_router)
app.include_router(materials_router)
app.include_router(order_item_materials_router)
app.include_router(car_type_pricing_rules_router)
app.include_router(payments_router)
app.include_router(order_checklist_router)
app.include_router(orders_photos_router)
app.include_router(material_stock.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(profile.router)
app.include_router(finance.router)


@app.get("/")
def root():
    return {"message": "CRM is running"}
