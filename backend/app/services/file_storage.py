import os
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile


UPLOAD_ROOT = Path("uploads")

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class StoredFile:
    def __init__(
        self,
        storage_provider: str,
        storage_key: str,
        file_url: str,
        original_filename: str | None,
        mime_type: str | None,
        file_size: int,
    ):
        self.storage_provider = storage_provider
        self.storage_key = storage_key
        self.file_url = file_url
        self.original_filename = original_filename
        self.mime_type = mime_type
        self.file_size = file_size


class LocalFileStorage:
    provider = "local"

    def save_order_photo(
        self,
        order_id: int,
        photo_type: str,
        file: UploadFile,
    ) -> StoredFile:
        if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise ValueError("Unsupported image type")

        extension = ALLOWED_IMAGE_MIME_TYPES[file.content_type]
        safe_filename = f"{uuid.uuid4().hex}{extension}"

        storage_key = f"orders/{order_id}/{photo_type}/{safe_filename}"
        target_path = UPLOAD_ROOT / storage_key

        target_path.parent.mkdir(parents=True, exist_ok=True)

        file.file.seek(0)

        with target_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(target_path)

        return StoredFile(
            storage_provider=self.provider,
            storage_key=storage_key,
            file_url=f"/uploads/{storage_key}",
            original_filename=file.filename,
            mime_type=file.content_type,
            file_size=file_size,
        )

    def delete_file(self, storage_key: str) -> None:
        target_path = UPLOAD_ROOT / storage_key

        if target_path.exists() and target_path.is_file():
            target_path.unlink()


storage = LocalFileStorage()