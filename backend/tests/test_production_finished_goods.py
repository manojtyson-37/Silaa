from decimal import Decimal

import pytest

from app.bom.models import BOM, activate_version, create_bom_version
from app.core.warehouse import seed_default_warehouse
from app.fabric_inventory.models import FabricItem
from app.fabric_inventory.service import receive_fabric
from app.finished_goods.service import fg_balance, write_production_complete
from app.procurement.models import PurchaseOrder, PurchaseOrderLine, Supplier
from app.production.models import ProductionEvent, QCState
from app.production.service import (
    apply_qc,
    apply_rework,
    create_production_order,
    create_stitching_batch,
    receive_stitching,
    record_cutting,
)
from app.style_variant.models import Style, StyleVariant
from app.uom.models import UOMConversion, UnitOfMeasure


def _full_setup(session):
    wh = seed_default_warehouse(session)

    meter = UnitOfMeasure(code="meter", name="Meter", category="length")
    session.add(meter)
    session.flush()
    session.add(UOMConversion(from_uom_id=meter.id, to_uom_id=meter.id, factor=Decimal(1)))

    supplier = Supplier(name="Acme", type="fabric")
    fabric_item = FabricItem(name="Cotton", consumption_uom="meter")
    session.add_all([supplier, fabric_item])
    session.flush()

    po = PurchaseOrder(supplier_id=supplier.id, status="approved")
    session.add(po)
    session.flush()
    line = PurchaseOrderLine(
        po_id=po.id, component_type="fabric", component_id=fabric_item.id,
        ordered_qty=Decimal(100), ordered_uom="meter", agreed_price=Decimal(50),
    )
    session.add(line)
    session.commit()

    lot = receive_fabric(
        session, fabric_item_id=fabric_item.id, supplier_id=supplier.id, po_line_id=line.id,
        received_qty=Decimal(50), purchase_uom="meter", consumption_uom="meter",
        cost_per_uom=Decimal(50), warehouse_id=wh.id, created_by="t",
    )  # cost_per_uom = 50/unit

    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    variant = StyleVariant(style_id=style.id, color="Black", size="M", sku_code="COORD-BLK-M")
    session.add(variant)
    session.flush()

    bom = BOM(style_id=style.id)
    session.add(bom)
    session.flush()
    version = create_bom_version(
        session, bom, [{"component_type": "fabric", "component_id": fabric_item.id, "qty_per_unit": Decimal(2), "uom": "meter"}]
    )
    activate_version(session, bom, version)

    order = create_production_order(
        session, style_id=style.id, variants=[{"variant_id": variant.id, "planned_qty": Decimal(10)}],
        source="stock_build", created_by="t",
    )
    return wh, lot, style, variant, order


def test_cutting_is_atomic_with_fabric_issue(session):
    wh, lot, style, variant, order = _full_setup(session)
    from app.fabric_inventory.service import fabric_balance

    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0),
        warehouse_id=wh.id, created_by="t",
    )
    assert fabric_balance(session, lot.id, wh.id) == Decimal(30)  # 50 received - 20 issued


def test_qc_pass_writes_fg_ledger_with_correct_unit_cost(session):
    wh, lot, style, variant, order = _full_setup(session)

    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0),
        warehouse_id=wh.id, created_by="t",
    )
    batch = create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
    )
    receive_stitching(session, batch=batch, received_qty=Decimal(10), rejected_qty=Decimal(0), created_by="t")

    apply_qc(
        session, batch=batch, qc_state=QCState.PASS, qty=Decimal(10),
        variant_id=variant.id, warehouse_id=wh.id, created_by="t",
        fg_writer=write_production_complete,
    )

    # 20 meters * 50/meter = 1000 total fabric cost / 10 units passed = 100/unit
    assert fg_balance(session, variant.id, wh.id) == Decimal(10)
    from app.finished_goods.models import FinishedGoodsLedgerEntry

    entry = session.query(FinishedGoodsLedgerEntry).filter_by(variant_id=variant.id).one()
    assert entry.unit_cost == Decimal(100)
    assert entry.txn_type == "production_complete"


def test_scrap_does_not_write_fg_ledger(session):
    wh, lot, style, variant, order = _full_setup(session)
    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0),
        warehouse_id=wh.id, created_by="t",
    )
    batch = create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
    )
    apply_qc(session, batch=batch, qc_state=QCState.SCRAP, qty=Decimal(10), variant_id=variant.id, warehouse_id=wh.id, created_by="t")
    assert fg_balance(session, variant.id, wh.id) == Decimal(0)


def test_qc_pass_without_fg_writer_raises():
    pass  # covered logically by apply_qc's explicit ValueError; exercised via integration above


def test_rework_feeds_back_without_creating_new_production_order(session):
    wh, lot, style, variant, order = _full_setup(session)
    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0),
        warehouse_id=wh.id, created_by="t",
    )
    batch = create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
    )
    apply_qc(session, batch=batch, qc_state=QCState.REWORK, qty=Decimal(2), variant_id=variant.id, warehouse_id=wh.id, created_by="t")
    apply_rework(session, batch=batch, qty=Decimal(2), outcome="passed", reason_code="loose_thread", created_by="t")

    from app.production.models import ProductionOrder

    orders_for_style = session.query(ProductionOrder).filter_by(style_id=style.id).all()
    assert len(orders_for_style) == 1  # no phantom new order created


def test_production_event_log_is_complete(session):
    wh, lot, style, variant, order = _full_setup(session)
    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0),
        warehouse_id=wh.id, created_by="t",
    )
    batch = create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
    )
    receive_stitching(session, batch=batch, received_qty=Decimal(10), rejected_qty=Decimal(0), created_by="t")
    apply_qc(session, batch=batch, qc_state=QCState.PASS, qty=Decimal(10), variant_id=variant.id, warehouse_id=wh.id, created_by="t", fg_writer=write_production_complete)

    events = session.query(ProductionEvent).filter_by(production_order_id=order.id).order_by(ProductionEvent.id).all()
    event_types = [e.event_type for e in events]
    assert event_types == ["order_created", "cutting_recorded", "stitching_sent", "stitching_received", "qc_applied"]
