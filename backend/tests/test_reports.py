from decimal import Decimal

from app.bom.models import BOM, BOMVersion
from app.core.warehouse import seed_default_warehouse
from app.fabric_inventory.models import FabricItem, FabricLot
from app.procurement.models import Supplier
from app.production.models import CuttingRecord, ProductionOrder, ReworkRecord, StitchingBatch
from app.reports.service import fabric_variance_report, wastage_rejection_report
from app.style_variant.models import Style, StyleVariant
from app.uom.models import UnitOfMeasure


def _setup(session):
    seed_default_warehouse(session)
    uom = UnitOfMeasure(code="m", name="meter", category="length")
    session.add(uom)
    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    variant = StyleVariant(style_id=style.id, color="Black", size="M", sku_code="COORD-BLK-M")
    session.add(variant)
    session.flush()
    bom = BOM(style_id=style.id)
    session.add(bom)
    session.flush()
    bom_version = BOMVersion(bom_id=bom.id, version_no=1)
    session.add(bom_version)
    session.flush()

    supplier = Supplier(name="Acme Fabrics", type="fabric")
    fabric_item = FabricItem(name="Cotton", consumption_uom=uom.code)
    session.add_all([supplier, fabric_item])
    session.flush()
    fabric_lot = FabricLot(
        fabric_item_id=fabric_item.id, supplier_id=supplier.id,
        received_qty=Decimal(100), cost_per_uom=Decimal(50),
    )
    session.add(fabric_lot)
    session.flush()

    order = ProductionOrder(style_id=style.id, bom_version_id=bom_version.id, status="open", source="stock_build")
    session.add(order)
    session.flush()

    cutting = CuttingRecord(
        production_order_id=order.id, fabric_lot_id=fabric_lot.id,
        planned_fabric_qty=Decimal(10), actual_fabric_qty=Decimal(12),
        cut_pieces_qty=Decimal(10), wastage_qty=Decimal(2),
    )
    session.add(cutting)

    batch = StitchingBatch(
        production_order_id=order.id, vendor_id=None, in_house=True,
        sent_qty=Decimal(10), received_qty=Decimal(8), rejected_qty=Decimal(2),
    )
    session.add(batch)
    session.flush()

    session.add(ReworkRecord(parent_stitching_batch_id=batch.id, qty=Decimal(1), outcome="scrapped"))
    session.flush()
    return order, style, batch


def test_fabric_variance_report(session):
    order, style, _ = _setup(session)
    rows = fabric_variance_report(session)
    assert len(rows) == 1
    row = rows[0]
    assert row["production_order_id"] == order.id
    assert row["style_id"] == style.id
    assert row["variance_qty"] == Decimal(2)
    assert row["wastage_qty"] == Decimal(2)


def test_wastage_rejection_report(session):
    order, style, batch = _setup(session)
    report = wastage_rejection_report(session)
    assert report["wastage_by_style"] == [{"style_id": style.id, "wastage_qty": Decimal(2)}]
    assert report["rejection_by_vendor"] == [{"vendor_id": None, "rejected_qty": Decimal(2)}]
    assert report["scrapped_by_style"] == [{"style_id": style.id, "scrapped_qty": Decimal(1)}]
