from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.fabric_inventory.models import FabricLot  # ensures "FabricLot" resolves when this module is imported alone


class ExpenseCategory(Base):
    __tablename__ = "expense_category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String, nullable=True)
    icon: Mapped[str] = mapped_column(String, nullable=True)


class CategoryBudget(Base):
    __tablename__ = "expense_category_budget"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("expense_category.id"), unique=True, nullable=False)
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class CompanySetting(Base):
    __tablename__ = "company_setting"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)


class Expense(Base):
    __tablename__ = "expense"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("expense_category.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    paid_to: Mapped[str] = mapped_column(String, nullable=True)
    receipt_urls: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Deleting an expense cascades to its procurement lots (and via FabricLot's
    # own cascades, their ledger + landed-cost rows). Router still 409s first
    # if any lot has been consumed in production.
    fabric_lots: Mapped[list["FabricLot"]] = relationship(  # noqa: F821
        cascade="all, delete-orphan", passive_deletes=False
    )
