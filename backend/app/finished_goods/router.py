from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_default_warehouse_id
from app.core.ledger_base import Direction
from app.db import get_db
from app.finished_goods.models import FG_TXN_TYPES
from app.finished_goods.service import fg_balance, record_movement

router = APIRouter(tags=["finished_goods"])


class MovementIn(BaseModel):
    variant_id: int
    qty: Decimal
    direction: str  # "in" or "out"
    txn_type: str
    reason_code: Optional[str] = None
    created_by: str


@router.post("/finished-goods-ledger-entries")
def create_movement(payload: MovementIn, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    if payload.txn_type == "production_complete":
        raise HTTPException(400, "production_complete entries are system-written only, via QC pass")
    if payload.txn_type not in FG_TXN_TYPES:
        raise HTTPException(400, f"Unknown txn_type {payload.txn_type!r}")
    if payload.direction not in (Direction.IN.value, Direction.OUT.value):
        raise HTTPException(400, "direction must be 'in' or 'out'")

    entry = record_movement(
        db, variant_id=payload.variant_id, qty=payload.qty, direction=Direction(payload.direction),
        txn_type=payload.txn_type, warehouse_id=warehouse_id, reason_code=payload.reason_code,
        created_by=payload.created_by,
    )
    return {"id": entry.id, "txn_type": entry.txn_type, "quantity": entry.quantity}


@router.get("/inventory/finished-goods/{variant_id}/balance")
def get_balance(variant_id: int, db: Session = Depends(get_db), warehouse_id: int = Depends(get_default_warehouse_id)):
    return {"variant_id": variant_id, "balance": fg_balance(db, variant_id, warehouse_id)}
