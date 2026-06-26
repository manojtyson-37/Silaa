from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.style_variant.models import Style, StyleVariant

router = APIRouter(tags=["style_variant"])


class StyleIn(BaseModel):
    name: str
    category: Optional[str] = None
    collection: Optional[str] = None


class StyleOut(StyleIn):
    id: int


class VariantIn(BaseModel):
    color: str
    size: str
    sku_code: str
    barcode: Optional[str] = None
    selling_price: Optional[Decimal] = None


class VariantOut(VariantIn):
    id: int
    style_id: int
    status: str


@router.post("/styles", response_model=StyleOut)
def create_style(payload: StyleIn, db: Session = Depends(get_db)):
    style = Style(**payload.model_dump())
    db.add(style)
    db.commit()
    return style


@router.post("/styles/{style_id}/variants", response_model=VariantOut)
def create_variant(style_id: int, payload: VariantIn, db: Session = Depends(get_db)):
    if db.get(Style, style_id) is None:
        raise HTTPException(404, "Style not found")
    variant = StyleVariant(style_id=style_id, **payload.model_dump())
    db.add(variant)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"sku_code {payload.sku_code!r} already exists")
    return variant


@router.get("/styles/{style_id}/variants", response_model=list[VariantOut])
def list_variants(style_id: int, db: Session = Depends(get_db)):
    return db.query(StyleVariant).filter_by(style_id=style_id).all()
