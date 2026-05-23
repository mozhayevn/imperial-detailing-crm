from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import (
    ServicePackage,
    Service,
    OrderItem,
    ServicePriceRule,
    User,
)
from app.schemas import (
    ServicePackageCreate,
    ServicePackageUpdate,
    ServicePackageResponse,
)

router = APIRouter(prefix="/service-packages", tags=["Service Packages"])


@router.post("/", response_model=ServicePackageResponse)
def create_service_package(
    data: ServicePackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service_packages.manage")),
):
    service = db.query(Service).filter(Service.id == data.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    existing = (
        db.query(ServicePackage)
        .filter(
            ServicePackage.service_id == data.service_id,
            ServicePackage.name == data.name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Service package already exists for this service")

    package = ServicePackage(
        service_id=data.service_id,
        name=data.name,
        description=data.description,
        is_active=data.is_active,
    )
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@router.get("/", response_model=list[ServicePackageResponse])
def get_service_packages(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service_packages.read")),
):
    return db.query(ServicePackage).order_by(ServicePackage.id.desc()).all()


@router.get("/{package_id}", response_model=ServicePackageResponse)
def get_service_package(
    package_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service_packages.read")),
):
    package = db.query(ServicePackage).filter(ServicePackage.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Service package not found")
    return package


@router.put("/{package_id}", response_model=ServicePackageResponse)
def update_service_package(
    package_id: int,
    data: ServicePackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service_packages.manage")),
):
    package = db.query(ServicePackage).filter(ServicePackage.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Service package not found")

    update_data = data.model_dump(exclude_unset=True)

    new_service_id = update_data.get("service_id", package.service_id)
    new_name = update_data.get("name", package.name)

    if "service_id" in update_data:
        service = db.query(Service).filter(Service.id == update_data["service_id"]).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

    existing = (
        db.query(ServicePackage)
        .filter(
            ServicePackage.service_id == new_service_id,
            ServicePackage.name == new_name,
            ServicePackage.id != package_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Another package with this name already exists for this service",
        )

    for key, value in update_data.items():
        setattr(package, key, value)

    db.commit()
    db.refresh(package)
    return package


@router.delete("/{package_id}")
def delete_service_package(
    package_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("service_packages.manage")),
):
    package = db.query(ServicePackage).filter(ServicePackage.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Service package not found")

    order_items_count = (
        db.query(OrderItem)
        .filter(OrderItem.service_package_id == package_id)
        .count()
    )

    pricing_rules_count = (
        db.query(ServicePriceRule)
        .filter(ServicePriceRule.service_package_id == package_id)
        .count()
    )

    if order_items_count > 0 or pricing_rules_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Service package cannot be deleted because it is already used "
                "in orders or pricing rules. Archive/deactivate should be used instead."
            ),
        )

    db.delete(package)
    db.commit()

    return {"message": "Service package deleted successfully"}
