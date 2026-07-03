from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_default_warehouse_id
from app.core.ledger_base import Direction
from app.db import get_db
from app.fabric_inventory.models import FabricItem, FabricLot, LandedCostEntry
from app.fabric_inventory.service import InsufficientStockError, adjust_fabric, fabric_balance, issue_fabric, receive_fabric

router = APIRouter(tags=["fabric_inventory"])


class FabricItemIn(BaseModel):
    name: str
    composition: Optional[str] = None
    gsm: Optional[int] = None
    width: Optional[Decimal] = None
    consumption_uom: str = "meter"
    image_url: Optional[str] = None


class FabricItemOut(FabricItemIn):
    id: int


class FabricItemUpdate(BaseModel):
    name: Optional[str] = None
    composition: Optional[str] = None
    gsm: Optional[int] = None
    width: Optional[Decimal] = None
    consumption_uom: Optional[str] = None
    image_url: Optional[str] = None


class GRNIn(BaseModel):
    fabric_item_id: int
    supplier_id: int
    po_line_id: int
    received_qty: Decimal
    purchase_uom: str
    cost_per_uom: Decimal
    dye_lot_no: Optional[str] = None
    created_by: str


class LotOut(BaseModel):
    id: int
    fabric_item_id: int
    received_qty: Decimal
    cost_per_uom: Decimal
    dye_lot_no: Optional[str] = None


class IssueIn(BaseModel):
    qty: Decimal
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_by: str


class AdjustIn(BaseModel):
    qty: Decimal
    direction: str  # "in" or "out"
    reason_code: str
    created_by: str


class LandedCostIn(BaseModel):
    expense_type: str
    amount: Decimal


@router.post("/fabric-items", response_model=FabricItemOut)
def create_fabric_item(payload: FabricItemIn, db: Session = Depends(get_db)):
    item = FabricItem(**payload.model_dump())
    db.add(item)
    db.commit()
    return item


@router.get("/fabric-items", response_model=list[FabricItemOut])
def list_fabric_items(db: Session = Depends(get_db)):
    return db.query(FabricItem).all()


@router.patch("/fabric-items/{item_id}", response_model=FabricItemOut)
def update_fabric_item(item_id: int, payload: FabricItemUpdate, db: Session = Depends(get_db)):
    item = db.get(FabricItem, item_id)
    if item is None:
        raise HTTPException(404, "FabricItem not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    return item


@router.get("/fabric-lots", response_model=list[LotOut])
def list_fabric_lots(db: Session = Depends(get_db)):
    return db.query(FabricLot).all()


class LotWithBalance(LotOut):
    balance: Decimal


@router.get("/fabric-lots-with-balance", response_model=list[LotWithBalance])
def list_fabric_lots_with_balance(db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    lots = db.query(FabricLot).all()
    return [
        LotWithBalance(
            **{c.key: getattr(l, c.key) for c in FabricLot.__table__.columns if hasattr(l, c.key)},
            balance=fabric_balance(db, l.id, warehouse_id),
        )
        for l in lots
    ]


@router.post("/fabric-lots", response_model=LotOut)
def grn(payload: GRNIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    item = db.get(FabricItem, payload.fabric_item_id)
    if item is None:
        raise HTTPException(404, "FabricItem not found")
    lot = receive_fabric(
        db,
        fabric_item_id=payload.fabric_item_id,
        supplier_id=payload.supplier_id,
        po_line_id=payload.po_line_id,
        received_qty=payload.received_qty,
        purchase_uom=payload.purchase_uom,
        consumption_uom=item.consumption_uom,
        cost_per_uom=payload.cost_per_uom,
        warehouse_id=warehouse_id,
        created_by=payload.created_by,
        dye_lot_no=payload.dye_lot_no,
    )
    return lot


@router.get("/fabric-lots/{lot_id}/balance")
def get_balance(lot_id: int, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    if db.get(FabricLot, lot_id) is None:
        raise HTTPException(404, "FabricLot not found")
    return {"fabric_lot_id": lot_id, "balance": fabric_balance(db, lot_id, warehouse_id)}


@router.post("/fabric-lots/{lot_id}/issue")
def issue(lot_id: int, payload: IssueIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    try:
        entry = issue_fabric(
            db, fabric_lot_id=lot_id, qty=payload.qty, warehouse_id=warehouse_id,
            reference_type=payload.reference_type, reference_id=payload.reference_id,
            created_by=payload.created_by,
        )
    except InsufficientStockError as exc:
        raise HTTPException(409, str(exc))
    return {"id": entry.id, "quantity": entry.quantity, "direction": entry.direction}


@router.post("/fabric-lots/{lot_id}/adjust")
def adjust(lot_id: int, payload: AdjustIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    if payload.direction not in (Direction.IN.value, Direction.OUT.value):
        raise HTTPException(400, "direction must be 'in' or 'out'")
    entry = adjust_fabric(
        db, fabric_lot_id=lot_id, qty=payload.qty, direction=Direction(payload.direction),
        reason_code=payload.reason_code, warehouse_id=warehouse_id, created_by=payload.created_by,
    )
    return {"id": entry.id, "quantity": entry.quantity, "direction": entry.direction}


@router.post("/fabric-lots/{lot_id}/landed-costs")
def add_landed_cost(lot_id: int, payload: LandedCostIn, db: Session = Depends(get_db)):
    if db.get(FabricLot, lot_id) is None:
        raise HTTPException(404, "FabricLot not found")
    entry = LandedCostEntry(fabric_lot_id=lot_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    return {"id": entry.id, "fabric_lot_id": lot_id, "amount": entry.amount}
