from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ledger_base import LedgerEntryMixin, register_ledger_model
from app.db import Base


class FabricItem(Base):
    __tablename__ = "fabric_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    composition: Mapped[str] = mapped_column(String, nullable=True)
    gsm: Mapped[int] = mapped_column(nullable=True)
    width: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=True)
    consumption_uom: Mapped[str] = mapped_column(String, nullable=False, default="meter")


class FabricLot(Base):
    __tablename__ = "fabric_lot"

    id: Mapped[int] = mapped_column(primary_key=True)
    fabric_item_id: Mapped[int] = mapped_column(ForeignKey("fabric_item.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier.id"), nullable=False)
    po_line_id: Mapped[int] = mapped_column(ForeignKey("purchase_order_line.id"), nullable=True)
    dye_lot_no: Mapped[str] = mapped_column(String, nullable=True)  # deferred decision, see Revision 1 Change 1
    received_qty: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    cost_per_uom: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)  # PO price only


class LandedCostEntry(Base):
    __tablename__ = "landed_cost_entry"

    id: Mapped[int] = mapped_column(primary_key=True)
    fabric_lot_id: Mapped[int] = mapped_column(ForeignKey("fabric_lot.id"), nullable=False)
    expense_type: Mapped[str] = mapped_column(String, nullable=False)  # freight/customs/handling
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)


@register_ledger_model
class FabricLedgerEntry(LedgerEntryMixin, Base):
    __tablename__ = "fabric_ledger_entry"

    fabric_lot_id: Mapped[int] = mapped_column(ForeignKey("fabric_lot.id"), nullable=False)
