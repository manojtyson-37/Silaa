"""Dev/demo seed — run with `python -m app.seed`.

Same script feeds local frontend dev and CI fixtures (per
FINAL_READINESS_REVIEW.md §6) — one source, two consumers, so frontend never
waits on "real" data and QA never waits on full implementation.
"""
from decimal import Decimal

from app.accessory_inventory.models import AccessoryItem
from app.accessory_inventory.service import receive_accessory
from app.bom.models import BOM, activate_version, create_bom_version
from app.core.warehouse import seed_default_warehouse
from app.db import Base, SessionLocal, engine
from app.fabric_inventory.models import FabricItem
from app.fabric_inventory.service import receive_fabric
from app.procurement.models import PurchaseOrder, PurchaseOrderLine, Supplier
from app.production.service import create_production_order
from app.style_variant.models import Style, StyleVariant
from app.uom.models import UOMConversion, UnitOfMeasure
from app.uom.service import convert  # noqa: F401  sanity import
from app.wiring import configure as configure_wiring


def run():
    Base.metadata.create_all(engine)
    session = SessionLocal()
    configure_wiring()

    wh = seed_default_warehouse(session)

    meter = UnitOfMeasure(code="meter", name="Meter", category="length")
    roll = UnitOfMeasure(code="roll", name="Roll", category="length")
    piece = UnitOfMeasure(code="piece", name="Piece", category="count")
    dozen = UnitOfMeasure(code="dozen", name="Dozen", category="count")
    session.add_all([meter, roll, piece, dozen])
    session.flush()
    session.add_all([
        UOMConversion(from_uom_id=meter.id, to_uom_id=meter.id, factor=Decimal(1)),
        UOMConversion(from_uom_id=roll.id, to_uom_id=meter.id, factor=Decimal(50)),
        UOMConversion(from_uom_id=piece.id, to_uom_id=piece.id, factor=Decimal(1)),
        UOMConversion(from_uom_id=dozen.id, to_uom_id=piece.id, factor=Decimal(12)),
    ])

    fabric_supplier = Supplier(name="Acme Fabrics", type="fabric")
    accessory_supplier = Supplier(name="Bright Buttons Co", type="accessory")
    session.add_all([fabric_supplier, accessory_supplier])
    session.flush()

    cotton = FabricItem(name="Cotton Twill", composition="100% cotton", gsm=180, consumption_uom="meter")
    button = AccessoryItem(name="Shell Button 18L", type="button", consumption_uom="piece")
    session.add_all([cotton, button])
    session.flush()

    po1 = PurchaseOrder(supplier_id=fabric_supplier.id, status="approved")
    session.add(po1)
    session.flush()
    line1 = PurchaseOrderLine(
        po_id=po1.id, component_type="fabric", component_id=cotton.id,
        ordered_qty=Decimal(10), ordered_uom="roll", agreed_price=Decimal(2500),
    )
    session.add(line1)
    session.commit()

    # partial receipt: ordered 10 rolls, received 6 -- exercises §2's outstanding-qty logic
    lot = receive_fabric(
        session, fabric_item_id=cotton.id, supplier_id=fabric_supplier.id, po_line_id=line1.id,
        received_qty=Decimal(6), purchase_uom="roll", consumption_uom="meter",
        cost_per_uom=Decimal(50), warehouse_id=wh.id, created_by="seed",
    )

    receive_accessory(
        session, accessory_item_id=button.id, supplier_id=accessory_supplier.id, po_line_id=line1.id,
        received_qty=Decimal(20), purchase_uom="dozen", warehouse_id=wh.id, created_by="seed",
    )

    style = Style(name="Women's Co-ord Set", category="set", collection="Summer 26")
    session.add(style)
    session.flush()
    variants = [
        StyleVariant(style_id=style.id, color=color, size=size, sku_code=f"COORD-{color[:3].upper()}-{size}")
        for color in ("Black", "White")
        for size in ("S", "M", "L")
    ]
    session.add_all(variants)
    session.commit()

    bom = BOM(style_id=style.id)
    session.add(bom)
    session.flush()
    version = create_bom_version(session, bom, [
        {"component_type": "fabric", "component_id": cotton.id, "qty_per_unit": Decimal(2), "uom": "meter"},
        {"component_type": "accessory", "component_id": button.id, "qty_per_unit": Decimal(4), "uom": "piece"},
    ])
    activate_version(session, bom, version)

    # one in-progress order, sitting mid-stitching -- exercises status displays without a live workflow run
    order = create_production_order(
        session, style_id=style.id,
        variants=[{"variant_id": variants[0].id, "planned_qty": Decimal(20)}],
        source="stock_build", created_by="seed",
    )

    print(f"Seeded: warehouse={wh.id}, fabric_lot={lot.id}, style={style.id}, "
          f"{len(variants)} variants, production_order={order.id} (mid-cutting, no cutting recorded yet)")
    session.close()


if __name__ == "__main__":
    run()
