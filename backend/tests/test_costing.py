from decimal import Decimal

from app.accessory_inventory.models import AccessoryItem
from app.accessory_inventory.service import receive_accessory
from app.bom.models import BOM, activate_version, create_bom_version
from app.core.warehouse import seed_default_warehouse
from app.fabric_inventory.models import FabricItem
from app.fabric_inventory.service import receive_fabric
from app.finished_goods.service import average_unit_cost, fg_balance, production_cost_breakdown, write_production_complete
from app.procurement.models import PurchaseOrder, PurchaseOrderLine, Supplier
from app.production.models import QCState
from app.production.service import apply_qc, create_production_order, create_stitching_batch, receive_stitching, record_cutting
from app.style_variant.models import Style, StyleVariant
from app.uom.models import UOMConversion, UnitOfMeasure


def _setup_with_accessory(session):
    wh = seed_default_warehouse(session)

    meter = UnitOfMeasure(code="meter", name="Meter", category="length")
    piece = UnitOfMeasure(code="piece", name="Piece", category="count")
    session.add_all([meter, piece])
    session.flush()
    session.add(UOMConversion(from_uom_id=meter.id, to_uom_id=meter.id, factor=Decimal(1)))
    session.add(UOMConversion(from_uom_id=piece.id, to_uom_id=piece.id, factor=Decimal(1)))

    supplier = Supplier(name="Acme", type="fabric")
    fabric_item = FabricItem(name="Cotton", consumption_uom="meter")
    accessory_item = AccessoryItem(name="Button", type="button", consumption_uom="piece", default_cost=Decimal("2"))
    session.add_all([supplier, fabric_item, accessory_item])
    session.flush()

    po = PurchaseOrder(supplier_id=supplier.id, status="approved")
    session.add(po)
    session.flush()
    fabric_line = PurchaseOrderLine(
        po_id=po.id, component_type="fabric", component_id=fabric_item.id,
        ordered_qty=Decimal(100), ordered_uom="meter", agreed_price=Decimal(50),
    )
    accessory_line = PurchaseOrderLine(
        po_id=po.id, component_type="accessory", component_id=accessory_item.id,
        ordered_qty=Decimal(100), ordered_uom="piece", agreed_price=Decimal(2),
    )
    session.add_all([fabric_line, accessory_line])
    session.commit()

    lot = receive_fabric(
        session, fabric_item_id=fabric_item.id, supplier_id=supplier.id, po_line_id=fabric_line.id,
        received_qty=Decimal(50), purchase_uom="meter", consumption_uom="meter",
        cost_per_uom=Decimal(50), warehouse_id=wh.id, created_by="t",
    )
    receive_accessory(
        session, accessory_item_id=accessory_item.id, supplier_id=supplier.id, po_line_id=accessory_line.id,
        received_qty=Decimal(100), purchase_uom="piece", warehouse_id=wh.id, created_by="t",
    )

    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    variant = StyleVariant(style_id=style.id, color="Black", size="M", sku_code="COORD-BLK-M")
    session.add(variant)
    session.flush()

    bom = BOM(style_id=style.id)
    session.add(bom)
    session.flush()
    version = create_bom_version(session, bom, [
        {"component_type": "fabric", "component_id": fabric_item.id, "qty_per_unit": Decimal(2), "uom": "meter"},
        {"component_type": "accessory", "component_id": accessory_item.id, "qty_per_unit": Decimal(3), "uom": "piece"},
    ])
    activate_version(session, bom, version)

    order = create_production_order(
        session, style_id=style.id, variants=[{"variant_id": variant.id, "planned_qty": Decimal(10)}],
        source="stock_build", created_by="t",
    )
    return wh, lot, accessory_item, variant, order


def test_stitching_batch_consumes_accessory_per_bom(session):
    wh, lot, accessory_item, variant, order = _setup_with_accessory(session)
    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0), warehouse_id=wh.id, created_by="t",
    )
    create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
    )
    from app.accessory_inventory.service import accessory_balance

    # 100 received - (3 per unit * 10 sent) = 70
    assert accessory_balance(session, accessory_item.id, wh.id) == Decimal(70)


def test_cost_breakdown_includes_fabric_accessory_and_labor(session):
    wh, lot, accessory_item, variant, order = _setup_with_accessory(session)
    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0), warehouse_id=wh.id, created_by="t",
    )
    create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
        labor_cost=Decimal("150"),
    )
    breakdown = production_cost_breakdown(session, order.id)
    # fabric: 20 meters * 50/meter = 1000
    # accessory: 30 pieces * 2/piece = 60
    # labor: 150
    assert breakdown["fabric_cost"] == Decimal(1000)
    assert breakdown["accessory_cost"] == Decimal(60)
    assert breakdown["labor_cost"] == Decimal(150)
    assert breakdown["total_cost"] == Decimal(1210)


def test_unit_cost_on_qc_pass_includes_accessory_and_labor(session):
    wh, lot, accessory_item, variant, order = _setup_with_accessory(session)
    record_cutting(
        session, production_order_id=order.id, fabric_lot_id=lot.id,
        planned_fabric_qty=Decimal(20), actual_fabric_qty=Decimal(20),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(0), warehouse_id=wh.id, created_by="t",
    )
    batch = create_stitching_batch(
        session, production_order_id=order.id, sent_qty=Decimal(10),
        vendor_id=None, in_house=True, warehouse_id=wh.id, created_by="t",
        labor_cost=Decimal("150"),
    )
    receive_stitching(session, batch=batch, received_qty=Decimal(10), rejected_qty=Decimal(0), created_by="t")
    apply_qc(
        session, batch=batch, qc_state=QCState.PASS, qty=Decimal(10),
        variant_id=variant.id, warehouse_id=wh.id, created_by="t", fg_writer=write_production_complete,
    )
    # total cost 1210 / 10 units = 121/unit
    avg_cost = average_unit_cost(session, variant.id)
    assert avg_cost == Decimal(121)
    assert fg_balance(session, variant.id, wh.id) == Decimal(10)
