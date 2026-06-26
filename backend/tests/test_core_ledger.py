from decimal import Decimal

import pytest

from app.accessory_inventory.models import AccessoryLedgerEntry
from app.core.ledger_base import Direction, LedgerImmutabilityError, compute_balance


def test_balance_sums_in_minus_out(session, warehouse_id):
    session.add_all(
        [
            AccessoryLedgerEntry(
                accessory_item_id=1, warehouse_id=warehouse_id, quantity=Decimal(10),
                direction=Direction.IN.value, txn_type="purchase", created_by="t",
            ),
            AccessoryLedgerEntry(
                accessory_item_id=1, warehouse_id=warehouse_id, quantity=Decimal(3),
                direction=Direction.OUT.value, txn_type="issue", created_by="t",
            ),
        ]
    )
    session.commit()
    balance = compute_balance(session, AccessoryLedgerEntry, {"accessory_item_id": 1}, warehouse_id)
    assert balance == Decimal(7)


def test_ledger_rows_are_immutable(session, warehouse_id):
    entry = AccessoryLedgerEntry(
        accessory_item_id=1, warehouse_id=warehouse_id, quantity=Decimal(5),
        direction=Direction.IN.value, txn_type="purchase", created_by="t",
    )
    session.add(entry)
    session.commit()

    entry.quantity = Decimal(99)
    with pytest.raises(LedgerImmutabilityError):
        session.commit()
    session.rollback()

    session.delete(entry)
    with pytest.raises(LedgerImmutabilityError):
        session.commit()
