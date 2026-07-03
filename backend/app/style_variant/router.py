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
    image_url: Optional[str] = None


class StyleOut(StyleIn):
    id: int


class StyleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    collection: Optional[str] = None
    image_url: Optional[str] = None


class VariantIn(BaseModel):
    color: str
    size: str
    sku_code: str
    qty: int = 0
    barcode: Optional[str] = None
    selling_price: Optional[Decimal] = None


class VariantUpdate(BaseModel):
    color: Optional[str] = None
    size: Optional[str] = None
    sku_code: Optional[str] = None
    qty: Optional[int] = None
    status: Optional[str] = None
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


@router.get("/styles", response_model=list[StyleOut])
def list_styles(db: Session = Depends(get_db)):
    return db.query(Style).all()


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


@router.patch("/variants/{variant_id}", response_model=VariantOut)
def update_variant(variant_id: int, payload: VariantUpdate, db: Session = Depends(get_db)):
    variant = db.get(StyleVariant, variant_id)
    if variant is None:
        raise HTTPException(404, "Variant not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(variant, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "sku_code already exists")
    return variant


class StyleWithVariants(StyleOut):
    variants: list[VariantOut]

    model_config = {"from_attributes": True}


@router.get("/styles-with-variants", response_model=list[StyleWithVariants])
def list_styles_with_variants(db: Session = Depends(get_db)):
    styles = db.query(Style).all()
    style_ids = [s.id for s in styles]
    variants = db.query(StyleVariant).filter(StyleVariant.style_id.in_(style_ids)).all()
    variants_by_style: dict[int, list] = {}
    for v in variants:
        variants_by_style.setdefault(v.style_id, []).append(VariantOut.model_validate(v, from_attributes=True))
    return [
        StyleWithVariants(
            **{c.key: getattr(s, c.key) for c in Style.__table__.columns},
            variants=variants_by_style.get(s.id, []),
        )
        for s in styles
    ]


@router.patch("/styles/{style_id}", response_model=StyleOut)
def update_style(style_id: int, payload: StyleUpdate, db: Session = Depends(get_db)):
    style = db.get(Style, style_id)
    if style is None:
        raise HTTPException(404, "Style not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(style, k, v)
    db.commit()
    return style
