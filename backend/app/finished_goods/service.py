from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.ledger_base import Direction
from app.fabric_inventory.models import FabricLedgerEntry, FabricLot
from app.finished_goods.models import FinishedGoodsLedgerEntry


def _fabric_cost_consumed(session: Session, production_order_id: int) -> Decimal:
    """Sum of (qty issued * lot cost_per_uom) for every fabric ledger entry
    referencing this production order. ponytail: accessory consumption isn't
    wired into the production module yet (cutting only issues fabric in this
    MVP) — add accessory cost into this rollup once production records
    accessory issues at the stitching/packing step."""
    entries = (
        session.query(FabricLedgerEntry)
        .filter_by(
            reference_type="production_order",
            reference_id=production_order_id,
            direction=Direction.OUT.value,
        )
        .all()
    )
    total = Decimal("0")
    for entry in entries:
        lot = session.get(FabricLot, entry.fabric_lot_id)
        total += entry.quantity * lot.cost_per_uom
    return total


def write_production_complete(
    session: Session,
    *,
    production_order_id: int,
    variant_id: int,
    qty: Decimal,
    warehouse_id: int,
    grade: str | None,
    created_by: str,
    commit: bool = True,
) -> FinishedGoodsLedgerEntry:
    """System-written only — called from production.apply_qc's PASS/SECOND_SALE
    path. No manual-entry API exposes txn_type=production_complete."""
    total_cost = _fabric_cost_consumed(session, production_order_id)
    unit_cost = (total_cost / qty) if qty else Decimal("0")

    entry = FinishedGoodsLedgerEntry(
        variant_id=variant_id,
        warehouse_id=warehouse_id,
        quantity=qty,
        direction=Direction.IN.value,
        txn_type="production_complete",
        reference_type="production_order",
        reference_id=production_order_id,
        unit_cost=unit_cost,
        grade=grade,
        created_by=created_by,
    )
    session.add(entry)
    if commit:
        session.commit()
    else:
        session.flush()
    return entry


def record_movement(
    session: Session,
    *,
    variant_id: int,
    qty: Decimal,
    direction: Direction,
    txn_type: str,
    warehouse_id: int,
    reason_code: str | None,
    created_by: str,
) -> FinishedGoodsLedgerEntry:
    """Manual entry path for every txn_type EXCEPT production_complete
    (sale/return/damage/photoshoot_sample/influencer_sample/replacement_order/
    adjustment/stock_audit) — see write_production_complete for that one."""
    if txn_type == "production_complete":
        raise ValueError("production_complete entries must go through write_production_complete")

    entry = FinishedGoodsLedgerEntry(
        variant_id=variant_id,
        warehouse_id=warehouse_id,
        quantity=qty,
        direction=direction.value,
        txn_type=txn_type,
        reason_code=reason_code,
        created_by=created_by,
    )
    session.add(entry)
    session.commit()
    return entry


def fg_balance(session: Session, variant_id: int, warehouse_id: int) -> Decimal:
    from app.core.ledger_base import compute_balance

    return compute_balance(session, FinishedGoodsLedgerEntry, {"variant_id": variant_id}, warehouse_id)
