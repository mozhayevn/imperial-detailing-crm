from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import (
    ServicePriceRule,
    Service,
    CarType,
    MaterialBrand,
    ServicePackage,
    User,
)
from app.schemas import (
    ServicePriceRuleCreate,
    ServicePriceRuleUpdate,
    ServicePriceRuleResponse,
)

router = APIRouter(prefix="/service-price-rules", tags=["Service Price Rules"])


def get_active_flag(entity) -> bool:
    return getattr(entity, "is_active", True) is not False


def validate_price_rule_entities(
    db: Session,
    service_id: int,
    car_type_id: int,
    material_brand_id: int | None,
    service_package_id: int | None,
    allow_archived_existing_rule: bool = False,
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if not allow_archived_existing_rule and not get_active_flag(service):
        raise HTTPException(
            status_code=400,
            detail="Archived service cannot be used in new pricing rules",
        )

    car_type = db.query(CarType).filter(CarType.id == car_type_id).first()
    if not car_type:
        raise HTTPException(status_code=404, detail="Car type not found")

    brand = None
    if material_brand_id is not None:
        brand = (
            db.query(MaterialBrand)
            .filter(MaterialBrand.id == material_brand_id)
            .first()
        )
        if not brand:
            raise HTTPException(status_code=404, detail="Material brand not found")

        if not allow_archived_existing_rule and not get_active_flag(brand):
            raise HTTPException(
                status_code=400,
                detail="Archived material brand cannot be used in new pricing rules",
            )

    package = None
    if service_package_id is not None:
        package = (
            db.query(ServicePackage)
            .filter(ServicePackage.id == service_package_id)
            .first()
        )
        if not package:
            raise HTTPException(status_code=404, detail="Service package not found")

        if package.service_id != service_id:
            raise HTTPException(
                status_code=400,
                detail="Service package does not belong to selected service",
            )

        if not allow_archived_existing_rule and not get_active_flag(package):
            raise HTTPException(
                status_code=400,
                detail="Archived service package cannot be used in new pricing rules",
            )

    if brand is not None and not service.requires_brand:
        raise HTTPException(
            status_code=400,
            detail="Selected service does not require material brand",
        )

    if package is not None and not service.requires_package:
        raise HTTPException(
            status_code=400,
            detail="Selected service does not require service package",
        )

    return service, car_type, brand, package


def ensure_no_duplicate_price_rule(
    db: Session,
    service_id: int,
    car_type_id: int,
    material_brand_id: int | None,
    service_package_id: int | None,
    exclude_rule_id: int | None = None,
):
    query = db.query(ServicePriceRule).filter(
        ServicePriceRule.service_id == service_id,
        ServicePriceRule.car_type_id == car_type_id,
        ServicePriceRule.material_brand_id == material_brand_id,
        ServicePriceRule.service_package_id == service_package_id,
    )

    if exclude_rule_id is not None:
        query = query.filter(ServicePriceRule.id != exclude_rule_id)

    existing_rule = query.first()
    if existing_rule:
        raise HTTPException(
            status_code=400,
            detail="Identical service price rule already exists",
        )


@router.post("/", response_model=ServicePriceRuleResponse)
def create_service_price_rule(
    rule: ServicePriceRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    if rule.price < 0:
        raise HTTPException(status_code=400, detail="Price must be non-negative")

    validate_price_rule_entities(
        db=db,
        service_id=rule.service_id,
        car_type_id=rule.car_type_id,
        material_brand_id=rule.material_brand_id,
        service_package_id=rule.service_package_id,
    )

    ensure_no_duplicate_price_rule(
        db=db,
        service_id=rule.service_id,
        car_type_id=rule.car_type_id,
        material_brand_id=rule.material_brand_id,
        service_package_id=rule.service_package_id,
    )

    new_rule = ServicePriceRule(
        service_id=rule.service_id,
        car_type_id=rule.car_type_id,
        material_brand_id=rule.material_brand_id,
        service_package_id=rule.service_package_id,
        price=rule.price,
    )

    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    return new_rule


@router.get("/", response_model=list[ServicePriceRuleResponse])
def get_service_price_rules(
    service_id: int | None = Query(None),
    car_type_id: int | None = Query(None),
    material_brand_id: int | None = Query(None),
    service_package_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    query = db.query(ServicePriceRule)

    if service_id is not None:
        query = query.filter(ServicePriceRule.service_id == service_id)

    if car_type_id is not None:
        query = query.filter(ServicePriceRule.car_type_id == car_type_id)

    if material_brand_id is not None:
        query = query.filter(ServicePriceRule.material_brand_id == material_brand_id)

    if service_package_id is not None:
        query = query.filter(ServicePriceRule.service_package_id == service_package_id)

    return query.order_by(ServicePriceRule.id.desc()).all()


@router.get("/{rule_id}", response_model=ServicePriceRuleResponse)
def get_service_price_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    rule = db.query(ServicePriceRule).filter(ServicePriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Service price rule not found")

    return rule


@router.put("/{rule_id}", response_model=ServicePriceRuleResponse)
def update_service_price_rule(
    rule_id: int,
    rule_data: ServicePriceRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    rule = db.query(ServicePriceRule).filter(ServicePriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Service price rule not found")

    update_data = rule_data.model_dump(exclude_unset=True)

    new_service_id = update_data.get("service_id", rule.service_id)
    new_car_type_id = update_data.get("car_type_id", rule.car_type_id)
    new_material_brand_id = update_data.get(
        "material_brand_id",
        rule.material_brand_id,
    )
    new_service_package_id = update_data.get(
        "service_package_id",
        rule.service_package_id,
    )
    new_price = update_data.get("price", rule.price)

    if new_price < 0:
        raise HTTPException(status_code=400, detail="Price must be non-negative")

    validate_price_rule_entities(
        db=db,
        service_id=new_service_id,
        car_type_id=new_car_type_id,
        material_brand_id=new_material_brand_id,
        service_package_id=new_service_package_id,
    )

    ensure_no_duplicate_price_rule(
        db=db,
        service_id=new_service_id,
        car_type_id=new_car_type_id,
        material_brand_id=new_material_brand_id,
        service_package_id=new_service_package_id,
        exclude_rule_id=rule_id,
    )

    for key, value in update_data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)

    return rule


@router.delete("/{rule_id}")
def delete_service_price_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    rule = db.query(ServicePriceRule).filter(ServicePriceRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Service price rule not found")

    db.delete(rule)
    db.commit()

    return {"message": "Service price rule deleted successfully"}