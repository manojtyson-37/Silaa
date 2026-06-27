from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.accessory_inventory.models import AccessoryItem, AccessoryLedgerEntry
from app.core.ledger_base import Direction, compute_balance
from app.core.ref_validator import validate_reference
from app.uom.service import convert


class InsufficientStockError(Exception):
    pass


def receive_accessory(
    session: Session,
    *,
    accessory_item_id: int,
    supplier_id: int,
    po_line_id: int,
    received_qty: Decimal,
    purchase_uom: str,
    warehouse_id: int,
    created_by: str,
) -> AccessoryLedgerEntry:
    item = session.get(AccessoryItem, accessory_item_id)
    consumption_qty = convert(session, received_qty, purchase_uom, item.consumption_uom)

    entry = AccessoryLedgerEntry(
        accessory_item_id=accessory_item_id,
        supplier_id=supplier_id,
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
    return entry


def issue_accessory(
    session: Session,
    *,
    accessory_item_id: int,
    qty: Decimal,
    warehouse_id: int,
    reference_type: str,
    reference_id: int,
    created_by: str,
    commit: bool = True,
) -> AccessoryLedgerEntry:
    item = session.query(AccessoryItem).filter_by(id=accessory_item_id).with_for_update().one()
    validate_reference(session, reference_type, reference_id)

    balance = compute_balance(
        session, AccessoryLedgerEntry, {"accessory_item_id": item.id}, warehouse_id
    )
    if qty > balance:
        session.rollback()
        raise InsufficientStockError(f"Requested {qty}, available {balance}")

    entry = AccessoryLedgerEntry(
        accessory_item_id=item.id,
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


def accessory_balance(session: Session, accessory_item_id: int, warehouse_id: int) -> Decimal:
    return compute_balance(
        session, AccessoryLedgerEntry, {"accessory_item_id": accessory_item_id}, warehouse_id
    )
