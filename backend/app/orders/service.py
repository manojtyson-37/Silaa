from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.ledger_base import Direction
from app.finished_goods.service import fg_balance, record_movement
from app.orders.models import SalesOrder, SalesOrderLine, SalesOrderStatus


class InsufficientStockError(Exception):
    pass


def _financial_year_label(d: date) -> str:
    start_year = d.year if d.month >= 4 else d.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def create_sales_order(
    session: Session,
    *,
    customer_name: str,
    lines: list[dict],
    created_by: str,
    customer_phone: str | None = None,
    customer_address: str | None = None,
    customer_state: str | None = None,
) -> SalesOrder:
    order = SalesOrder(
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_address=customer_address,
        customer_state=customer_state,
        status=SalesOrderStatus.DRAFT.value,
    )
    session.add(order)
    session.flush()
    for line in lines:
        session.add(SalesOrderLine(sales_order_id=order.id, **line))
    session.commit()
    return order


def fulfill_order(
    session: Session, *, order: SalesOrder, warehouse_id: int, created_by: str
) -> SalesOrder:
    """Checks every line has sufficient FG balance BEFORE writing anything,
    then writes all lines' ledger entries in one transaction — either the
    whole order ships or none of it does, never a half-fulfilled order."""
    if order.status != SalesOrderStatus.DRAFT.value:
        raise ValueError(f"Cannot fulfill order in status {order.status}")

    lines = session.query(SalesOrderLine).filter_by(sales_order_id=order.id).all()

    for line in lines:
        balance = fg_balance(session, line.variant_id, warehouse_id)
        if line.qty > balance:
            from app.style_variant.models import StyleVariant
            variant = session.get(StyleVariant, line.variant_id)
            if variant and variant.qty >= line.qty:
                adjustment_qty = variant.qty - balance
                if adjustment_qty > 0:
                    record_movement(
                        session,
                        variant_id=line.variant_id,
                        qty=adjustment_qty,
                        direction=Direction.IN,
                        txn_type="adjustment",
                        warehouse_id=warehouse_id,
                        reason_code="auto_sync",
                        created_by=created_by,
                        commit=False,
                    )
                    balance = variant.qty
            if line.qty > balance:
                raise InsufficientStockError(
                    f"Variant {line.variant_id}: requested {line.qty}, available {balance}"
                )
            
        # Keep StyleVariant.qty in sync
        variant = session.get(StyleVariant, line.variant_id)
        if variant:
            variant.qty -= int(line.qty)

    for line in lines:
        record_movement(
            session,
            variant_id=line.variant_id,
            qty=line.qty,
            direction=Direction.OUT,
            txn_type="sale",
            warehouse_id=warehouse_id,
            reason_code=None,
            reference_type="sales_order",
            reference_id=order.id,
            created_by=created_by,
            commit=False,
        )

    order.status = SalesOrderStatus.FULFILLED.value
    if not order.invoice_number:
        today = date.today()
        order.invoice_number = f"SC/{_financial_year_label(today)}/{order.id:04d}"
    session.commit()
    return order


def cancel_order(session: Session, *, order: SalesOrder) -> SalesOrder:
    if order.status != SalesOrderStatus.DRAFT.value:
        raise ValueError(f"Cannot cancel order in status {order.status}")
    order.status = SalesOrderStatus.CANCELLED.value
    session.commit()
    return order


def return_order(session: Session, *, order: SalesOrder, created_by: str) -> SalesOrder:
    if order.status != SalesOrderStatus.FULFILLED.value:
        raise ValueError(f"Cannot return order in status {order.status}")
    
    order.status = SalesOrderStatus.RETURNED.value
    
    # Restock inventory
    lines = session.query(SalesOrderLine).filter_by(sales_order_id=order.id).all()
    from app.style_variant.models import StyleVariant
    for line in lines:
        record_movement(
            session,
            variant_id=line.variant_id,
            qty=line.qty,
            direction=Direction.IN,
            txn_type="return",
            warehouse_id=1,  # Default warehouse for now
            reason_code=None,
            reference_type="sales_order",
            reference_id=order.id,
            created_by=created_by,
            commit=False,
        )
        variant = session.get(StyleVariant, line.variant_id)
        if variant:
            variant.qty += int(line.qty)
            
    session.commit()
    return order


def replace_order(session: Session, *, order: SalesOrder, created_by: str) -> SalesOrder:
    if order.status != SalesOrderStatus.FULFILLED.value:
        raise ValueError(f"Cannot replace order in status {order.status}")
    
    order.status = SalesOrderStatus.REPLACED.value
    
    # Restock inventory just like return
    lines = session.query(SalesOrderLine).filter_by(sales_order_id=order.id).all()
    from app.style_variant.models import StyleVariant
    for line in lines:
        record_movement(
            session,
            variant_id=line.variant_id,
            qty=line.qty,
            direction=Direction.IN,
            txn_type="replacement",
            warehouse_id=1,  # Default warehouse for now
            reason_code=None,
            reference_type="sales_order",
            reference_id=order.id,
            created_by=created_by,
            commit=False,
        )
        variant = session.get(StyleVariant, line.variant_id)
        if variant:
            variant.qty += int(line.qty)
            
    session.commit()
    return order
