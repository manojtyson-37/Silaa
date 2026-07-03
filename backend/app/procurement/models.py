import enum
from decimal import Decimal
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db import Base


class POStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    PARTIALLY_RECEIVED = "partially_received"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class Supplier(Base):
    __tablename__ = "supplier"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # fabric/accessory/job-work-vendor


class PurchaseOrder(Base):
    __tablename__ = "purchase_order"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default=POStatus.DRAFT.value)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    image_url: Mapped[str] = mapped_column(String, nullable=True)
    dispatch_date: Mapped[date] = mapped_column(Date, nullable=True)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=True, default=Decimal("0"))
    payment_terms: Mapped[str] = mapped_column(String, nullable=True)


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_line"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_order.id"), nullable=False)
    component_type: Mapped[str] = mapped_column(String, nullable=False)  # fabric/accessory
    component_id: Mapped[int] = mapped_column(nullable=False)
    ordered_qty: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    ordered_uom: Mapped[str] = mapped_column(String, nullable=False)
    agreed_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)


def approve(session: Session, po: PurchaseOrder) -> None:
    if po.status != POStatus.DRAFT.value:
        raise ValueError(f"Cannot approve PO in status {po.status}")
    po.status = POStatus.APPROVED.value
    session.commit()


def outstanding_qty(session: Session, line: PurchaseOrderLine, received_so_far: Decimal) -> Decimal:
    return line.ordered_qty - received_so_far
