"""End-to-end smoke test through real HTTP routes, not direct service calls —
exercises GRN -> production -> QC pass -> FG ledger across module boundaries."""
import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base


def make_client(tmp_path):
    db_path = tmp_path / "smoke.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    # app.db reads DATABASE_URL at import time, so rebuild the engine for this test's path
    import app.db as db_module

    db_module.engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    db_module.SessionLocal = sessionmaker(bind=db_module.engine, autoflush=False, autocommit=False)

    from app.main import app

    Base.metadata.create_all(db_module.engine)
    return TestClient(app)


def test_full_flow_via_http(tmp_path):
    client = make_client(tmp_path)

    uom_meter = client.post("/uom", json={"code": "meter", "name": "Meter", "category": "length"}).json()
    client.post("/uom-conversions", json={"from_uom_id": uom_meter["id"], "to_uom_id": uom_meter["id"], "factor": "1"})

    supplier = client.post("/suppliers", json={"name": "Acme", "type": "fabric"}).json()
    item = client.post("/fabric-items", json={"name": "Cotton", "consumption_uom": "meter"}).json()
    po = client.post("/purchase-orders", json={
        "supplier_id": supplier["id"],
        "lines": [{"component_type": "fabric", "component_id": item["id"], "ordered_qty": "100", "ordered_uom": "meter", "agreed_price": "50"}],
    }).json()
    client.patch(f"/purchase-orders/{po['id']}/approve")

    import app.db as db_module
    from app.procurement.models import PurchaseOrderLine
    s = db_module.SessionLocal()
    line = s.query(PurchaseOrderLine).filter_by(po_id=po["id"]).first()
    line_id = line.id
    s.close()

    lot = client.post("/fabric-lots", json={
        "fabric_item_id": item["id"], "supplier_id": supplier["id"], "po_line_id": line_id,
        "received_qty": "50", "purchase_uom": "meter", "cost_per_uom": "50", "created_by": "t",
    }).json()
    assert client.get(f"/fabric-lots/{lot['id']}/balance").json()["balance"] == 50.0

    style = client.post("/styles", json={"name": "Co-ord Set", "category": "set"}).json()
    variant = client.post(f"/styles/{style['id']}/variants", json={
        "color": "Black", "size": "M", "sku_code": "COORD-BLK-M",
    }).json()

    version = client.post(f"/styles/{style['id']}/bom-versions", json=[
        {"component_type": "fabric", "component_id": item["id"], "qty_per_unit": "2", "uom": "meter"}
    ]).json()
    client.patch(f"/bom-versions/{version['id']}/activate")

    order = client.post("/production-orders", json={
        "style_id": style["id"], "variants": [{"variant_id": variant["id"], "planned_qty": "10"}],
        "source": "stock_build", "created_by": "t",
    }).json()

    client.post(f"/production-orders/{order['id']}/cutting-records", json={
        "fabric_lot_id": lot["id"], "planned_fabric_qty": "20", "actual_fabric_qty": "20",
        "cut_pieces_qty": "10", "wastage_qty": "0", "created_by": "t",
    })
    assert client.get(f"/fabric-lots/{lot['id']}/balance").json()["balance"] == 30.0

    batch = client.post(f"/production-orders/{order['id']}/stitching-batches", json={
        "sent_qty": "10", "in_house": True, "created_by": "t",
    }).json()
    client.post(f"/stitching-batches/{batch['id']}/receive", json={
        "received_qty": "10", "rejected_qty": "0", "created_by": "t",
    })
    qc = client.post(f"/stitching-batches/{batch['id']}/qc", json={
        "qc_state": "PASS", "qty": "10", "variant_id": variant["id"], "created_by": "t",
    })
    assert qc.status_code == 200

    fg = client.get(f"/inventory/finished-goods/{variant['id']}/balance").json()
    assert fg["balance"] == 10.0

    events = client.get(f"/production-orders/{order['id']}/events").json()
    assert [e["event_type"] for e in events] == [
        "order_created", "cutting_recorded", "stitching_sent", "stitching_received", "qc_applied",
    ]
