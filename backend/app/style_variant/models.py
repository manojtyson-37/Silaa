from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Style(Base):
    """Sellable grouping concept only — never a stock-holding entity.
    Inventory lives on StyleVariant. See Revision 1 Changes 1 & 7."""

    __tablename__ = "style"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=True)
    collection: Mapped[str] = mapped_column(String, nullable=True)
    image_url: Mapped[str] = mapped_column(String, nullable=True)


class StyleVariant(Base):
    __tablename__ = "style_variant"
    __table_args__ = (UniqueConstraint("sku_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    style_id: Mapped[int] = mapped_column(ForeignKey("style.id"), nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[str] = mapped_column(String, nullable=False)
    sku_code: Mapped[str] = mapped_column(String, nullable=False)
    barcode: Mapped[str] = mapped_column(String, nullable=True)
    fabric_item_id: Mapped[int] = mapped_column(ForeignKey("fabric_item.id"), nullable=True)
    fabric_consumption: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=True)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
