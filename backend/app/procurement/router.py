from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.procurement.models import POStatus, PurchaseOrder, PurchaseOrderLine, Supplier
from app.procurement.models import approve as approve_po

router = APIRouter(tags=["procurement"])


class SupplierIn(BaseModel):
    name: str
    type: str


class SupplierOut(SupplierIn):
    id: int


class POLineIn(BaseModel):
    component_type: str
    component_id: int
    ordered_qty: Decimal
    ordered_uom: str
    agreed_price: Decimal


class PurchaseOrderIn(BaseModel):
    supplier_id: int
    lines: list[POLineIn]


class PurchaseOrderOut(BaseModel):
    id: int
    supplier_id: int
    status: str


@router.post("/suppliers", response_model=SupplierOut)
def create_supplier(payload: SupplierIn, db: Session = Depends(get_db)):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    return supplier


@router.post("/purchase-orders", response_model=PurchaseOrderOut)
def create_purchase_order(payload: PurchaseOrderIn, db: Session = Depends(get_db)):
    po = PurchaseOrder(supplier_id=payload.supplier_id, status=POStatus.DRAFT.value)
    db.add(po)
    db.flush()
    for line in payload.lines:
        db.add(PurchaseOrderLine(po_id=po.id, **line.model_dump()))
    db.commit()
    return po


@router.patch("/purchase-orders/{po_id}/approve", response_model=PurchaseOrderOut)
def approve_purchase_order(po_id: int, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise HTTPException(404, "PurchaseOrder not found")
    try:
        approve_po(db, po)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return po


@router.get("/purchase-order-lines/{line_id}/outstanding")
def outstanding(line_id: int, db: Session = Depends(get_db)):
    from app.fabric_inventory.models import FabricLot

    line = db.get(PurchaseOrderLine, line_id)
    if line is None:
        raise HTTPException(404, "PurchaseOrderLine not found")
    received = (
        db.query(FabricLot).filter_by(po_line_id=line_id).all()
    )
    received_qty = sum((lot.received_qty for lot in received), Decimal(0))
    return {"line_id": line_id, "ordered_qty": line.ordered_qty, "outstanding_qty": line.ordered_qty - received_qty}
