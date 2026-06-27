from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.orders.models import SalesOrder, SalesOrderStatus
from app.procurement.models import POStatus, PurchaseOrder
from app.production.models import ProductionEvent, ProductionOrder


def dashboard_summary(session: Session) -> dict:
    open_production_orders = session.scalar(
        select(func.count()).select_from(ProductionOrder).where(ProductionOrder.status == "open")
    )
    draft_sales_orders = session.scalar(
        select(func.count()).select_from(SalesOrder).where(SalesOrder.status == SalesOrderStatus.DRAFT.value)
    )
    fulfilled_sales_orders = session.scalar(
        select(func.count()).select_from(SalesOrder).where(SalesOrder.status == SalesOrderStatus.FULFILLED.value)
    )
    pending_purchase_orders = session.scalar(
        select(func.count())
        .select_from(PurchaseOrder)
        .where(PurchaseOrder.status.in_([POStatus.DRAFT.value, POStatus.APPROVED.value]))
    )
    recent_events = session.scalars(
        select(ProductionEvent).order_by(ProductionEvent.created_at.desc()).limit(10)
    ).all()

    return {
        "open_production_orders": open_production_orders or 0,
        "draft_sales_orders": draft_sales_orders or 0,
        "fulfilled_sales_orders": fulfilled_sales_orders or 0,
        "pending_purchase_orders": pending_purchase_orders or 0,
        "recent_events": [
            {
                "production_order_id": e.production_order_id,
                "event_type": e.event_type,
                "created_at": e.created_at,
                "created_by": e.created_by,
            }
            for e in recent_events
        ],
    }
