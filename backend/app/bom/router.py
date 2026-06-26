from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.bom.models import BOM, BOMVersion, activate_version, create_bom_version
from app.db import get_db
from app.style_variant.models import Style

router = APIRouter(tags=["bom"])


class BOMItemIn(BaseModel):
    component_type: str
    component_id: int
    qty_per_unit: Decimal
    uom: str
    variant_id: Optional[int] = None


class BOMVersionOut(BaseModel):
    id: int
    bom_id: int
    version_no: int


def _get_or_create_bom(db: Session, style_id: int) -> BOM:
    bom = db.query(BOM).filter_by(style_id=style_id).first()
    if bom is None:
        bom = BOM(style_id=style_id)
        db.add(bom)
        db.flush()
        db.commit()
    return bom


@router.post("/styles/{style_id}/bom-versions", response_model=BOMVersionOut)
def create_version(style_id: int, items: list[BOMItemIn], db: Session = Depends(get_db)):
    if db.get(Style, style_id) is None:
        raise HTTPException(404, "Style not found")
    bom = _get_or_create_bom(db, style_id)
    version = create_bom_version(db, bom, [item.model_dump() for item in items])
    return version


@router.patch("/bom-versions/{version_id}/activate")
def activate(version_id: int, db: Session = Depends(get_db)):
    version = db.get(BOMVersion, version_id)
    if version is None:
        raise HTTPException(404, "BOMVersion not found")
    bom = db.get(BOM, version.bom_id)
    activate_version(db, bom, version)
    return {"bom_id": bom.id, "active_version_id": bom.active_version_id}
