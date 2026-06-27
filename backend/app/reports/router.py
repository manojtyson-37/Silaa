from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.reports.service import fabric_variance_report, wastage_rejection_report

router = APIRouter(tags=["reports"])


class FabricVarianceOut(BaseModel):
    cutting_record_id: int
    production_order_id: int
    style_id: int
    fabric_lot_id: int
    planned_fabric_qty: Decimal
    actual_fabric_qty: Decimal
    variance_qty: Decimal
    wastage_qty: Decimal


class WastageByStyleOut(BaseModel):
    style_id: int
    wastage_qty: Decimal


class RejectionByVendorOut(BaseModel):
    vendor_id: Optional[int]
    rejected_qty: Decimal


class ScrappedByStyleOut(BaseModel):
    style_id: int
    scrapped_qty: Decimal


class WastageRejectionOut(BaseModel):
    wastage_by_style: list[WastageByStyleOut]
    rejection_by_vendor: list[RejectionByVendorOut]
    scrapped_by_style: list[ScrappedByStyleOut]


@router.get("/reports/fabric-variance", response_model=list[FabricVarianceOut])
def get_fabric_variance_report(db: Session = Depends(get_db)):
    return fabric_variance_report(db)


@router.get("/reports/wastage", response_model=WastageRejectionOut)
def get_wastage_report(db: Session = Depends(get_db)):
    return wastage_rejection_report(db)
