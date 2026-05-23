from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base
from sqlalchemy import DateTime, Date, Text
from datetime import datetime, date


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    birth_date = Column(Date, nullable=True)
    preferences = Column(Text, nullable=True)

    cars = relationship("Car", back_populates="client", cascade="all, delete")
    orders = relationship("Order", back_populates="client")


class CarType(Base):
    __tablename__ = "car_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)


class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    car_type_id = Column(Integer, ForeignKey("car_types.id"), nullable=True)
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    color = Column(String, nullable=True)
    plate_number = Column(String, unique=True, nullable=True)

    client = relationship("Client", back_populates="cars")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    requires_brand = Column(Boolean, default=False)
    requires_package = Column(Boolean, default=False)
    base_labor_cost = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True, nullable=False)


class MaterialBrand(Base):
    __tablename__ = "material_brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class ServicePackage(Base):
    __tablename__ = "service_packages"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=True)

    service = relationship("Service")


class ServicePriceRule(Base):
    __tablename__ = "service_price_rules"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    car_type_id = Column(Integer, ForeignKey("car_types.id"), nullable=False)
    material_brand_id = Column(Integer, ForeignKey("material_brands.id"), nullable=True)
    service_package_id = Column(Integer, ForeignKey("service_packages.id"), nullable=True)
    price = Column(Integer, nullable=False)

    service = relationship("Service")
    car_type = relationship("CarType")
    material_brand = relationship("MaterialBrand")
    service_package = relationship("ServicePackage")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    parent_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)

    parent_role = relationship("Role", remote_side=[id])


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)

    role = relationship("Role")
    permission = relationship("Permission")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_super_admin = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    avatar_url = Column(String, nullable=True)

    privacy_show_phone = Column(Boolean, nullable=False, default=True)
    privacy_show_email = Column(Boolean, nullable=False, default=True)
    privacy_show_activity = Column(Boolean, nullable=False, default=True)
    privacy_show_online_status = Column(Boolean, nullable=False, default=True)
    privacy_show_order_load = Column(Boolean, nullable=False, default=True)
    privacy_show_audit_history = Column(Boolean, nullable=False, default=True)

    two_factor_enabled = Column(Boolean, nullable=False, default=False)
    two_factor_method = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False)
    phone_verified = Column(Boolean, nullable=False, default=False)

    #roles = relationship("Role", secondary="user_roles", back_populates="users")


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    user = relationship("User")
    role = relationship("Role")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, nullable=False, index=True)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User")


class TwoFactorChallenge(Base):
    __tablename__ = "two_factor_challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    method = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    code_hash = Column(String, nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    attempts_count = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    user = relationship("User")


class WorkBay(Base):
    __tablename__ = "work_bays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    work_bay_id = Column(Integer, ForeignKey("work_bays.id"), nullable=True)

    status = Column(String, default="new")
    comment = Column(String, nullable=True)
    cancellation_reason = Column(String, nullable=True)

    total_price = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    scheduled_at = Column(DateTime, nullable=True)
    planned_start_at = Column(DateTime, nullable=True)
    planned_end_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    rescheduled_from = Column(DateTime, nullable=True)
    pricing_locked = Column(Boolean, nullable=False, default=False)

    client = relationship("Client", back_populates="orders")
    car = relationship("Car")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    work_bay = relationship("WorkBay")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    material_brand_id = Column(Integer, ForeignKey("material_brands.id"), nullable=True)
    service_package_id = Column(Integer, ForeignKey("service_packages.id"), nullable=True)

    price = Column(Integer, nullable=False, default=0)
    quantity = Column(Integer, nullable=False, default=1)

    discount_amount = Column(Integer, nullable=False, default=0)  # legacy / computed
    discount_percent = Column(Integer, nullable=False, default=0)
    discount_reason = Column(String, nullable=True)
    discount_applied_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    total = Column(Integer, nullable=False, default=0)

    base_cost_snapshot = Column(Integer, nullable=False, default=0)
    gross_price_snapshot = Column(Integer, nullable=False, default=0)
    discount_amount_snapshot = Column(Integer, nullable=False, default=0)
    final_price_snapshot = Column(Integer, nullable=False, default=0)
    profit_snapshot = Column(Integer, nullable=False, default=0)

    discount_applied_by_user = relationship("User", foreign_keys=[discount_applied_by_user_id])
    order = relationship("Order", back_populates="items")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")


class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    brand_id = Column(Integer, ForeignKey("material_brands.id"), nullable=True)
    category = Column(String, nullable=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    cost_per_unit = Column(Integer, nullable=False, default=0)
    min_stock_quantity = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)

    brand = relationship("MaterialBrand")
    unit = relationship("Unit")


class OrderItemMaterial(Base):
    __tablename__ = "order_item_materials"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Integer, nullable=False)
    total_cost = Column(Integer, nullable=False)
    comment = Column(String, nullable=True)

    order_item = relationship("OrderItem")
    material = relationship("Material")


class MaterialStockMovement(Base):
    __tablename__ = "material_stock_movements"

    id = Column(Integer, primary_key=True, index=True)

    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    order_item_material_id = Column(
        Integer,
        ForeignKey("order_item_materials.id"),
        nullable=True,
    )

    movement_type = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)

    unit_cost = Column(Integer, nullable=False, default=0)
    total_cost = Column(Integer, nullable=False, default=0)

    comment = Column(Text, nullable=True)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    material = relationship("Material")
    order_item_material = relationship("OrderItemMaterial")
    created_by_user = relationship("User")

    @property
    def created_by_user_full_name(self) -> str | None:
        return self.created_by_user.full_name if self.created_by_user else None


class CarTypePricingRule(Base):
    __tablename__ = "car_type_pricing_rules"

    id = Column(Integer, primary_key=True, index=True)
    car_type_id = Column(Integer, ForeignKey("car_types.id"), nullable=False, unique=True)
    multiplier = Column(Integer, nullable=False, default=100)

    car_type = relationship("CarType")


class UserRoleAuditLog(Base):
    __tablename__ = "user_role_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    action = Column(String, nullable=False)  # user_created / role_assigned / role_removed
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    actor_user = relationship("User", foreign_keys=[actor_user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    role = relationship("Role")

    @property
    def actor_user_full_name(self) -> str | None:
        return self.actor_user.full_name if self.actor_user else None

    @property
    def target_user_full_name(self) -> str | None:
        return self.target_user.full_name if self.target_user else None

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None


class OrderAuditLog(Base):
    __tablename__ = "order_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)  # created / updated / status_changed / rescheduled / canceled
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")
    actor_user = relationship("User")

    @property
    def actor_user_full_name(self) -> str | None:
        return self.actor_user.full_name if self.actor_user else None


class PricingAuditLog(Base):
    __tablename__ = "pricing_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)  # pricing_applied
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")
    actor_user = relationship("User")

    @property
    def actor_user_full_name(self) -> str | None:
        return self.actor_user.full_name if self.actor_user else None


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    amount = Column(Integer, nullable=False)

    method = Column(String, nullable=False)  # cash / kaspi / card / bank_transfer / other
    status = Column(String, nullable=False, default="completed")  # completed / canceled / refunded

    comment = Column(String, nullable=True)

    paid_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    canceled_at = Column(DateTime, nullable=True)
    canceled_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancel_reason = Column(String, nullable=True)

    order = relationship("Order")
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    canceled_by_user = relationship("User", foreign_keys=[canceled_by_user_id])

    @property
    def created_by_user_full_name(self) -> str | None:
        return self.created_by_user.full_name if self.created_by_user else None

    @property
    def canceled_by_user_full_name(self) -> str | None:
        return self.canceled_by_user.full_name if self.canceled_by_user else None


class PaymentAuditLog(Base):
    __tablename__ = "payment_audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)

    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    action = Column(String, nullable=False)  # payment_created / payment_canceled
    details = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")
    payment = relationship("Payment")
    actor_user = relationship("User")

    @property
    def actor_user_full_name(self) -> str | None:
        return self.actor_user.full_name if self.actor_user else None


#Production checklist
class OrderChecklistItem(Base):
    __tablename__ = "order_checklist_items"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    key = Column(String, nullable=True)  # vehicle_accepted / before_photos / quality_control
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String, nullable=False, default="pending")  # pending / done
    is_required = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    comment = Column(Text, nullable=True)

    completed_at = Column(DateTime, nullable=True)
    completed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")
    completed_by_user = relationship("User", foreign_keys=[completed_by_user_id])

    @property
    def completed_by_user_full_name(self) -> str | None:
        return self.completed_by_user.full_name if self.completed_by_user else None


class OrderChecklistAuditLog(Base):
    __tablename__ = "order_checklist_audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    checklist_item_id = Column(Integer, ForeignKey("order_checklist_items.id"), nullable=True)

    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    action = Column(String, nullable=False)  # checklist_created / item_updated / item_completed / item_reopened
    details = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")
    checklist_item = relationship("OrderChecklistItem")
    actor_user = relationship("User")

    @property
    def actor_user_full_name(self) -> str | None:
        return self.actor_user.full_name if self.actor_user else None


class OrderPhoto(Base):
    __tablename__ = "order_photos"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    checklist_item_id = Column(Integer, ForeignKey("order_checklist_items.id"), nullable=True)

    photo_type = Column(String, nullable=False)  # before / after / damage / progress / quality_control / other

    storage_provider = Column(String, nullable=False, default="local")  # local / r2 / s3 / minio
    storage_key = Column(String, nullable=False)
    file_url = Column(String, nullable=False)

    original_filename = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=False, default=0)

    comment = Column(Text, nullable=True)

    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order")
    checklist_item = relationship("OrderChecklistItem")
    uploaded_by_user = relationship("User")

    @property
    def uploaded_by_user_full_name(self) -> str | None:
        return self.uploaded_by_user.full_name if self.uploaded_by_user else None