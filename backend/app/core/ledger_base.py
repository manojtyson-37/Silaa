"""Shared base for every ledger table (fabric/accessory/finished-goods).

Ledger rows are append-only: corrections happen via a new offsetting entry,
never an UPDATE/DELETE on an existing row. See PHASE1_ARCHITECTURE.md §8.
"""
import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, event
from sqlalchemy.orm import Mapped, Session, declared_attr, mapped_column

from app.db import Base


class Direction(str, enum.Enum):
    IN = "in"
    OUT = "out"


class LedgerImmutabilityError(Exception):
    pass


class LedgerEntryMixin:
    """Mix into any append-only ledger entry model.

    Subclasses add their own item-reference column (e.g. fabric_lot_id) —
    that column varies per ledger, everything else here is shared.
    """

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    txn_type: Mapped[str] = mapped_column(String, nullable=False)
    reason_code: Mapped[str] = mapped_column(String, nullable=True)
    reference_type: Mapped[str] = mapped_column(String, nullable=True)
    reference_id: Mapped[int] = mapped_column(nullable=True)
    created_by: Mapped[str] = mapped_column(String, nullable=False)

    @declared_attr
    def created_at(cls) -> Mapped[datetime]:
        return mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


_LEDGER_MODELS: set[type] = set()


def register_ledger_model(model: type) -> type:
    """Call once per ledger model class to enforce append-only at the ORM layer.

    DB-level REVOKE UPDATE/DELETE grants are the production-hardening
    complement to this (an ops/deployment task, not app code) — this
    decorator is the app-layer guarantee that's testable in CI today.
    """
    _LEDGER_MODELS.add(model)
    return model


@event.listens_for(Session, "before_flush")
def _block_ledger_mutation(session, flush_context, instances):
    for obj in list(session.dirty):
        if type(obj) in _LEDGER_MODELS and obj not in session.new:
            raise LedgerImmutabilityError(
                f"{type(obj).__name__} rows are append-only; UPDATE is not permitted."
            )
    for obj in list(session.deleted):
        if type(obj) in _LEDGER_MODELS:
            raise LedgerImmutabilityError(
                f"{type(obj).__name__} rows are append-only; DELETE is not permitted."
            )


def compute_balance(session: Session, model: type, item_filter: dict, warehouse_id: int) -> Decimal:
    """SUM(in) - SUM(out) for the given ledger model, scoped to one item and warehouse.

    Source of truth is always this live computation over the ledger — never a
    stored/cached balance column (PHASE1_ARCHITECTURE.md inventory rule).
    """
    rows = (
        session.query(model)
        .filter_by(warehouse_id=warehouse_id, **item_filter)
        .all()
    )
    total = Decimal("0")
    for row in rows:
        if row.direction == Direction.IN.value:
            total += row.quantity
        else:
            total -= row.quantity
    return total
