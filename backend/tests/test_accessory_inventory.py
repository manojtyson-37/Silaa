from decimal import Decimal

import pytest

from app.accessory_inventory.models import AccessoryItem
from app.accessory_inventory.service import (
    InsufficientStockError,
    accessory_balance,
    issue_accessory,
    receive_accessory,
)
from app.uom.models import UOMConversion, UnitOfMeasure


def _seed(session):
    piece = UnitOfMeasure(code="piece", name="Piece", category="count")
    dozen = UnitOfMeasure(code="dozen", name="Dozen", category="count")
    session.add_all([piece, dozen])
    session.flush()
    session.add(UOMConversion(from_uom_id=dozen.id, to_uom_id=piece.id, factor=Decimal(12)))
    item = AccessoryItem(name="Button", type="button", consumption_uom="piece")
    session.add(item)
    session.commit()
    return item


def test_grn_converts_dozen_to_piece(session, warehouse_id):
    item = _seed(session)
    entry = receive_accessory(
        session, accessory_item_id=item.id, supplier_id=1, po_line_id=1,
        received_qty=Decimal(2), purchase_uom="dozen", warehouse_id=warehouse_id, created_by="t",
    )
    assert entry.quantity == Decimal(24)
    assert accessory_balance(session, item.id, warehouse_id) == Decimal(24)


def test_insufficient_balance_rejected(session, warehouse_id):
    item = _seed(session)
    receive_accessory(
        session, accessory_item_id=item.id, supplier_id=1, po_line_id=1,
        received_qty=Decimal(1), purchase_uom="dozen", warehouse_id=warehouse_id, created_by="t",
    )
    with pytest.raises(InsufficientStockError):
        issue_accessory(
            session, accessory_item_id=item.id, qty=Decimal(100), warehouse_id=warehouse_id,
            reference_type=None, reference_id=None, created_by="t",
        )
