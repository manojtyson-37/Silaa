from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.ledger_base import Direction, compute_balance
from app.core.ref_validator import validate_reference
from app.fabric_inventory.models import FabricLedgerEntry, FabricLot
from app.uom.service import convert


class InsufficientStockError(Exception):
    pass


def receive_fabric(
    session: Session,
    *,
    fabric_item_id: int,
    supplier_id: int,
    po_line_id: int,
    received_qty: Decimal,
    purchase_uom: str,
    consumption_uom: str,
    cost_per_uom: Decimal,
    warehouse_id: int,
    created_by: str,
    dye_lot_no: str | None = None,
) -> FabricLot:
    """GRN: creates the lot + its purchase ledger entry atomically (one transaction)."""
    consumption_qty = convert(session, received_qty, purchase_uom, consumption_uom)

    lot = FabricLot(
        fabric_item_id=fabric_item_id,
        supplier_id=supplier_id,
        po_line_id=po_line_id,
        dye_lot_no=dye_lot_no,
        received_qty=consumption_qty,
        cost_per_uom=cost_per_uom,
    )
    session.add(lot)
    session.flush()  # assigns lot.id within the same transaction

    entry = FabricLedgerEntry(
        fabric_lot_id=lot.id,
        warehouse_id=warehouse_id,
        quantity=consumption_qty,
        direction=Direction.IN.value,
        txn_type="purchase",
        reference_type="purchase_order_line",
        reference_id=po_line_id,
        created_by=created_by,
    )
    session.add(entry)
    session.commit()
    return lot


def issue_fabric(
    session: Session,
    *,
    fabric_lot_id: int,
    qty: Decimal,
    warehouse_id: int,
    reference_type: str,
    reference_id: int,
    created_by: str,
    commit: bool = True,
) -> FabricLedgerEntry:
    """Issue fabric to production. Locks the lot row to serialize concurrent
    issues against the same lot (on SQLite, the DB's single-writer lock gives
    the same guarantee even though FOR UPDATE itself is a no-op there).

    commit=False lets a caller (e.g. production.record_cutting) fold this
    write into a larger atomic transaction instead of committing standalone."""
    lot = session.query(FabricLot).filter_by(id=fabric_lot_id).with_for_update().one()
    validate_reference(session, reference_type, reference_id)

    balance = compute_balance(session, FabricLedgerEntry, {"fabric_lot_id": lot.id}, warehouse_id)
    if qty > balance:
        session.rollback()
        raise InsufficientStockError(f"Requested {qty}, available {balance}")

    entry = FabricLedgerEntry(
        fabric_lot_id=lot.id,
        warehouse_id=warehouse_id,
        quantity=qty,
        direction=Direction.OUT.value,
        txn_type="issue",
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


def adjust_fabric(
    session: Session,
    *,
    fabric_lot_id: int,
    qty: Decimal,
    direction: Direction,
    reason_code: str,
    warehouse_id: int,
    created_by: str,
) -> FabricLedgerEntry:
    """Damage/shrinkage/return adjustments — same ledger-only path as issue, no reference required."""
    entry = FabricLedgerEntry(
        fabric_lot_id=fabric_lot_id,
        warehouse_id=warehouse_id,
        quantity=qty,
        direction=direction.value,
        txn_type="adjustment",
        reason_code=reason_code,
        created_by=created_by,
    )
    session.add(entry)
    session.commit()
    return entry


def fabric_balance(session: Session, fabric_lot_id: int, warehouse_id: int) -> Decimal:
    return compute_balance(session, FabricLedgerEntry, {"fabric_lot_id": fabric_lot_id}, warehouse_id)
