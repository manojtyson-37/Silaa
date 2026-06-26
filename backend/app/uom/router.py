from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.uom.models import UOMConversion, UnitOfMeasure

router = APIRouter(tags=["uom"])


class UOMIn(BaseModel):
    code: str
    name: str
    category: str


class UOMOut(UOMIn):
    id: int


class ConversionIn(BaseModel):
    from_uom_id: int
    to_uom_id: int
    factor: Decimal


class ConversionOut(ConversionIn):
    id: int


@router.post("/uom", response_model=UOMOut)
def create_uom(payload: UOMIn, db: Session = Depends(get_db)):
    uom = UnitOfMeasure(**payload.model_dump())
    db.add(uom)
    db.commit()
    return uom


@router.post("/uom-conversions", response_model=ConversionOut)
def create_conversion(payload: ConversionIn, db: Session = Depends(get_db)):
    conv = UOMConversion(**payload.model_dump())
    db.add(conv)
    db.commit()
    return conv
