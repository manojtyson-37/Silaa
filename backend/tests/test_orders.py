from decimal import Decimal

import pytest

from app.core.ledger_base import Direction
from app.core.warehouse import seed_default_warehouse
from app.finished_goods.service import fg_balance, record_movement
from app.orders.service import InsufficientStockError, cancel_order, create_sales_order, fulfill_order
from app.style_variant.models import Style, StyleVariant


def _setup(session, stock_qty=Decimal(10)):
    wh = seed_default_warehouse(session)
    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    variant = StyleVariant(style_id=style.id, color="Black", size="M", sku_code="COORD-BLK-M")
    session.add(variant)
    session.flush()
    record_movement(
        session, variant_id=variant.id, qty=stock_qty, direction=Direction.IN,
        txn_type="adjustment", warehouse_id=wh.id, reason_code="initial_stock", created_by="t",
    )
    return wh, variant


def test_create_sales_order(session):
    wh, variant = _setup(session)
    order = create_sales_order(
        session, customer_name="Jane", lines=[{"variant_id": variant.id, "qty": Decimal(3), "unit_price": Decimal(500)}],
        created_by="t",
    )
    assert order.status == "draft"


def test_fulfill_with_sufficient_stock_writes_fg_ledger(session):
    wh, variant = _setup(session, stock_qty=Decimal(10))
    order = create_sales_order(
        session, customer_name="Jane", lines=[{"variant_id": variant.id, "qty": Decimal(3), "unit_price": Decimal(500)}],
        created_by="t",
    )
    fulfill_order(session, order=order, warehouse_id=wh.id, created_by="t")
    assert order.status == "fulfilled"
    assert fg_balance(session, variant.id, wh.id) == Decimal(7)


def test_fulfill_with_insufficient_stock_writes_nothing(session):
    wh, variant = _setup(session, stock_qty=Decimal(2))
    order = create_sales_order(
        session, customer_name="Jane", lines=[{"variant_id": variant.id, "qty": Decimal(5), "unit_price": Decimal(500)}],
        created_by="t",
    )
    with pytest.raises(InsufficientStockError):
        fulfill_order(session, order=order, warehouse_id=wh.id, created_by="t")
    assert order.status == "draft"
    assert fg_balance(session, variant.id, wh.id) == Decimal(2)


def test_fulfill_checks_all_lines_before_writing_any(session):
    wh, variant_ok = _setup(session, stock_qty=Decimal(10))
    style2 = Style(name="Style2", category="set")
    session.add(style2)
    session.flush()
    variant_short = StyleVariant(style_id=style2.id, color="Red", size="S", sku_code="S2-RED-S")
    session.add(variant_short)
    session.flush()
    # no stock for variant_short

    order = create_sales_order(
        session, customer_name="Jane",
        lines=[
            {"variant_id": variant_ok.id, "qty": Decimal(3), "unit_price": Decimal(500)},
            {"variant_id": variant_short.id, "qty": Decimal(1), "unit_price": Decimal(500)},
        ],
        created_by="t",
    )
    with pytest.raises(InsufficientStockError):
        fulfill_order(session, order=order, warehouse_id=wh.id, created_by="t")
    # variant_ok must NOT have been debited even though its line had enough stock
    assert fg_balance(session, variant_ok.id, wh.id) == Decimal(10)


def test_cancel_order(session):
    wh, variant = _setup(session)
    order = create_sales_order(
        session, customer_name="Jane", lines=[{"variant_id": variant.id, "qty": Decimal(1), "unit_price": Decimal(500)}],
        created_by="t",
    )
    cancel_order(session, order=order)
    assert order.status == "cancelled"


def test_cannot_fulfill_already_fulfilled_order(session):
    wh, variant = _setup(session)
    order = create_sales_order(
        session, customer_name="Jane", lines=[{"variant_id": variant.id, "qty": Decimal(1), "unit_price": Decimal(500)}],
        created_by="t",
    )
    fulfill_order(session, order=order, warehouse_id=wh.id, created_by="t")
    with pytest.raises(ValueError):
        fulfill_order(session, order=order, warehouse_id=wh.id, created_by="t")
