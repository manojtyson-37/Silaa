from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.accessory_inventory.models import AccessoryItem, AccessoryLedgerEntry
from app.core.ledger_base import Direction
from app.core.ref_validator import validate_reference
from app.fabric_inventory.models import FabricLedgerEntry, FabricLot
from app.finished_goods.models import FinishedGoodsLedgerEntry


def production_cost_breakdown(session: Session, production_order_id: int) -> dict:
    """Fabric + accessory + labor cost actually consumed by a production
    order so far. Accessory cost uses AccessoryItem.default_cost (no
    per-lot costing for accessories, unlike fabric's per-lot cost_per_uom —
    ponytail: add accessory lot costing if suppliers start quoting
    materially different prices per batch). Labor cost is the sum of
    StitchingBatch.labor_cost manually entered per batch."""
    from app.production.models import StitchingBatch

    fabric_entries = (
        session.query(FabricLedgerEntry)
        .filter_by(reference_type="production_order", reference_id=production_order_id, direction=Direction.OUT.value)
        .all()
    )
    fabric_cost = Decimal("0")
    for entry in fabric_entries:
        lot = session.get(FabricLot, entry.fabric_lot_id)
        fabric_cost += entry.quantity * lot.cost_per_uom

    accessory_entries = (
        session.query(AccessoryLedgerEntry)
        .filter_by(reference_type="production_order", reference_id=production_order_id, direction=Direction.OUT.value)
        .all()
    )
    accessory_cost = Decimal("0")
    for entry in accessory_entries:
        item = session.get(AccessoryItem, entry.accessory_item_id)
        accessory_cost += entry.quantity * (item.default_cost or Decimal("0"))

    labor_cost = (
        session.query(StitchingBatch)
        .filter_by(production_order_id=production_order_id)
        .with_entities(StitchingBatch.labor_cost)
        .all()
    )
    labor_cost = sum((row[0] or Decimal("0") for row in labor_cost), Decimal("0"))

    return {
        "fabric_cost": fabric_cost,
        "accessory_cost": accessory_cost,
        "labor_cost": labor_cost,
        "total_cost": fabric_cost + accessory_cost + labor_cost,
    }


def average_unit_cost(session: Session, variant_id: int) -> Decimal:
    """Weighted-average cost basis across every production_complete entry
    for this variant. ponytail: simple weighted average, not FIFO/lot
    costing — good enough for an at-a-glance margin figure, revisit if the
    business needs per-batch cost precision."""
    entries = (
        session.query(FinishedGoodsLedgerEntry)
        .filter_by(variant_id=variant_id, txn_type="production_complete", direction=Direction.IN.value)
        .all()
    )
    total_qty = sum((e.quantity for e in entries), Decimal("0"))
    if not total_qty:
        return Decimal("0")
    total_cost = sum((e.quantity * (e.unit_cost or Decimal("0")) for e in entries), Decimal("0"))
    return total_cost / total_qty


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
    total_cost = production_cost_breakdown(session, production_order_id)["total_cost"]
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
    reference_type: str | None = None,
    reference_id: int | None = None,
    commit: bool = True,
) -> FinishedGoodsLedgerEntry:
    """Manual entry path for every txn_type EXCEPT production_complete
    (sale/return/damage/photoshoot_sample/influencer_sample/replacement_order/
    adjustment/stock_audit) — see write_production_complete for that one.

    commit=False lets a caller (e.g. orders.fulfill_order, writing multiple
    lines) fold this write into a larger atomic transaction."""
    if txn_type == "production_complete":
        raise ValueError("production_complete entries must go through write_production_complete")
    validate_reference(session, reference_type, reference_id)

    entry = FinishedGoodsLedgerEntry(
        variant_id=variant_id,
        warehouse_id=warehouse_id,
        quantity=qty,
        direction=direction.value,
        txn_type=txn_type,
        reason_code=reason_code,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by=created_by,
    )
    session.add(entry)
    if commit:
        session.commit()
    else:
        session.flush()
    return entry


def fg_balance(session: Session, variant_id: int, warehouse_id: int) -> Decimal:
    from app.core.ledger_base import compute_balance

    return compute_balance(session, FinishedGoodsLedgerEntry, {"variant_id": variant_id}, warehouse_id)
