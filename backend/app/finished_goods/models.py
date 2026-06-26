from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.ledger_base import LedgerEntryMixin, register_ledger_model
from app.db import Base

FG_TXN_TYPES = (
    "production_complete",
    "sale",
    "return",
    "damage",
    "photoshoot_sample",
    "influencer_sample",
    "replacement_order",
    "adjustment",
    "stock_audit",
)


@register_ledger_model
class FinishedGoodsLedgerEntry(LedgerEntryMixin, Base):
    __tablename__ = "finished_goods_ledger_entry"

    variant_id: Mapped[int] = mapped_column(ForeignKey("style_variant.id"), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=True)
    grade: Mapped[str] = mapped_column(String, nullable=True)  # e.g. "second_sale" flag
