from decimal import Decimal
from typing import Optional

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


class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None


@router.post("/suppliers", response_model=SupplierOut)
def create_supplier(payload: SupplierIn, db: Session = Depends(get_db)):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    return supplier


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()


@router.post("/purchase-orders", response_model=PurchaseOrderOut)
def create_purchase_order(payload: PurchaseOrderIn, db: Session = Depends(get_db)):
    po = PurchaseOrder(supplier_id=payload.supplier_id, status=POStatus.DRAFT.value)
    db.add(po)
    db.flush()
    for line in payload.lines:
        db.add(PurchaseOrderLine(po_id=po.id, **line.model_dump()))
    db.commit()
    return po


@router.get("/purchase-orders", response_model=list[PurchaseOrderOut])
def list_purchase_orders(db: Session = Depends(get_db)):
    return db.query(PurchaseOrder).all()


@router.get("/purchase-orders/{po_id}")
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise HTTPException(404, "PurchaseOrder not found")
    lines = db.query(PurchaseOrderLine).filter_by(po_id=po_id).all()
    return {
        "id": po.id,
        "supplier_id": po.supplier_id,
        "status": po.status,
        "lines": [
            {
                "id": l.id,
                "component_type": l.component_type,
                "component_id": l.component_id,
                "ordered_qty": l.ordered_qty,
                "ordered_uom": l.ordered_uom,
                "agreed_price": l.agreed_price,
            }
            for l in lines
        ],
    }


@router.patch("/purchase-orders/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(po_id: int, payload: PurchaseOrderUpdate, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise HTTPException(404, "PurchaseOrder not found")
    if po.status != POStatus.DRAFT.value:
        raise HTTPException(400, "Can only update PO in DRAFT status")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(po, k, v)
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
