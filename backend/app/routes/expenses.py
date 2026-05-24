import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_permission
from app.models import (
    BusinessExpense,
    BusinessExpenseAuditLog,
    ExpenseCategory,
    User,
)
from app.schemas import (
    BusinessExpenseAuditLogResponse,
    BusinessExpenseCreate,
    BusinessExpenseResponse,
    BusinessExpenseUpdate,
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryUpdate,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


VALID_PAYMENT_METHODS = [
    "cash",
    "kaspi",
    "card",
    "bank_transfer",
    "other",
]


def get_period_start(period: str) -> datetime | None:
    now = datetime.utcnow()

    if period == "today":
        return datetime.combine(now.date(), datetime.min.time())

    if period == "7d":
        return now - timedelta(days=7)

    if period == "30d":
        return now - timedelta(days=30)

    if period == "all":
        return None

    return now - timedelta(days=30)


def apply_expense_period(query, period_start: datetime | None):
    if period_start is None:
        return query

    return query.filter(BusinessExpense.expense_date >= period_start)


def create_expense_audit_log(
    db: Session,
    expense_id: int | None,
    actor_user_id: int,
    action: str,
    details: dict,
):
    audit_log = BusinessExpenseAuditLog(
        expense_id=expense_id,
        actor_user_id=actor_user_id,
        action=action,
        details=json.dumps(details, ensure_ascii=False),
    )

    db.add(audit_log)


def validate_payment_method(payment_method: str | None):
    if payment_method is None:
        return

    if payment_method not in VALID_PAYMENT_METHODS:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment method",
        )


@router.get(
    "/categories",
    response_model=list[ExpenseCategoryResponse],
)
def get_expense_categories(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.read")),
):
    query = db.query(ExpenseCategory)

    if not include_inactive:
        query = query.filter(ExpenseCategory.is_active == True)

    return query.order_by(
        ExpenseCategory.sort_order.asc(),
        ExpenseCategory.name.asc(),
    ).all()


@router.post(
    "/categories",
    response_model=ExpenseCategoryResponse,
)
def create_expense_category(
    data: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    name = data.name.strip()
    code = data.code.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Category name is required")

    if not code:
        raise HTTPException(status_code=400, detail="Category code is required")

    existing = db.query(ExpenseCategory).filter(ExpenseCategory.code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Expense category already exists")

    category = ExpenseCategory(
        name=name,
        code=code,
        description=data.description,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.patch(
    "/categories/{category_id}",
    response_model=ExpenseCategoryResponse,
)
def update_expense_category(
    category_id: int,
    data: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")

    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Category name is required")
        category.name = name

    if data.code is not None:
        code = data.code.strip().lower()
        if not code:
            raise HTTPException(status_code=400, detail="Category code is required")

        existing = (
            db.query(ExpenseCategory)
            .filter(
                ExpenseCategory.code == code,
                ExpenseCategory.id != category.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Expense category already exists")

        category.code = code

    if data.description is not None:
        category.description = data.description

    if data.is_active is not None:
        category.is_active = data.is_active

    if data.sort_order is not None:
        category.sort_order = data.sort_order

    db.commit()
    db.refresh(category)

    return category


@router.get(
    "",
    response_model=list[BusinessExpenseResponse],
)
def get_business_expenses(
    period: str = Query("30d", pattern="^(today|7d|30d|all)$"),
    category_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.read")),
):
    period_start = get_period_start(period)

    query = (
        db.query(BusinessExpense)
        .options(
            joinedload(BusinessExpense.category),
            joinedload(BusinessExpense.created_by_user),
            joinedload(BusinessExpense.updated_by_user),
            joinedload(BusinessExpense.deleted_by_user),
        )
        .filter(BusinessExpense.is_deleted == False)
    )

    query = apply_expense_period(query, period_start)

    if category_id is not None:
        query = query.filter(BusinessExpense.category_id == category_id)

    return query.order_by(
        BusinessExpense.expense_date.desc(),
        BusinessExpense.id.desc(),
    ).all()


@router.post(
    "",
    response_model=BusinessExpenseResponse,
)
def create_business_expense(
    data: BusinessExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    try:
        category = (
            db.query(ExpenseCategory)
            .filter(
                ExpenseCategory.id == data.category_id,
                ExpenseCategory.is_active == True,
            )
            .first()
        )
        if not category:
            raise HTTPException(status_code=404, detail="Active expense category not found")

        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="Expense amount must be greater than zero")

        title = data.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Expense title is required")

        validate_payment_method(data.payment_method)

        expense = BusinessExpense(
            category_id=category.id,
            amount=data.amount,
            expense_date=data.expense_date or datetime.utcnow(),
            title=title,
            description=data.description,
            payment_method=data.payment_method,
            created_by_user_id=current_user.id,
        )

        db.add(expense)
        db.flush()

        create_expense_audit_log(
            db=db,
            expense_id=expense.id,
            actor_user_id=current_user.id,
            action="expense_created",
            details={
                "expense": {
                    "id": expense.id,
                    "category_id": expense.category_id,
                    "amount": expense.amount,
                    "expense_date": str(expense.expense_date),
                    "title": expense.title,
                    "description": expense.description,
                    "payment_method": expense.payment_method,
                },
            },
        )

        db.commit()
        db.refresh(expense)

        return expense

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.patch(
    "/{expense_id}",
    response_model=BusinessExpenseResponse,
)
def update_business_expense(
    expense_id: int,
    data: BusinessExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    try:
        expense = (
            db.query(BusinessExpense)
            .options(
                joinedload(BusinessExpense.category),
                joinedload(BusinessExpense.created_by_user),
                joinedload(BusinessExpense.updated_by_user),
                joinedload(BusinessExpense.deleted_by_user),
            )
            .filter(
                BusinessExpense.id == expense_id,
                BusinessExpense.is_deleted == False,
            )
            .first()
        )

        if not expense:
            raise HTTPException(status_code=404, detail="Business expense not found")

        before = {
            "category_id": expense.category_id,
            "amount": expense.amount,
            "expense_date": str(expense.expense_date),
            "title": expense.title,
            "description": expense.description,
            "payment_method": expense.payment_method,
        }

        if data.category_id is not None:
            category = (
                db.query(ExpenseCategory)
                .filter(
                    ExpenseCategory.id == data.category_id,
                    ExpenseCategory.is_active == True,
                )
                .first()
            )
            if not category:
                raise HTTPException(status_code=404, detail="Active expense category not found")

            expense.category_id = category.id

        if data.amount is not None:
            if data.amount <= 0:
                raise HTTPException(status_code=400, detail="Expense amount must be greater than zero")

            expense.amount = data.amount

        if data.expense_date is not None:
            expense.expense_date = data.expense_date

        if data.title is not None:
            title = data.title.strip()
            if not title:
                raise HTTPException(status_code=400, detail="Expense title is required")

            expense.title = title

        if data.description is not None:
            expense.description = data.description

        if data.payment_method is not None:
            validate_payment_method(data.payment_method)
            expense.payment_method = data.payment_method

        expense.updated_by_user_id = current_user.id
        expense.updated_at = datetime.utcnow()

        after = {
            "category_id": expense.category_id,
            "amount": expense.amount,
            "expense_date": str(expense.expense_date),
            "title": expense.title,
            "description": expense.description,
            "payment_method": expense.payment_method,
        }

        create_expense_audit_log(
            db=db,
            expense_id=expense.id,
            actor_user_id=current_user.id,
            action="expense_updated",
            details={
                "before": before,
                "after": after,
            },
        )

        db.commit()
        db.refresh(expense)

        return expense

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.delete(
    "/{expense_id}",
    response_model=BusinessExpenseResponse,
)
def delete_business_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    try:
        expense = (
            db.query(BusinessExpense)
            .options(
                joinedload(BusinessExpense.category),
                joinedload(BusinessExpense.created_by_user),
                joinedload(BusinessExpense.updated_by_user),
                joinedload(BusinessExpense.deleted_by_user),
            )
            .filter(
                BusinessExpense.id == expense_id,
                BusinessExpense.is_deleted == False,
            )
            .first()
        )

        if not expense:
            raise HTTPException(status_code=404, detail="Business expense not found")

        before = {
            "id": expense.id,
            "category_id": expense.category_id,
            "amount": expense.amount,
            "expense_date": str(expense.expense_date),
            "title": expense.title,
            "description": expense.description,
            "payment_method": expense.payment_method,
        }

        expense.is_deleted = True
        expense.deleted_at = datetime.utcnow()
        expense.deleted_by_user_id = current_user.id
        expense.updated_at = datetime.utcnow()
        expense.updated_by_user_id = current_user.id

        create_expense_audit_log(
            db=db,
            expense_id=expense.id,
            actor_user_id=current_user.id,
            action="expense_deleted",
            details={
                "expense": before,
            },
        )

        db.commit()
        db.refresh(expense)

        return expense

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise


@router.get(
    "/audit-logs",
    response_model=list[BusinessExpenseAuditLogResponse],
)
def get_business_expense_audit_logs(
    expense_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.read")),
):
    query = (
        db.query(BusinessExpenseAuditLog)
        .options(joinedload(BusinessExpenseAuditLog.actor_user))
        .order_by(BusinessExpenseAuditLog.created_at.desc())
    )

    if expense_id is not None:
        query = query.filter(BusinessExpenseAuditLog.expense_id == expense_id)

    return query.limit(limit).all()