from pydantic import BaseModel, ConfigDict
from datetime import datetime, date


class ClientCreate(BaseModel):
    full_name: str
    phone: str
    birth_date: date | None = None
    preferences: str | None = None


class ClientUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    preferences: str | None = None


class ClientResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    birth_date: date | None = None
    preferences: str | None = None

    class Config:
        from_attributes = True


class ClientHistoryItemResponse(BaseModel):
    order_id: int
    status: str
    created_at: datetime
    scheduled_at: datetime | None = None
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    total_price: int
    comment: str | None = None
    items_count: int

    class Config:
        from_attributes = True


class CarTypeCreate(BaseModel):
    name: str


class CarTypeUpdate(BaseModel):
    name: str | None = None


class CarTypeResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CarCreate(BaseModel):
    client_id: int
    car_type_id: int | None = None
    brand: str
    model: str
    year: int | None = None
    color: str | None = None
    plate_number: str | None = None


class CarUpdate(BaseModel):
    client_id: int | None = None
    car_type_id: int | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    color: str | None = None
    plate_number: str | None = None


class CarResponse(BaseModel):
    id: int
    client_id: int
    car_type_id: int | None = None
    brand: str
    model: str
    year: int | None = None
    color: str | None = None
    plate_number: str | None = None

    class Config:
        from_attributes = True


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    requires_brand: bool = False
    requires_package: bool = False
    base_labor_cost: int = 0
    is_active: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    requires_brand: bool | None = None
    requires_package: bool | None = None
    base_labor_cost: int | None = None
    is_active: bool | None = None


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    requires_brand: bool
    requires_package: bool
    base_labor_cost: int
    is_active: bool

    class Config:
        from_attributes = True


class ServicePriceCreate(BaseModel):
    service_id: int
    car_type_id: int
    price: int


class ServicePriceUpdate(BaseModel):
    service_id: int | None = None
    car_type_id: int | None = None
    price: int | None = None


class ServicePriceResponse(BaseModel):
    id: int
    service_id: int
    car_type_id: int
    price: int

    class Config:
        from_attributes = True


class PriceByCarAndServiceResponse(BaseModel):
    car_id: int
    service_id: int
    car_type_id: int
    price: int

    class Config:
        from_attributes = True


# class ServiceCreate(BaseModel):
#     name: str
#     description: str | None = None
#     requires_brand: bool = False
#     requires_package: bool = False
#
#
# class ServiceResponse(BaseModel):
#     id: int
#     name: str
#     description: str | None = None
#     requires_brand: bool
#     requires_package: bool
#
#     class Config:
#         from_attributes = True


# Бренды
class MaterialBrandCreate(BaseModel):
    name: str
    category: str | None = None
    is_active: bool = True


class MaterialBrandUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    is_active: bool | None = None


class MaterialBrandResponse(BaseModel):
    id: int
    name: str
    category: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


# Пакеты
class ServicePackageCreate(BaseModel):
    service_id: int
    name: str
    description: str | None = None
    is_active: bool = True


class ServicePackageUpdate(BaseModel):
    service_id: int | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class ServicePackageResponse(BaseModel):
    id: int
    service_id: int
    name: str
    description: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class ServicePriceRuleCreate(BaseModel):
    service_id: int
    car_type_id: int
    material_brand_id: int | None = None
    service_package_id: int | None = None
    price: int


class ServicePriceRuleUpdate(BaseModel):
    service_id: int | None = None
    car_type_id: int | None = None
    material_brand_id: int | None = None
    service_package_id: int | None = None
    price: int | None = None


class ServicePriceRuleResponse(BaseModel):
    id: int
    service_id: int
    car_type_id: int
    material_brand_id: int | None = None
    service_package_id: int | None = None
    price: int

    class Config:
        from_attributes = True


class PriceCalculationResponse(BaseModel):
    car_id: int
    service_id: int
    car_type_id: int
    material_brand_id: int | None = None
    service_package_id: int | None = None
    price: int

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    service_id: int
    material_brand_id: int | None = None
    service_package_id: int | None = None
    quantity: int = 1
    discount_percent: int = 0
    discount_reason: str | None = None


class OrderCreate(BaseModel):
    client_id: int
    car_id: int
    assigned_user_id: int | None = None
    work_bay_id: int | None = None
    scheduled_at: datetime | None = None
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    comment: str | None = None
    items: list[OrderItemCreate]


class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    service_id: int
    material_brand_id: int | None = None
    service_package_id: int | None = None
    price: int
    quantity: int
    discount_amount: int
    discount_percent: int
    discount_reason: str | None = None
    discount_applied_by_user_id: int | None = None
    total: int
    base_cost_snapshot: int
    gross_price_snapshot: int
    discount_amount_snapshot: int
    final_price_snapshot: int
    profit_snapshot: int

    class Config:
        from_attributes = True


class MaterialStockMovementCreate(BaseModel):
    movement_type: str
    quantity: int
    unit_cost: int | None = None
    comment: str | None = None


class MaterialStockMovementResponse(BaseModel):
    id: int
    material_id: int
    order_item_material_id: int | None = None
    movement_type: str
    quantity: int
    unit_cost: int
    total_cost: int
    comment: str | None = None
    created_by_user_id: int
    created_by_user_full_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class MaterialStockSummaryResponse(BaseModel):
    material_id: int
    material_name: str | None = None
    unit_id: int
    unit_name: str | None = None
    unit_code: str | None = None
    current_quantity: int
    min_stock_quantity: int
    stock_status: str
    stock_value: int
    last_unit_cost: int | None = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    client_id: int
    car_id: int
    status: str
    assigned_user_id: int | None = None
    work_bay_id: int | None = None
    comment: str | None = None
    cancellation_reason: str | None = None
    total_price: int

    created_at: datetime
    scheduled_at: datetime | None = None
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    completed_at: datetime | None = None
    delivered_at: datetime | None = None
    rescheduled_from: datetime | None = None
    pricing_locked: bool

    items: list[OrderItemResponse]

    class Config:
        from_attributes = True


#new
class OrderListItemResponse(BaseModel):
    id: int
    status: str
    total_price: int
    pricing_locked: bool

    created_at: datetime
    scheduled_at: datetime | None = None
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None

    client_id: int
    client_full_name: str | None = None
    client_phone: str | None = None

    car_id: int
    car_brand: str | None = None
    car_model: str | None = None
    car_plate_number: str | None = None

    work_bay_id: int | None = None
    work_bay_name: str | None = None

    assigned_user_id: int | None = None
    assigned_user_full_name: str | None = None

    class Config:
        from_attributes = True

#new ends


class OrderItemUpdate(BaseModel):
    id: int | None = None
    service_id: int
    material_brand_id: int | None = None
    service_package_id: int | None = None
    quantity: int = 1
    discount_percent: int = 0
    discount_reason: str | None = None


class OrderStatusUpdate(BaseModel):
    status: str


class OrderUpdate(BaseModel):
    client_id: int | None = None
    car_id: int | None = None
    assigned_user_id: int | None = None
    work_bay_id: int | None = None
    scheduled_at: datetime | None = None
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    comment: str | None = None
    items: list[OrderItemUpdate]


class OrderStatusHistoryResponse(BaseModel):
    id: int
    order_id: int
    old_status: str | None = None
    new_status: str
    changed_at: datetime

    class Config:
        from_attributes = True


class OrderReschedule(BaseModel):
    scheduled_at: datetime | None = None
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None
    comment: str | None = None


class OrderCancel(BaseModel):
    reason: str


class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    parent_role_id: int | None = None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    parent_role_id: int | None = None

    class Config:
        from_attributes = True


class PermissionCreate(BaseModel):
    code: str
    description: str | None = None


class PermissionResponse(BaseModel):
    id: int
    code: str
    description: str | None = None

    class Config:
        from_attributes = True


class RolePermissionAssign(BaseModel):
    role_id: int
    permission_id: int


class UserCreate(BaseModel):
    full_name: str
    email: str
    phone: str | None = None
    password: str
    is_super_admin: bool = False
    is_active: bool = True
    must_change_password: bool = False
    role_ids: list[int] = []


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None = None
    avatar_url: str | None = None
    is_active: bool
    is_super_admin: bool
    must_change_password: bool
    created_at: datetime
    two_factor_enabled: bool
    two_factor_method: str | None = None
    email_verified: bool
    phone_verified: bool

    class Config:
        from_attributes = True


class UserPublicProfileResponse(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None = None

    is_active: bool
    is_super_admin: bool
    roles: list[str]

    email: str | None = None
    phone: str | None = None

    can_view_full_profile: bool

    privacy_show_phone: bool
    privacy_show_email: bool
    privacy_show_activity: bool
    privacy_show_online_status: bool
    privacy_show_order_load: bool
    privacy_show_audit_history: bool

    created_at: datetime

    class Config:
        from_attributes = True


class UserRoleAssign(BaseModel):
    user_id: int
    role_id: int


class WorkBayCreate(BaseModel):
    name: str
    description: str | None = None


class WorkBayUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkBayResponse(BaseModel):
    id: int
    name: str
    description: str | None = None

    class Config:
        from_attributes = True


class WorkBayAvailabilityResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_available: bool
    conflicting_order_id: int | None = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginRequest(BaseModel):
    email: str
    password: str


class MyPermissionsResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    is_super_admin: bool
    roles: list[str]
    permissions: list[str]


class RolePermissionsResponse(BaseModel):
    role_id: int
    role_name: str
    parent_role_id: int | None = None
    parent_role_name: str | None = None
    direct_permissions: list[str]
    inherited_permissions: list[str]
    all_permissions: list[str]


class UserRolesResponse(BaseModel):
    user_id: int
    full_name: str
    roles: list[str]


class UnitCreate(BaseModel):
    name: str
    code: str


class UnitResponse(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True


class MaterialCreate(BaseModel):
    name: str
    brand_id: int | None = None
    category: str | None = None
    unit_id: int
    cost_per_unit: int
    min_stock_quantity: int = 0
    is_active: bool = True


class MaterialUpdate(BaseModel):
    name: str | None = None
    brand_id: int | None = None
    category: str | None = None
    unit_id: int | None = None
    cost_per_unit: int | None = None
    min_stock_quantity: int | None = None
    is_active: bool | None = None


class MaterialResponse(BaseModel):
    id: int
    name: str
    brand_id: int | None = None
    category: str | None = None
    unit_id: int
    cost_per_unit: int
    min_stock_quantity: int
    is_active: bool

    class Config:
        from_attributes = True


class OrderItemMaterialCreate(BaseModel):
    material_id: int
    quantity: int
    comment: str | None = None


class OrderItemMaterialResponse(BaseModel):
    id: int
    order_item_id: int
    material_id: int
    quantity: int
    unit_cost: int
    total_cost: int
    comment: str | None = None

    class Config:
        from_attributes = True


class CarTypePricingRuleCreate(BaseModel):
    car_type_id: int
    multiplier: int


class CarTypePricingRuleUpdate(BaseModel):
    multiplier: int | None = None


class CarTypePricingRuleResponse(BaseModel):
    id: int
    car_type_id: int
    multiplier: int

    class Config:
        from_attributes = True


class OrderItemPricingResponse(BaseModel):
    order_item_id: int
    order_id: int
    service_id: int
    car_type_id: int
    materials_cost: int
    labor_cost: int
    car_type_multiplier: int
    pricing_source: str
    service_price_rule_id: int | None = None
    base_cost: int
    gross_price: int
    discount_percent: int
    discount_amount: int
    final_price: int
    profit: int
    has_warning: bool
    warning_level: str
    warning_message: str | None = None


class OrderPricingItemSummaryResponse(BaseModel):
    order_item_id: int
    service_id: int
    quantity: int
    materials_cost: int
    labor_cost: int
    base_cost: int
    car_type_multiplier: int
    pricing_source: str
    service_price_rule_id: int | None = None
    gross_price: int
    discount_percent: int
    discount_amount: int
    final_price: int
    profit: int
    has_warning: bool
    warning_level: str
    warning_message: str | None = None


class OrderPricingResponse(BaseModel):
    order_id: int
    items_count: int
    total_materials_cost: int
    total_labor_cost: int
    total_gross_price: int
    total_discount_amount: int
    total_final_price: int
    total_profit: int
    has_warning: bool
    warning_level: str
    warning_message: str | None = None
    items: list[OrderPricingItemSummaryResponse] = []


class UserRoleAuditLogResponse(BaseModel):
    id: int
    actor_user_id: int
    actor_user_full_name: str | None = None
    target_user_id: int
    target_user_full_name: str | None = None
    role_id: int | None = None
    role_name: str | None = None
    action: str
    details: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderAuditLogResponse(BaseModel):
    id: int
    order_id: int
    actor_user_id: int
    actor_user_full_name: str | None = None
    action: str
    details: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PricingAuditLogResponse(BaseModel):
    id: int
    order_id: int
    actor_user_id: int
    actor_user_full_name: str | None = None
    action: str
    details: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PricingUnlockRequest(BaseModel):
    reason: str


class PaymentCreate(BaseModel):
    amount: int
    method: str
    paid_at: datetime | None = None
    comment: str | None = None


class PaymentCancel(BaseModel):
    reason: str


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: int
    method: str
    status: str
    comment: str | None = None

    paid_at: datetime
    created_at: datetime

    created_by_user_id: int
    created_by_user_full_name: str | None = None

    canceled_at: datetime | None = None
    canceled_by_user_id: int | None = None
    canceled_by_user_full_name: str | None = None
    cancel_reason: str | None = None

    class Config:
        from_attributes = True


class PaymentSummaryResponse(BaseModel):
    order_id: int
    total_price: int
    paid_amount: int
    remaining_amount: int
    payment_status: str


class PaymentAuditLogResponse(BaseModel):
    id: int
    order_id: int
    payment_id: int | None = None
    actor_user_id: int
    actor_user_full_name: str | None = None
    action: str
    details: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


#production checklist
class OrderChecklistItemCreate(BaseModel):
    title: str
    description: str | None = None
    key: str | None = None
    is_required: bool = True
    sort_order: int = 0
    comment: str | None = None


class OrderChecklistItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_required: bool | None = None
    sort_order: int | None = None
    comment: str | None = None


class OrderChecklistItemComplete(BaseModel):
    comment: str | None = None


class OrderChecklistItemResponse(BaseModel):
    id: int
    order_id: int

    key: str | None = None
    title: str
    description: str | None = None

    status: str
    is_required: bool
    sort_order: int

    comment: str | None = None

    completed_at: datetime | None = None
    completed_by_user_id: int | None = None
    completed_by_user_full_name: str | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderChecklistAuditLogResponse(BaseModel):
    id: int
    order_id: int
    checklist_item_id: int | None = None
    actor_user_id: int
    actor_user_full_name: str | None = None
    action: str
    details: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderPhotoResponse(BaseModel):
    id: int
    order_id: int
    checklist_item_id: int | None = None

    photo_type: str

    storage_provider: str
    storage_key: str
    file_url: str

    original_filename: str | None = None
    mime_type: str | None = None
    file_size: int

    comment: str | None = None

    uploaded_by_user_id: int
    uploaded_by_user_full_name: str | None = None

    created_at: datetime

    class Config:
        from_attributes = True


class RecentAuditEventResponse(BaseModel):
    id: str
    source: str
    source_label: str
    action: str
    action_label: str

    actor_user_id: int
    actor_user_full_name: str | None = None

    order_id: int | None = None
    payment_id: int | None = None
    checklist_item_id: int | None = None
    target_user_id: int | None = None
    target_user_full_name: str | None = None
    role_id: int | None = None
    role_name: str | None = None

    details: str | None = None
    created_at: datetime


class DashboardMetricResponse(BaseModel):
    label: str
    value: int


class DashboardOrdersSummaryResponse(BaseModel):
    total: int
    new_count: int
    in_progress_count: int
    completed_count: int
    canceled_count: int
    delivered_count: int
    active_count: int


class DashboardFinanceSummaryResponse(BaseModel):
    total_price: int
    paid_amount: int
    remaining_amount: int
    total_profit: int


class DashboardProductionSummaryResponse(BaseModel):
    active_orders: int
    orders_without_work_bay: int
    orders_without_master: int
    orders_without_locked_pricing: int
    orders_with_unfinished_checklist: int


class DashboardInventorySummaryResponse(BaseModel):
    total_stock_value: int
    in_stock_count: int
    low_stock_count: int
    out_of_stock_count: int


class DashboardChartsResponse(BaseModel):
    orders_by_status: list[DashboardMetricResponse]
    finance_breakdown: list[DashboardMetricResponse]
    inventory_status: list[DashboardMetricResponse]
    production_health: list[DashboardMetricResponse]
    orders_by_day: list[DashboardMetricResponse]


class DashboardSummaryResponse(BaseModel):
    orders: DashboardOrdersSummaryResponse
    finance: DashboardFinanceSummaryResponse
    production: DashboardProductionSummaryResponse
    inventory: DashboardInventorySummaryResponse
    charts: DashboardChartsResponse


class ProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None = None
    avatar_url: str | None = None
    is_active: bool
    is_super_admin: bool
    must_change_password: bool
    created_at: datetime

    privacy_show_phone: bool
    privacy_show_email: bool
    privacy_show_activity: bool
    privacy_show_online_status: bool
    privacy_show_order_load: bool
    privacy_show_audit_history: bool

    two_factor_enabled: bool
    two_factor_method: str | None = None
    email_verified: bool
    phone_verified: bool

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None


class ProfilePrivacyUpdateRequest(BaseModel):
    privacy_show_phone: bool
    privacy_show_email: bool
    privacy_show_activity: bool
    privacy_show_online_status: bool
    privacy_show_order_load: bool
    privacy_show_audit_history: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserSessionResponse(BaseModel):
    id: int
    user_agent: str | None = None
    ip_address: str | None = None
    is_active: bool
    created_at: datetime
    last_seen_at: datetime | None = None
    revoked_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str | None = None

    requires_2fa: bool = False
    challenge_id: int | None = None
    method: str | None = None
    destination_masked: str | None = None


class VerifyTwoFactorRequest(BaseModel):
    challenge_id: int
    code: str


class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    method: str | None = None
    destination_masked: str | None = None
    email_verified: bool
    phone_verified: bool


class TwoFactorSendCodeRequest(BaseModel):
    method: str = "email"


class TwoFactorEnableRequest(BaseModel):
    challenge_id: int
    code: str


class TwoFactorDisableRequest(BaseModel):
    current_password: str


class ResendTwoFactorRequest(BaseModel):
    challenge_id: int


class ResendTwoFactorResponse(BaseModel):
    challenge_id: int
    method: str
    destination_masked: str


class FinanceOverviewResponse(BaseModel):
    period: str

    orders_revenue: int
    cash_received: int
    accounts_receivable: int
    gross_profit: int
    business_expenses: int
    net_profit: int

    average_order_value: int
    payment_rate_percent: int
    gross_margin_percent: int
    net_margin_percent: int
    orders_with_debt_count: int

    locked_orders_count: int
    paid_orders_count: int
    partial_orders_count: int
    unpaid_orders_count: int

    class Config:
        from_attributes = True


class ExpenseCategoryCreate(BaseModel):
    name: str
    code: str
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0


class ExpenseCategoryUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ExpenseCategoryResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None = None
    is_active: bool
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessExpenseCreate(BaseModel):
    category_id: int
    amount: int
    expense_date: datetime | None = None
    title: str
    description: str | None = None
    payment_method: str | None = None


class BusinessExpenseUpdate(BaseModel):
    category_id: int | None = None
    amount: int | None = None
    expense_date: datetime | None = None
    title: str | None = None
    description: str | None = None
    payment_method: str | None = None


class BusinessExpenseResponse(BaseModel):
    id: int

    category_id: int
    category_name: str | None = None

    amount: int
    expense_date: datetime

    title: str
    description: str | None = None
    payment_method: str | None = None

    created_by_user_id: int
    created_by_user_full_name: str | None = None

    updated_by_user_id: int | None = None
    updated_by_user_full_name: str | None = None

    created_at: datetime
    updated_at: datetime | None = None
    is_deleted: bool
    deleted_at: datetime | None = None
    deleted_by_user_id: int | None = None
    deleted_by_user_full_name: str | None = None

    class Config:
        from_attributes = True


class BusinessExpenseAuditLogResponse(BaseModel):
    id: int
    expense_id: int | None = None
    actor_user_id: int
    actor_user_full_name: str | None = None
    action: str
    details: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class FinanceOrderMarginResponse(BaseModel):
    order_id: int
    status: str
    created_at: datetime
    scheduled_at: datetime | None = None

    client_id: int
    client_full_name: str | None = None

    car_id: int
    car_label: str | None = None

    total_price: int
    paid_amount: int
    remaining_amount: int
    payment_status: str

    base_cost: int
    gross_profit: int
    margin_percent: int

    items_count: int
    pricing_locked: bool

    class Config:
        from_attributes = True


class FinanceDailyChartItemResponse(BaseModel):
    label: str
    date: str
    orders_revenue: int
    cash_received: int
    business_expenses: int
    gross_profit: int
    net_profit: int


class FinanceChartMetricResponse(BaseModel):
    label: str
    value: int


class FinanceChartsResponse(BaseModel):
    period: str
    daily: list[FinanceDailyChartItemResponse]
    expenses_by_category: list[FinanceChartMetricResponse]


class SecurityAuditLogResponse(BaseModel):
    id: int

    actor_user_id: int | None = None
    actor_user_full_name: str | None = None

    target_user_id: int | None = None
    target_user_full_name: str | None = None

    action: str
    details: str | None = None

    ip_address: str | None = None
    user_agent: str | None = None

    created_at: datetime

    class Config:
        from_attributes = True