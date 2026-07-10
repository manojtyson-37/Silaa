from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.ledger_base import Direction
from app.finished_goods.service import fg_balance, record_movement
from app.orders.models import SalesOrder, SalesOrderLine, SalesOrderStatus


class InsufficientStockError(Exception):
    pass


def create_sales_order(
    session: Session,
    *,
    customer_name: str,
    lines: list[dict],
    created_by: str,
    customer_phone: str | None = None,
    customer_address: str | None = None,
) -> SalesOrder:
    order = SalesOrder(
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_address=customer_address,
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
            raise InsufficientStockError(
                f"Variant {line.variant_id}: requested {line.qty}, available {balance}"
            )

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
    session.commit()
    return order


def cancel_order(session: Session, *, order: SalesOrder) -> SalesOrder:
    if order.status != SalesOrderStatus.DRAFT.value:
        raise ValueError(f"Cannot cancel order in status {order.status}")
    order.status = SalesOrderStatus.CANCELLED.value
    session.commit()
    return order
