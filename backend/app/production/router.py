from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_default_warehouse_id
from app.db import get_db
from app.finished_goods.service import write_production_complete
from app.production.models import CuttingRecord, ProductionEvent, ProductionOrder, ProductionOrderVariant, QCState, StitchingBatch
from app.production.service import (
    apply_qc,
    apply_rework,
    create_production_order,
    create_stitching_batch,
    receive_stitching,
    record_cutting,
)

router = APIRouter(tags=["production"])


class VariantBreakdownIn(BaseModel):
    variant_id: int
    planned_qty: Decimal


class ProductionOrderIn(BaseModel):
    style_id: int
    variants: list[VariantBreakdownIn]
    source: str
    created_by: str


class ProductionOrderOut(BaseModel):
    id: int
    style_id: int
    bom_version_id: int
    status: str
    source: str


class CuttingIn(BaseModel):
    fabric_lot_id: int
    planned_fabric_qty: Decimal
    actual_fabric_qty: Decimal
    cut_pieces_qty: Decimal
    wastage_qty: Decimal = Decimal(0)
    created_by: str


class StitchingBatchIn(BaseModel):
    sent_qty: Decimal
    vendor_id: Optional[int] = None
    in_house: bool = False
    labor_cost: Decimal = Decimal("0")
    created_by: str


class ReceiveStitchingIn(BaseModel):
    received_qty: Decimal
    rejected_qty: Decimal
    created_by: str


class QCIn(BaseModel):
    qc_state: QCState
    qty: Decimal
    variant_id: int
    created_by: str


class ReworkIn(BaseModel):
    qty: Decimal
    outcome: str
    reason_code: Optional[str] = None
    created_by: str


@router.post("/production-orders", response_model=ProductionOrderOut)
def create_order(payload: ProductionOrderIn, db: Session = Depends(get_db)):
    try:
        order = create_production_order(
            db, style_id=payload.style_id,
            variants=[v.model_dump() for v in payload.variants],
            source=payload.source, created_by=payload.created_by,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return order


@router.get("/production-orders", response_model=list[ProductionOrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(ProductionOrder).all()


@router.get("/production-orders/{order_id}", response_model=ProductionOrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(ProductionOrder, order_id)
    if order is None:
        raise HTTPException(404, "ProductionOrder not found")
    return order


@router.get("/production-orders/{order_id}/variants")
def list_order_variants(order_id: int, db: Session = Depends(get_db)):
    rows = db.query(ProductionOrderVariant).filter_by(production_order_id=order_id).all()
    return [{"variant_id": r.variant_id, "planned_qty": r.planned_qty} for r in rows]


@router.get("/production-orders/{order_id}/events")
def get_events(order_id: int, db: Session = Depends(get_db)):
    events = (
        db.query(ProductionEvent)
        .filter_by(production_order_id=order_id)
        .order_by(ProductionEvent.id)
        .all()
    )
    return [
        {"event_type": e.event_type, "payload": e.payload_json, "created_at": e.created_at, "created_by": e.created_by}
        for e in events
    ]


@router.get("/production-orders/{order_id}/cutting-records")
def list_cutting_records(order_id: int, db: Session = Depends(get_db)):
    records = db.query(CuttingRecord).filter_by(production_order_id=order_id).all()
    return [
        {"id": r.id, "fabric_lot_id": r.fabric_lot_id, "actual_fabric_qty": r.actual_fabric_qty,
         "cut_pieces_qty": r.cut_pieces_qty, "wastage_qty": r.wastage_qty}
        for r in records
    ]


@router.post("/production-orders/{order_id}/cutting-records")
def cutting(order_id: int, payload: CuttingIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    if db.get(ProductionOrder, order_id) is None:
        raise HTTPException(404, "ProductionOrder not found")
    record = record_cutting(db, production_order_id=order_id, warehouse_id=warehouse_id, **payload.model_dump())
    return {"id": record.id, "actual_fabric_qty": record.actual_fabric_qty}


@router.get("/production-orders/{order_id}/stitching-batches")
def list_batches(order_id: int, db: Session = Depends(get_db)):
    batches = db.query(StitchingBatch).filter_by(production_order_id=order_id).all()
    return [
        {"id": b.id, "vendor_id": b.vendor_id, "in_house": b.in_house, "sent_qty": b.sent_qty,
         "received_qty": b.received_qty, "rejected_qty": b.rejected_qty, "qc_state": b.qc_state}
        for b in batches
    ]


@router.post("/production-orders/{order_id}/stitching-batches")
def create_batch(
    order_id: int, payload: StitchingBatchIn, db: Session = Depends(get_db),
    warehouse_id: int = Depends(get_default_warehouse_id),
):
    if db.get(ProductionOrder, order_id) is None:
        raise HTTPException(404, "ProductionOrder not found")
    batch = create_stitching_batch(db, production_order_id=order_id, warehouse_id=warehouse_id, **payload.model_dump())
    return {"id": batch.id, "sent_qty": batch.sent_qty}


@router.get("/production-orders/{order_id}/cost-breakdown")
def cost_breakdown(order_id: int, db: Session = Depends(get_db)):
    from app.finished_goods.models import FinishedGoodsLedgerEntry
    from app.finished_goods.service import production_cost_breakdown

    if db.get(ProductionOrder, order_id) is None:
        raise HTTPException(404, "ProductionOrder not found")
    breakdown = production_cost_breakdown(db, order_id)
    qty_passed = (
        db.query(FinishedGoodsLedgerEntry)
        .filter_by(reference_type="production_order", reference_id=order_id, txn_type="production_complete")
        .with_entities(FinishedGoodsLedgerEntry.quantity)
        .all()
    )
    total_qty_passed = sum((row[0] for row in qty_passed), Decimal("0"))
    unit_cost = (breakdown["total_cost"] / total_qty_passed) if total_qty_passed else None
    return {**breakdown, "qty_passed": total_qty_passed, "unit_cost": unit_cost}


@router.post("/stitching-batches/{batch_id}/receive")
def receive(batch_id: int, payload: ReceiveStitchingIn, db: Session = Depends(get_db)):
    batch = db.get(StitchingBatch, batch_id)
    if batch is None:
        raise HTTPException(404, "StitchingBatch not found")
    receive_stitching(db, batch=batch, **payload.model_dump())
    return {"id": batch.id, "received_qty": batch.received_qty, "rejected_qty": batch.rejected_qty}


@router.post("/stitching-batches/{batch_id}/qc")
def qc(batch_id: int, payload: QCIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    batch = db.get(StitchingBatch, batch_id)
    if batch is None:
        raise HTTPException(404, "StitchingBatch not found")
    apply_qc(
        db, batch=batch, qc_state=payload.qc_state, qty=payload.qty,
        variant_id=payload.variant_id, warehouse_id=warehouse_id,
        created_by=payload.created_by, fg_writer=write_production_complete,
    )
    return {"id": batch.id, "qc_state": batch.qc_state}


@router.post("/stitching-batches/{batch_id}/rework")
def rework(batch_id: int, payload: ReworkIn, db: Session = Depends(get_db)):
    batch = db.get(StitchingBatch, batch_id)
    if batch is None:
        raise HTTPException(404, "StitchingBatch not found")
    record = apply_rework(db, batch=batch, **payload.model_dump())
    return {"id": record.id, "outcome": record.outcome}
