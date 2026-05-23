from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import MaterialBrand, User, Material, OrderItem, ServicePriceRule
from app.schemas import MaterialBrandCreate, MaterialBrandUpdate, MaterialBrandResponse

router = APIRouter(prefix="/material-brands", tags=["Material Brands"])


@router.post("/", response_model=MaterialBrandResponse)
def create_material_brand(
    brand: MaterialBrandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("material_brands.manage")),
):
    existing = db.query(MaterialBrand).filter(MaterialBrand.name == brand.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Material brand already exists")

    new_brand = MaterialBrand(
        name=brand.name,
        category=brand.category,
        is_active=brand.is_active,
    )
    db.add(new_brand)
    db.commit()
    db.refresh(new_brand)
    return new_brand


@router.get("/", response_model=list[MaterialBrandResponse])
def get_material_brands(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("material_brands.read")),
):
    return db.query(MaterialBrand).order_by(MaterialBrand.id.desc()).all()


@router.get("/{brand_id}", response_model=MaterialBrandResponse)
def get_material_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("material_brands.read")),
):
    brand = db.query(MaterialBrand).filter(MaterialBrand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Material brand not found")
    return brand


@router.put("/{brand_id}", response_model=MaterialBrandResponse)
def update_material_brand(
    brand_id: int,
    brand_data: MaterialBrandUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("material_brands.manage")),
):
    brand = db.query(MaterialBrand).filter(MaterialBrand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Material brand not found")

    update_data = brand_data.model_dump(exclude_unset=True)

    if "name" in update_data:
        existing = (
            db.query(MaterialBrand)
            .filter(MaterialBrand.name == update_data["name"], MaterialBrand.id != brand_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Another brand with this name already exists")

    for key, value in update_data.items():
        setattr(brand, key, value)

    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/{brand_id}")
def delete_material_brand(
    brand_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("material_brands.manage")),
):
    brand = db.query(MaterialBrand).filter(MaterialBrand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Material brand not found")

    materials_count = (
        db.query(Material)
        .filter(Material.brand_id == brand_id)
        .count()
    )

    order_items_count = (
        db.query(OrderItem)
        .filter(OrderItem.material_brand_id == brand_id)
        .count()
    )

    pricing_rules_count = (
        db.query(ServicePriceRule)
        .filter(ServicePriceRule.material_brand_id == brand_id)
        .count()
    )

    if materials_count > 0 or order_items_count > 0 or pricing_rules_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Material brand cannot be deleted because it is already used "
                "in materials, orders, or pricing rules. "
                "Deactivate/archive should be used instead."
            ),
        )

    db.delete(brand)
    db.commit()

    return {"message": "Material brand deleted successfully"}