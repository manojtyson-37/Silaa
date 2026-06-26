from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accessory_inventory.models import AccessoryItem
from app.accessory_inventory.service import InsufficientStockError, accessory_balance, issue_accessory, receive_accessory
from app.core.deps import get_default_warehouse_id
from app.db import get_db

router = APIRouter(tags=["accessory_inventory"])


class AccessoryItemIn(BaseModel):
    name: str
    type: str
    consumption_uom: str = "piece"
    default_cost: Optional[Decimal] = None


class AccessoryItemOut(AccessoryItemIn):
    id: int


class GRNIn(BaseModel):
    supplier_id: int
    po_line_id: int
    received_qty: Decimal
    purchase_uom: str
    created_by: str


class IssueIn(BaseModel):
    qty: Decimal
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_by: str


@router.post("/accessory-items", response_model=AccessoryItemOut)
def create_accessory_item(payload: AccessoryItemIn, db: Session = Depends(get_db)):
    item = AccessoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    return item


@router.post("/accessory-items/{item_id}/receive")
def grn(item_id: int, payload: GRNIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    if db.get(AccessoryItem, item_id) is None:
        raise HTTPException(404, "AccessoryItem not found")
    entry = receive_accessory(db, accessory_item_id=item_id, warehouse_id=warehouse_id, **payload.model_dump())
    return {"id": entry.id, "quantity": entry.quantity}


@router.get("/accessory-items/{item_id}/balance")
def get_balance(item_id: int, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    if db.get(AccessoryItem, item_id) is None:
        raise HTTPException(404, "AccessoryItem not found")
    return {"accessory_item_id": item_id, "balance": accessory_balance(db, item_id, warehouse_id)}


@router.post("/accessory-items/{item_id}/issue")
def issue(item_id: int, payload: IssueIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    try:
        entry = issue_accessory(db, accessory_item_id=item_id, warehouse_id=warehouse_id, **payload.model_dump())
    except InsufficientStockError as exc:
        raise HTTPException(409, str(exc))
    return {"id": entry.id, "quantity": entry.quantity}
