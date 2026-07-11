from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
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
    gst_percent: Decimal = Field(Decimal("5"), ge=0, le=100)


class SalesOrderIn(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_state: Optional[str] = None
    lines: list[SalesOrderLineIn]
    created_by: str


class SalesOrderOut(BaseModel):
    id: int
    customer_name: str
    customer_phone: Optional[str]
    customer_address: Optional[str]
    customer_state: Optional[str]
    invoice_number: Optional[str]
    status: str


class SalesOrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_state: Optional[str] = None


@router.post("/sales-orders", response_model=SalesOrderOut)
def create_order(payload: SalesOrderIn, db: Session = Depends(get_db)):
    order = create_sales_order(
        db,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_address=payload.customer_address,
        customer_state=payload.customer_state,
        lines=[l.model_dump() for l in payload.lines],
        created_by=payload.created_by,
    )
    return order


@router.get("/sales-orders", response_model=list[SalesOrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(SalesOrder).all()


@router.get("/sales-orders/margins")
def all_margins(db: Session = Depends(get_db)):
    """One-shot margin totals for every order — replaces the per-order
    /margin fan-out that made the Sales Orders page slow (was N HTTP calls,
    each doing N cost queries against a cross-region DB). Loads all lines and
    all variant costs in a fixed number of queries, computes in memory.

    Declared before /sales-orders/{order_id} so 'margins' isn't parsed as an id."""
    from app.finished_goods.service import average_unit_costs

    lines = db.query(SalesOrderLine).all()
    costs = average_unit_costs(db, [l.variant_id for l in lines])
    totals: dict[int, Decimal] = {}
    for line in lines:
        unit_cost = costs.get(line.variant_id, Decimal("0"))
        totals[line.sales_order_id] = totals.get(line.sales_order_id, Decimal("0")) + (line.unit_price - unit_cost) * line.qty
    order_ids = [o.id for o in db.query(SalesOrder.id).all()]
    return [{"order_id": oid, "total_margin": totals.get(oid, Decimal("0"))} for oid in order_ids]


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
        "customer_state": order.customer_state,
        "invoice_number": order.invoice_number,
        "status": order.status,
        "lines": [
            {"id": l.id, "variant_id": l.variant_id, "qty": l.qty, "unit_price": l.unit_price, "gst_percent": l.gst_percent}
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


@router.delete("/sales-orders/{order_id}", status_code=204)
def delete_sales_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(404, "SalesOrder not found")
    deletable = {SalesOrderStatus.DRAFT.value, SalesOrderStatus.CANCELLED.value, SalesOrderStatus.FULFILLED.value}
    if order.status not in deletable:
        raise HTTPException(400, f"Cannot delete a SalesOrder in '{order.status}' status")
    if order.status == SalesOrderStatus.FULFILLED.value:
        from app.finished_goods.models import FinishedGoodsLedgerEntry
        db.query(FinishedGoodsLedgerEntry).filter_by(reference_type="sales_order", reference_id=order_id).delete()
    db.query(SalesOrderLine).filter_by(sales_order_id=order_id).delete()
    db.delete(order)
    db.commit()


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
