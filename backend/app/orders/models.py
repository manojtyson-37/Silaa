import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SalesOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    RETURNED = "returned"
    REPLACED = "replaced"


class SalesOrder(Base):
    """ponytail: no InventoryReservation here — Phase 1 is single-channel,
    manual order entry, so the overselling risk Reservation exists to solve
    (Revision 1 Change 3) doesn't apply yet. Fulfillment checks current FG
    balance at write time instead. Add Reservation when a second channel
    (e.g. Shopify) starts placing orders concurrently with this one."""

    __tablename__ = "sales_order"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_name: Mapped[str] = mapped_column(String, nullable=False)
    customer_phone: Mapped[str] = mapped_column(String, nullable=True)
    customer_address: Mapped[str] = mapped_column(String, nullable=True)
    customer_state: Mapped[str] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=True)
    invoice_number: Mapped[str] = mapped_column(String, nullable=True, unique=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default=SalesOrderStatus.DRAFT.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SalesOrderLine(Base):
    __tablename__ = "sales_order_line"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_order.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey("style_variant.id"), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    gst_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default="5")


class SalesOrderResolution(Base):
    __tablename__ = "sales_order_resolution"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_order.id"), nullable=False, unique=True)
    resolution_type: Mapped[str] = mapped_column(String, nullable=False) # 'return' or 'replace'
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    refund_account_details: Mapped[str] = mapped_column(String, nullable=True)
    notes: Mapped[str] = mapped_column(String, nullable=True)
