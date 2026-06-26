from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ledger_base import LedgerEntryMixin, register_ledger_model
from app.db import Base


class AccessoryItem(Base):
    __tablename__ = "accessory_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    consumption_uom: Mapped[str] = mapped_column(String, nullable=False, default="piece")
    default_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=True)


@register_ledger_model
class AccessoryLedgerEntry(LedgerEntryMixin, Base):
    __tablename__ = "accessory_ledger_entry"

    accessory_item_id: Mapped[int] = mapped_column(ForeignKey("accessory_item.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier.id"), nullable=True)
