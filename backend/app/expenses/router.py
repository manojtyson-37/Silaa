from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.deps import RequireRole
from app.db import get_db
from app.expenses.models import CategoryBudget, CompanySetting, Expense, ExpenseCategory

router = APIRouter(tags=["expenses"])


# ── Categories ──────────────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    color: Optional[str]
    icon: Optional[str]


@router.get("/expense-categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(ExpenseCategory).order_by(ExpenseCategory.name)).all()


@router.post("/expense-categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryIn, db: Session = Depends(get_db)):
    cat = ExpenseCategory(name=payload.name, color=payload.color, icon=payload.icon)
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Category name already exists")
    db.refresh(cat)
    return cat


@router.patch("/expense-categories/{id}", response_model=CategoryOut)
def update_category(id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.get(ExpenseCategory, id)
    if not cat:
        raise HTTPException(404, "Category not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and not (data["name"] or "").strip():
        raise HTTPException(422, "Name cannot be empty")
    for field, value in data.items():
        setattr(cat, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Category name already exists")
    db.refresh(cat)
    return cat


@router.delete("/expense-categories/{id}", status_code=204)
def delete_category(id: int, db: Session = Depends(get_db)):
    cat = db.get(ExpenseCategory, id)
    if not cat:
        raise HTTPException(404, "Category not found")
    if db.scalar(select(func.count()).select_from(Expense).where(Expense.category_id == id)):
        raise HTTPException(409, "Category has expenses — delete them first")
    db.delete(cat)
    db.commit()


# ── Category Budgets ─────────────────────────────────────────────────────────

class CategoryBudgetIn(BaseModel):
    monthly_limit: Decimal


class CategoryBudgetOut(BaseModel):
    id: int
    category_id: int
    monthly_limit: Decimal


@router.get("/expense-category-budgets", response_model=list[CategoryBudgetOut])
def list_budgets(db: Session = Depends(get_db)):
    return db.scalars(select(CategoryBudget)).all()


@router.patch("/expense-category-budgets/{category_id}", response_model=CategoryBudgetOut)
def upsert_budget(category_id: int, payload: CategoryBudgetIn, db: Session = Depends(get_db)):
    if not db.get(ExpenseCategory, category_id):
        raise HTTPException(404, "Category not found")
    budget = db.scalar(select(CategoryBudget).where(CategoryBudget.category_id == category_id))
    if budget:
        budget.monthly_limit = payload.monthly_limit
    else:
        budget = CategoryBudget(category_id=category_id, monthly_limit=payload.monthly_limit)
        db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/expense-category-budgets/{category_id}", status_code=204)
def delete_budget(category_id: int, db: Session = Depends(get_db)):
    budget = db.scalar(select(CategoryBudget).where(CategoryBudget.category_id == category_id))
    if not budget:
        raise HTTPException(404, "Budget not found")
    db.delete(budget)
    db.commit()


# ── Company Settings ──────────────────────────────────────────────────────────

class SettingIn(BaseModel):
    value: str


class SettingOut(BaseModel):
    key: str
    value: str


@router.get("/company-settings", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db)):
    return db.scalars(select(CompanySetting)).all()


_ALLOWED_SETTING_KEYS = {"currency", "gstin", "business_address"}


@router.patch("/company-settings/{key}", response_model=SettingOut, dependencies=[Depends(RequireRole(["admin"]))])
def upsert_setting(key: str, payload: SettingIn, db: Session = Depends(get_db)):
    if key not in _ALLOWED_SETTING_KEYS:
        raise HTTPException(400, f"Unknown setting key: {key}")
    setting = db.get(CompanySetting, key)
    if setting:
        setting.value = payload.value
    else:
        setting = CompanySetting(key=key, value=payload.value)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


# ── Expenses ─────────────────────────────────────────────────────────────────

class ProcurementItemCreate(BaseModel):
    fabric_item_id: Optional[int] = None
    new_fabric_name: Optional[str] = None
    new_fabric_composition: Optional[str] = None
    new_fabric_gsm: Optional[int] = None
    new_fabric_width: Optional[Decimal] = None
    supplier_id: Optional[int] = None
    new_supplier_name: Optional[str] = None
    fabric_qty: Decimal
    price: Decimal
    image_url: Optional[str] = None


class ExpenseIn(BaseModel):
    category_id: int
    amount: Decimal
    expense_date: date
    description: str
    paid_to: Optional[str] = None
    tags: list[str] = []
    receipt_urls: list[str] = []
    is_recurring: bool = False
    procurement_items: list[ProcurementItemCreate] = []


class ExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    amount: Optional[Decimal] = None
    expense_date: Optional[date] = None
    description: Optional[str] = None
    paid_to: Optional[str] = None
    tags: Optional[list[str]] = None
    receipt_urls: Optional[list[str]] = None
    is_recurring: Optional[bool] = None


class ExpenseOut(BaseModel):
    id: int
    category_id: int
    amount: Decimal
    expense_date: date
    description: str
    paid_to: Optional[str]
    tags: list[str]
    receipt_urls: list[str]
    is_recurring: bool


@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    category_id: Optional[int] = None,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(Expense).order_by(Expense.expense_date.desc(), Expense.id.desc())
    if category_id:
        q = q.where(Expense.category_id == category_id)
    rows = db.scalars(q).all()
    if tag:
        rows = [r for r in rows if tag in (r.tags or [])]
    return rows


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(payload: ExpenseIn, db: Session = Depends(get_db)):
    if not db.get(ExpenseCategory, payload.category_id):
        raise HTTPException(404, "Category not found")
        
    data = payload.model_dump(exclude={"procurement_items"})
    exp = Expense(**data)
    db.add(exp)
    db.flush()
    
    if payload.procurement_items:
        from app.procurement.models import Supplier
        from app.fabric_inventory.models import FabricItem, FabricLot, FabricLedgerEntry
        from app.core.warehouse import Warehouse
        
        wh = db.scalar(select(Warehouse).limit(1))
        warehouse_id = wh.id if wh else 1
        
        for item in payload.procurement_items:
            if item.new_supplier_name:
                supp = Supplier(name=item.new_supplier_name, type="fabric")
                db.add(supp)
                db.flush()
                supp_id = supp.id
            elif item.supplier_id:
                supp_id = item.supplier_id
            else:
                raise HTTPException(400, "Must provide supplier_id or new_supplier_name")
                
            if item.new_fabric_name:
                fab = FabricItem(
                    name=item.new_fabric_name,
                    composition=item.new_fabric_composition,
                    gsm=item.new_fabric_gsm,
                    width=item.new_fabric_width,
                    consumption_uom="meter",
                    image_url=item.image_url,
                )
                db.add(fab)
                db.flush()
                fab_id = fab.id
            elif item.fabric_item_id:
                fab_id = item.fabric_item_id
                if item.image_url:
                    fab = db.get(FabricItem, fab_id)
                    if fab:
                        fab.image_url = item.image_url
            else:
                raise HTTPException(400, "Must provide fabric_item_id or new_fabric_name")
                
            if item.fabric_qty <= 0:
                raise HTTPException(400, "Quantity must be > 0")
                
            cost_per_uom = item.price / item.fabric_qty
            
            lot = FabricLot(
                fabric_item_id=fab_id,
                supplier_id=supp_id,
                expense_id=exp.id,
                received_qty=item.fabric_qty,
                cost_per_uom=cost_per_uom,
            )
            db.add(lot)
            db.flush()
            
            ledger = FabricLedgerEntry(
                fabric_lot_id=lot.id,
                warehouse_id=warehouse_id,
                txn_type="GRN",
                direction="in",
                quantity=item.fabric_qty,
                reference_type="Expense",
                reference_id=exp.id,
                created_by="QuickProcurement"
            )
            db.add(ledger)
            
    db.commit()
    db.refresh(exp)
    return exp


@router.patch("/expenses/{id}", response_model=ExpenseOut)
def update_expense(id: int, payload: ExpenseUpdate, db: Session = Depends(get_db)):
    exp = db.get(Expense, id)
    if not exp:
        raise HTTPException(404, "Expense not found")
    if payload.category_id is not None and not db.get(ExpenseCategory, payload.category_id):
        raise HTTPException(404, "Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/expenses/{id}", status_code=204)
def delete_expense(id: int, db: Session = Depends(get_db)):
    exp = db.get(Expense, id)
    if not exp:
        raise HTTPException(404, "Expense not found")
        
    # Check for linked fabric lots
    from app.fabric_inventory.models import FabricLot, FabricLedgerEntry
    from sqlalchemy import select, func
    
    lots = db.scalars(select(FabricLot).where(FabricLot.expense_id == id)).all()
    for lot in lots:
        # Check if lot has been consumed (any ledger entries other than the initial GRN)
        ledger_count = db.scalar(
            select(func.count())
            .select_from(FabricLedgerEntry)
            .where(FabricLedgerEntry.fabric_lot_id == lot.id)
        )
        if ledger_count > 1:
            raise HTTPException(409, "Cannot delete expense: The received fabric has already been consumed in production.")
            
        # Delete the GRN ledger entry
        db.execute(FabricLedgerEntry.__table__.delete().where(FabricLedgerEntry.fabric_lot_id == lot.id))
        db.delete(lot)
        
    db.delete(exp)
    db.commit()
