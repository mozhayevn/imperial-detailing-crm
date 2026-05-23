from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import CarType, CarTypePricingRule, User
from app.schemas import (
    CarTypePricingRuleCreate,
    CarTypePricingRuleUpdate,
    CarTypePricingRuleResponse,
)

router = APIRouter(prefix="/car-type-pricing-rules", tags=["Car Type Pricing Rules"])


@router.post("/", response_model=CarTypePricingRuleResponse)
def create_car_type_pricing_rule(
    data: CarTypePricingRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    car_type = db.query(CarType).filter(CarType.id == data.car_type_id).first()
    if not car_type:
        raise HTTPException(status_code=404, detail="Car type not found")

    existing = (
        db.query(CarTypePricingRule)
        .filter(CarTypePricingRule.car_type_id == data.car_type_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Pricing rule for this car type already exists")

    rule = CarTypePricingRule(
        car_type_id=data.car_type_id,
        multiplier=data.multiplier,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/", response_model=list[CarTypePricingRuleResponse])
def get_car_type_pricing_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    return db.query(CarTypePricingRule).order_by(CarTypePricingRule.id.desc()).all()


@router.get("/{rule_id}", response_model=CarTypePricingRuleResponse)
def get_car_type_pricing_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.read")),
):
    rule = db.query(CarTypePricingRule).filter(CarTypePricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Car type pricing rule not found")
    return rule


@router.put("/{rule_id}", response_model=CarTypePricingRuleResponse)
def update_car_type_pricing_rule(
    rule_id: int,
    data: CarTypePricingRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pricing.manage")),
):
    rule = db.query(CarTypePricingRule).filter(CarTypePricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Car type pricing rule not found")

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)
    return rule
