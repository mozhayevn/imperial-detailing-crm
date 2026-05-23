from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import Order, OrderChecklistItem, OrderPhoto, User
from app.schemas import OrderPhotoResponse
from app.services.file_storage import storage


router = APIRouter(tags=["Order Photos"])

VALID_PHOTO_TYPES = {
    "before",
    "after",
    "damage",
    "progress",
    "quality_control",
    "other",
}


def ensure_order_exists(order_id: int, db: Session) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return order


def maybe_complete_photo_checklist_item(
    order_id: int,
    photo_type: str,
    db: Session,
    current_user: User,
) -> None:
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order or order.status in ["canceled", "delivered"]:
        return

    checklist_key_by_photo_type = {
        "before": "before_photos",
        "after": "after_photos",
        "quality_control": "quality_control",
    }

    checklist_key = checklist_key_by_photo_type.get(photo_type)

    if not checklist_key:
        return

    item = (
        db.query(OrderChecklistItem)
        .filter(
            OrderChecklistItem.order_id == order_id,
            OrderChecklistItem.key == checklist_key,
        )
        .first()
    )

    if not item or item.status == "done":
        return

    item.status = "done"
    item.completed_by_user_id = current_user.id

    from datetime import datetime

    item.completed_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()


@router.get(
    "/orders/{order_id}/photos",
    response_model=list[OrderPhotoResponse],
)
def get_order_photos(
    order_id: int,
    photo_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("order_photos.read")),
):
    ensure_order_exists(order_id, db)

    query = (
        db.query(OrderPhoto)
        .options(joinedload(OrderPhoto.uploaded_by_user))
        .filter(OrderPhoto.order_id == order_id)
    )

    if photo_type:
        query = query.filter(OrderPhoto.photo_type == photo_type)

    return query.order_by(OrderPhoto.created_at.desc()).all()


@router.post(
    "/orders/{order_id}/photos",
    response_model=OrderPhotoResponse,
)
def upload_order_photo(
    order_id: int,
    photo_type: str = Form(...),
    checklist_item_id: int | None = Form(default=None),
    comment: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("order_photos.upload")),
):
    try:
        order = ensure_order_exists(order_id, db)

        if photo_type not in VALID_PHOTO_TYPES:
            raise HTTPException(status_code=400, detail="Invalid photo type")

        if checklist_item_id is not None:
            checklist_item = (
                db.query(OrderChecklistItem)
                .filter(
                    OrderChecklistItem.id == checklist_item_id,
                    OrderChecklistItem.order_id == order.id,
                )
                .first()
            )

            if not checklist_item:
                raise HTTPException(status_code=404, detail="Checklist item not found")

        try:
            stored_file = storage.save_order_photo(
                order_id=order.id,
                photo_type=photo_type,
                file=file,
            )
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        photo = OrderPhoto(
            order_id=order.id,
            checklist_item_id=checklist_item_id,
            photo_type=photo_type,
            storage_provider=stored_file.storage_provider,
            storage_key=stored_file.storage_key,file_url=stored_file.file_url,
            original_filename=stored_file.original_filename,
            mime_type=stored_file.mime_type,
            file_size=stored_file.file_size,
            comment=comment,
            uploaded_by_user_id=current_user.id,
        )

        db.add(photo)

        maybe_complete_photo_checklist_item(
            order_id=order.id,
            photo_type=photo_type,
            db=db,
            current_user=current_user,
        )

        db.commit()
        db.refresh(photo)

        return photo

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.delete("/order-photos/{photo_id}")
def delete_order_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("order_photos.delete")),
):
    try:
        photo = db.query(OrderPhoto).filter(OrderPhoto.id == photo_id).first()

        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")

        order = ensure_order_exists(photo.order_id, db)

        if order.status in ["canceled", "delivered"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete photos for order with status {order.status}",
            )

        storage_key = photo.storage_key

        db.delete(photo)
        db.commit()

        if photo.storage_provider == "local":
            storage.delete_file(storage_key)

        return {"message": "Photo deleted"}

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise