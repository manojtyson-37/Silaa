import enum
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SalesOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class SalesOrder(Base):
    """ponytail: no InventoryReservation here — Phase 1 is single-channel,
    manual order entry, so the overselling risk Reservation exists to solve
    (Revision 1 Change 3) doesn't apply yet. Fulfillment checks current FG
    balance at write time instead. Add Reservation when a second channel
    (e.g. Shopify) starts placing orders concurrently with this one."""

    __tablename__ = "sales_order"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default=SalesOrderStatus.DRAFT.value)


class SalesOrderLine(Base):
    __tablename__ = "sales_order_line"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_order.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey("style_variant.id"), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
