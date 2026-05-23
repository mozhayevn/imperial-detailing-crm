from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_permission
from app.models import Material, MaterialBrand, Unit, User, OrderItemMaterial
from app.schemas import MaterialCreate, MaterialUpdate, MaterialResponse

router = APIRouter(prefix="/materials", tags=["Materials"])


@router.post("/", response_model=MaterialResponse)
def create_material(
    data: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.manage")),
):
    unit = db.query(Unit).filter(Unit.id == data.unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    if data.brand_id is not None:
        brand = db.query(MaterialBrand).filter(MaterialBrand.id == data.brand_id).first()
        if not brand:
            raise HTTPException(status_code=404, detail="Material brand not found")

    material = Material(
        name=data.name,
        brand_id=data.brand_id,
        category=data.category,
        unit_id=data.unit_id,
        cost_per_unit=data.cost_per_unit,
        min_stock_quantity=data.min_stock_quantity,
        is_active=data.is_active,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/", response_model=list[MaterialResponse])
def get_materials(
    category: str | None = Query(None),
    brand_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.read")),
):
    query = db.query(Material)

    if category:
        query = query.filter(Material.category == category)

    if brand_id:
        query = query.filter(Material.brand_id == brand_id)

    if is_active is not None:
        query = query.filter(Material.is_active == is_active)

    return query.order_by(Material.id.desc()).all()


@router.get("/{material_id}", response_model=MaterialResponse)
def get_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.read")),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.put("/{material_id}", response_model=MaterialResponse)
def update_material(
    material_id: int,
    data: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.manage")),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    update_data = data.model_dump(exclude_unset=True)

    if "unit_id" in update_data:
        unit = db.query(Unit).filter(Unit.id == update_data["unit_id"]).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")

    if "brand_id" in update_data and update_data["brand_id"] is not None:
        brand = db.query(MaterialBrand).filter(MaterialBrand.id == update_data["brand_id"]).first()
        if not brand:
            raise HTTPException(status_code=404, detail="Material brand not found")

    for key, value in update_data.items():
        setattr(material, key, value)

    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}")
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("materials.manage")),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    usage_count = (
        db.query(OrderItemMaterial)
        .filter(OrderItemMaterial.material_id == material_id)
        .count()
    )

    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Material cannot be deleted because it is already used "
                "in order material consumption. Deactivate/archive should be used instead."
            ),
        )

    db.delete(material)
    db.commit()

    return {"message": "Material deleted successfully"}