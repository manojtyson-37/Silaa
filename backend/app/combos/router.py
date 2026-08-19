import os
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.combos.models import StyleVariantCombo, StyleVariantComboItem
from app.db import get_db
from app.orders.models import SalesOrder, SalesOrderLine, SalesOrderStatus
from app.style_variant.models import StyleVariant

router = APIRouter(tags=["combos"])
public_router = APIRouter(tags=["combos"])

_WEBSITE_KEY = os.environ.get("WEBSITE_ORDER_KEY", "")


# ── Schemas ────────────────────────────────────────────────────────────────────

class ComboItemIn(BaseModel):
    variant_id: int
    qty: int = 1


class ComboIn(BaseModel):
    name: str
    description: Optional[str] = None
    selling_price: Decimal
    image_url: Optional[str] = None
    is_active: bool = True
    items: list[ComboItemIn]


class ComboItemOut(BaseModel):
    id: int
    variant_id: int
    qty: int
    variant_color: Optional[str] = None
    variant_size: Optional[str] = None
    variant_sku: Optional[str] = None

    model_config = {"from_attributes": True}


class ComboOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    selling_price: Decimal
    image_url: Optional[str]
    is_active: bool
    items: list[ComboItemOut] = []

    model_config = {"from_attributes": True}


class WebsiteOrderItem(BaseModel):
    combo_id: Optional[int] = None
    variant_id: Optional[int] = None
    qty: int = 1
    unit_price: Optional[Decimal] = None  # overrides combo selling_price if provided


class WebsiteOrderIn(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_state: Optional[str] = None
    items: list[WebsiteOrderItem]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _combo_with_variants(combo: StyleVariantCombo, db: Session) -> ComboOut:
    items = db.query(StyleVariantComboItem).filter_by(combo_id=combo.id).all()
    item_outs = []
    for item in items:
        v = db.get(StyleVariant, item.variant_id)
        item_outs.append(ComboItemOut(
            id=item.id,
            variant_id=item.variant_id,
            qty=item.qty,
            variant_color=v.color if v else None,
            variant_size=v.size if v else None,
            variant_sku=v.sku_code if v else None,
        ))
    out = ComboOut.model_validate(combo)
    out.items = item_outs
    return out


def _verify_website_key(x_website_key: str = Header(default="")):
    if not _WEBSITE_KEY:
        raise HTTPException(500, "WEBSITE_ORDER_KEY not configured on server")
    if x_website_key != _WEBSITE_KEY:
        raise HTTPException(403, "Invalid website API key")


# ── Admin CRUD (protected by main.py _protected dependency) ────────────────────

@router.post("/combos", response_model=ComboOut)
def create_combo(payload: ComboIn, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(400, "Combo must have at least one item")
    combo = StyleVariantCombo(
        name=payload.name,
        description=payload.description,
        selling_price=payload.selling_price,
        image_url=payload.image_url,
        is_active=payload.is_active,
    )
    db.add(combo)
    db.flush()
    for item in payload.items:
        if not db.get(StyleVariant, item.variant_id):
            raise HTTPException(404, f"StyleVariant {item.variant_id} not found")
        db.add(StyleVariantComboItem(combo_id=combo.id, variant_id=item.variant_id, qty=item.qty))
    db.commit()
    return _combo_with_variants(combo, db)


@router.get("/combos", response_model=list[ComboOut])
def list_combos(db: Session = Depends(get_db)):
    combos = db.query(StyleVariantCombo).order_by(StyleVariantCombo.id.desc()).all()
    return [_combo_with_variants(c, db) for c in combos]


@public_router.get("/combos/public", response_model=list[ComboOut])
def list_combos_public(db: Session = Depends(get_db)):
    """Unauthenticated — for the customer website to read available combos."""
    combos = db.query(StyleVariantCombo).filter_by(is_active=True).order_by(StyleVariantCombo.id).all()
    return [_combo_with_variants(c, db) for c in combos]


@router.get("/combos/{combo_id}", response_model=ComboOut)
def get_combo(combo_id: int, db: Session = Depends(get_db)):
    combo = db.get(StyleVariantCombo, combo_id)
    if not combo:
        raise HTTPException(404, "Combo not found")
    return _combo_with_variants(combo, db)


@router.patch("/combos/{combo_id}", response_model=ComboOut)
def update_combo(combo_id: int, payload: ComboIn, db: Session = Depends(get_db)):
    combo = db.get(StyleVariantCombo, combo_id)
    if not combo:
        raise HTTPException(404, "Combo not found")
    combo.name = payload.name
    combo.description = payload.description
    combo.selling_price = payload.selling_price
    combo.image_url = payload.image_url
    combo.is_active = payload.is_active
    # Replace items
    db.query(StyleVariantComboItem).filter_by(combo_id=combo_id).delete()
    for item in payload.items:
        if not db.get(StyleVariant, item.variant_id):
            raise HTTPException(404, f"StyleVariant {item.variant_id} not found")
        db.add(StyleVariantComboItem(combo_id=combo_id, variant_id=item.variant_id, qty=item.qty))
    db.commit()
    return _combo_with_variants(combo, db)


@router.delete("/combos/{combo_id}", status_code=204)
def delete_combo(combo_id: int, db: Session = Depends(get_db)):
    combo = db.get(StyleVariantCombo, combo_id)
    if not combo:
        raise HTTPException(404, "Combo not found")
    db.query(StyleVariantComboItem).filter_by(combo_id=combo_id).delete()
    db.delete(combo)
    db.commit()


# ── Website order ingestion ────────────────────────────────────────────────────

@public_router.post("/orders/website", status_code=201)
def website_order(
    payload: WebsiteOrderIn,
    db: Session = Depends(get_db),
    _key: None = Depends(_verify_website_key),
):
    """
    Accepts an order from the customer website.
    Expands combo items into variant lines, creates a FULFILLED SalesOrder,
    and deducts qty from each StyleVariant immediately.
    """
    # Build flat variant lines from payload
    lines: list[dict] = []

    for item in payload.items:
        if item.combo_id:
            combo = db.get(StyleVariantCombo, item.combo_id)
            if not combo:
                raise HTTPException(404, f"Combo {item.combo_id} not found")
            if not combo.is_active:
                raise HTTPException(400, f"Combo '{combo.name}' is no longer available")
            unit_price = item.unit_price if item.unit_price is not None else combo.selling_price
            combo_items = db.query(StyleVariantComboItem).filter_by(combo_id=combo.id).all()
            for ci in combo_items:
                lines.append({
                    "variant_id": ci.variant_id,
                    "qty": Decimal(str(ci.qty * item.qty)),
                    "unit_price": unit_price,
                    "gst_percent": Decimal("5"),
                })
        elif item.variant_id:
            variant = db.get(StyleVariant, item.variant_id)
            if not variant:
                raise HTTPException(404, f"Variant {item.variant_id} not found")
            unit_price = item.unit_price if item.unit_price is not None else (variant.selling_price or Decimal("0"))
            lines.append({
                "variant_id": item.variant_id,
                "qty": Decimal(str(item.qty)),
                "unit_price": unit_price,
                "gst_percent": Decimal("5"),
            })
        else:
            raise HTTPException(400, "Each item must have combo_id or variant_id")

    if not lines:
        raise HTTPException(400, "Order has no lines")

    # Check stock and deduct
    variant_deductions: dict[int, int] = {}
    for line in lines:
        vid = line["variant_id"]
        variant_deductions[vid] = variant_deductions.get(vid, 0) + int(line["qty"])

    for vid, deduct_qty in variant_deductions.items():
        variant = db.get(StyleVariant, vid)
        if not variant:
            raise HTTPException(404, f"Variant {vid} not found")
        if variant.qty < deduct_qty:
            raise HTTPException(409, f"Insufficient stock for {variant.color} {variant.size} (available: {variant.qty}, requested: {deduct_qty})")

    # Create order as FULFILLED (website = confirmed purchase)
    from datetime import date

    def _fy_label(d: date) -> str:
        start = d.year if d.month >= 4 else d.year - 1
        return f"{start}-{str(start + 1)[-2:]}"

    order = SalesOrder(
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_address=payload.customer_address,
        customer_state=payload.customer_state,
        status=SalesOrderStatus.FULFILLED.value,
    )
    db.add(order)
    db.flush()

    today = date.today()
    order.invoice_number = f"SC/{_fy_label(today)}/{order.id:04d}"

    for line in lines:
        db.add(SalesOrderLine(sales_order_id=order.id, **line))

    # Deduct stock
    for vid, deduct_qty in variant_deductions.items():
        variant = db.get(StyleVariant, vid)
        variant.qty -= deduct_qty

    db.commit()
    return {"order_id": order.id, "invoice_number": order.invoice_number, "status": order.status}
