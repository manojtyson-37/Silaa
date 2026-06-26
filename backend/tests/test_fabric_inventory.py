import os
import tempfile
import threading
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import main as _import_all_models  # noqa: F401
from app import wiring
from app.db import Base
from app.fabric_inventory.models import FabricItem, FabricLot
from app.fabric_inventory.service import (
    InsufficientStockError,
    fabric_balance,
    issue_fabric,
    receive_fabric,
)
from app.procurement.models import PurchaseOrder, PurchaseOrderLine, Supplier
from app.uom.models import UOMConversion, UnitOfMeasure


def _seed_basics(session):
    meter = UnitOfMeasure(code="meter", name="Meter", category="length")
    session.add(meter)
    session.flush()
    session.add(UOMConversion(from_uom_id=meter.id, to_uom_id=meter.id, factor=Decimal(1)))

    supplier = Supplier(name="Acme Fabrics", type="fabric")
    item = FabricItem(name="Cotton Twill", consumption_uom="meter")
    session.add_all([supplier, item])
    session.flush()

    po = PurchaseOrder(supplier_id=supplier.id, status="approved")
    session.add(po)
    session.flush()
    line = PurchaseOrderLine(
        po_id=po.id, component_type="fabric", component_id=item.id,
        ordered_qty=Decimal(500), ordered_uom="meter", agreed_price=Decimal(100),
    )
    session.add(line)
    session.commit()
    return supplier, item, line


def test_grn_creates_lot_and_ledger_entry_atomically(session, warehouse_id):
    supplier, item, line = _seed_basics(session)

    lot = receive_fabric(
        session,
        fabric_item_id=item.id,
        supplier_id=supplier.id,
        po_line_id=line.id,
        received_qty=Decimal(100),
        purchase_uom="meter",
        consumption_uom="meter",
        cost_per_uom=Decimal(100),
        warehouse_id=warehouse_id,
        created_by="tester",
    )
    assert fabric_balance(session, lot.id, warehouse_id) == Decimal(100)


def test_issue_rejected_when_insufficient_balance(session, warehouse_id):
    supplier, item, line = _seed_basics(session)
    lot = receive_fabric(
        session, fabric_item_id=item.id, supplier_id=supplier.id, po_line_id=line.id,
        received_qty=Decimal(10), purchase_uom="meter", consumption_uom="meter",
        cost_per_uom=Decimal(100), warehouse_id=warehouse_id, created_by="t",
    )
    with pytest.raises(InsufficientStockError):
        issue_fabric(
            session, fabric_lot_id=lot.id, qty=Decimal(50), warehouse_id=warehouse_id,
            reference_type=None, reference_id=None, created_by="t",
        )
    assert fabric_balance(session, lot.id, warehouse_id) == Decimal(10)


def test_landed_cost_does_not_affect_cost_per_uom(session, warehouse_id):
    from app.fabric_inventory.models import LandedCostEntry

    supplier, item, line = _seed_basics(session)
    lot = receive_fabric(
        session, fabric_item_id=item.id, supplier_id=supplier.id, po_line_id=line.id,
        received_qty=Decimal(10), purchase_uom="meter", consumption_uom="meter",
        cost_per_uom=Decimal(100), warehouse_id=warehouse_id, created_by="t",
    )
    before = lot.cost_per_uom
    session.add(LandedCostEntry(fabric_lot_id=lot.id, expense_type="freight", amount=Decimal(500)))
    session.commit()
    session.refresh(lot)
    assert lot.cost_per_uom == before


def test_concurrent_issue_against_same_lot_only_one_succeeds(warehouse_id_for_file_db_factory=None):
    """Two threads issue against the same lot; combined qty exceeds balance.
    Exactly one must succeed. Uses a file-backed SQLite DB so both threads
    share real state (in-memory SQLite is per-connection)."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_path = tmp.name
    try:
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        SessionLocal = sessionmaker(bind=engine)

        setup_session = SessionLocal()
        wiring.configure()
        from app.core.warehouse import seed_default_warehouse

        wh = seed_default_warehouse(setup_session)
        supplier, item, line = _seed_basics(setup_session)
        lot = receive_fabric(
            setup_session, fabric_item_id=item.id, supplier_id=supplier.id, po_line_id=line.id,
            received_qty=Decimal(10), purchase_uom="meter", consumption_uom="meter",
            cost_per_uom=Decimal(100), warehouse_id=wh.id, created_by="t",
        )
        lot_id, wh_id = lot.id, wh.id
        setup_session.close()

        results = []

        def attempt():
            s = SessionLocal()
            try:
                issue_fabric(
                    s, fabric_lot_id=lot_id, qty=Decimal(8), warehouse_id=wh_id,
                    reference_type=None, reference_id=None, created_by="t",
                )
                results.append("success")
            except InsufficientStockError:
                results.append("rejected")
            except Exception as exc:  # SQLite may raise OperationalError on lock contention
                results.append(f"error:{exc}")
            finally:
                s.close()

        t1 = threading.Thread(target=attempt)
        t2 = threading.Thread(target=attempt)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        assert results.count("success") == 1
        verify_session = SessionLocal()
        assert fabric_balance(verify_session, lot_id, wh_id) == Decimal(2)
        verify_session.close()
    finally:
        os.unlink(db_path)
