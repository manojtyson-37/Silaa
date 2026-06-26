import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class QCState(str, enum.Enum):
    PASS = "PASS"
    REWORK = "REWORK"
    SECOND_SALE = "SECOND_SALE"
    SCRAP = "SCRAP"
    HOLD = "HOLD"


class ProductionOrder(Base):
    __tablename__ = "production_order"

    id: Mapped[int] = mapped_column(primary_key=True)
    style_id: Mapped[int] = mapped_column(ForeignKey("style.id"), nullable=False)
    bom_version_id: Mapped[int] = mapped_column(ForeignKey("bom_version.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    source: Mapped[str] = mapped_column(String, nullable=False)  # sales_order/stock_build


class ProductionOrderVariant(Base):
    """The variant breakdown locked in at order creation."""

    __tablename__ = "production_order_variant"

    id: Mapped[int] = mapped_column(primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("production_order.id"), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey("style_variant.id"), nullable=False)
    planned_qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)


class CuttingRecord(Base):
    __tablename__ = "cutting_record"

    id: Mapped[int] = mapped_column(primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("production_order.id"), nullable=False)
    fabric_lot_id: Mapped[int] = mapped_column(ForeignKey("fabric_lot.id"), nullable=False)
    planned_fabric_qty: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    actual_fabric_qty: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    cut_pieces_qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    wastage_qty: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False, default=0)


class StitchingBatch(Base):
    __tablename__ = "stitching_batch"

    id: Mapped[int] = mapped_column(primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("production_order.id"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("supplier.id"), nullable=True)
    in_house: Mapped[bool] = mapped_column(nullable=False, default=False)
    sent_qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    received_qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    rejected_qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    qc_state: Mapped[str] = mapped_column(String, nullable=True)


class ReworkRecord(Base):
    __tablename__ = "rework_record"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_stitching_batch_id: Mapped[int] = mapped_column(
        ForeignKey("stitching_batch.id"), nullable=False
    )
    qty: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason_code: Mapped[str] = mapped_column(String, nullable=True)
    outcome: Mapped[str] = mapped_column(String, nullable=False)  # passed/scrapped


class ProductionEvent(Base):
    """Audit/log table only — references the structured record above via
    ref_type/ref_id, never the source of truth for current state
    (Revision 1 Change 9 — typed-metadata middle ground, no event sourcing)."""

    __tablename__ = "production_event"

    id: Mapped[int] = mapped_column(primary_key=True)
    production_order_id: Mapped[int] = mapped_column(ForeignKey("production_order.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
