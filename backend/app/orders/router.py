from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_default_warehouse_id
from app.db import get_db
from app.orders.invoice import generate_invoice_pdf
from app.orders.models import SalesOrder, SalesOrderLine, SalesOrderStatus
from app.orders.service import InsufficientStockError, cancel_order, create_sales_order, fulfill_order

router = APIRouter(tags=["orders"])


class SalesOrderLineIn(BaseModel):
    variant_id: int
    qty: Decimal
    unit_price: Decimal


class SalesOrderIn(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    lines: list[SalesOrderLineIn]
    created_by: str


class SalesOrderOut(BaseModel):
    id: int
    customer_name: str
    customer_phone: Optional[str]
    customer_address: Optional[str]
    status: str


class SalesOrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None


@router.post("/sales-orders", response_model=SalesOrderOut)
def create_order(payload: SalesOrderIn, db: Session = Depends(get_db)):
    order = create_sales_order(
        db,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_address=payload.customer_address,
        lines=[l.model_dump() for l in payload.lines],
        created_by=payload.created_by,
    )
    return order


@router.get("/sales-orders", response_model=list[SalesOrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(SalesOrder).all()


@router.get("/sales-orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    lines = db.query(SalesOrderLine).filter_by(sales_order_id=order_id).all()
    return {
        "id": order.id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "customer_address": order.customer_address,
        "status": order.status,
        "lines": [
            {"id": l.id, "variant_id": l.variant_id, "qty": l.qty, "unit_price": l.unit_price}
            for l in lines
        ],
    }


@router.patch("/sales-orders/{order_id}", response_model=SalesOrderOut)
def update_sales_order(order_id: int, payload: SalesOrderUpdate, db: Session = Depends(get_db)):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    if order.status != SalesOrderStatus.DRAFT.value:
        raise HTTPException(400, "Can only update SalesOrder in DRAFT status")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(order, k, v)
    db.commit()
    return order


@router.post("/sales-orders/{order_id}/fulfill", response_model=SalesOrderOut)
def fulfill(
    order_id: int,
    created_by: str,
    db: Session = Depends(get_db),
    warehouse_id: int = Depends(get_default_warehouse_id),
):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    try:
        fulfill_order(db, order=order, warehouse_id=warehouse_id, created_by=created_by)
    except InsufficientStockError as exc:
        raise HTTPException(409, str(exc))
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return order


@router.post("/sales-orders/{order_id}/cancel", response_model=SalesOrderOut)
def cancel(order_id: int, db: Session = Depends(get_db)):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    try:
        cancel_order(db, order=order)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return order


@router.get("/sales-orders/{order_id}/invoice.pdf")
def invoice(order_id: int, db: Session = Depends(get_db)):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    lines = db.query(SalesOrderLine).filter_by(sales_order_id=order_id).all()
    pdf_bytes = generate_invoice_pdf(order, lines, db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice-so-{order_id}.pdf"'},
    )


@router.get("/sales-orders/{order_id}/margin")
def margin(order_id: int, db: Session = Depends(get_db)):
    from app.finished_goods.service import average_unit_cost

    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    lines = db.query(SalesOrderLine).filter_by(sales_order_id=order_id).all()
    line_margins = []
    total_margin = Decimal("0")
    for line in lines:
        unit_cost = average_unit_cost(db, line.variant_id)
        line_margin = (line.unit_price - unit_cost) * line.qty
        total_margin += line_margin
        line_margins.append({
            "variant_id": line.variant_id,
            "qty": line.qty,
            "unit_price": line.unit_price,
            "unit_cost": unit_cost,
            "margin": line_margin,
        })
    return {"order_id": order_id, "lines": line_margins, "total_margin": total_margin}
