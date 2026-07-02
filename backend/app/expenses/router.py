from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.expenses.models import Expense, ExpenseCategory

router = APIRouter(tags=["expenses"])


# ── Categories ──────────────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str
    color: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    color: Optional[str]


@router.get("/expense-categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(ExpenseCategory).order_by(ExpenseCategory.name)).all()


@router.post("/expense-categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryIn, db: Session = Depends(get_db)):
    cat = ExpenseCategory(name=payload.name, color=payload.color)
    db.add(cat)
    db.commit()
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


# ── Expenses ─────────────────────────────────────────────────────────────────

class ExpenseIn(BaseModel):
    category_id: int
    amount: Decimal
    expense_date: date
    description: str
    paid_to: Optional[str] = None
    tags: list[str] = []


class ExpenseOut(BaseModel):
    id: int
    category_id: int
    amount: Decimal
    expense_date: date
    description: str
    paid_to: Optional[str]
    tags: list[str]


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
    exp = Expense(**payload.model_dump())
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/expenses/{id}", status_code=204)
def delete_expense(id: int, db: Session = Depends(get_db)):
    exp = db.get(Expense, id)
    if not exp:
        raise HTTPException(404, "Expense not found")
    db.delete(exp)
    db.commit()
