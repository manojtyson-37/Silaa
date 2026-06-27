from decimal import Decimal

from app.core.warehouse import seed_default_warehouse
from app.dashboard.service import dashboard_summary
from app.orders.service import create_sales_order
from app.procurement.models import POStatus, PurchaseOrder
from app.production.models import ProductionOrder
from app.style_variant.models import Style, StyleVariant


def test_dashboard_summary_counts(session):
    seed_default_warehouse(session)
    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    variant = StyleVariant(style_id=style.id, color="Black", size="M", sku_code="COORD-BLK-M")
    session.add(variant)
    session.flush()

    create_sales_order(
        session, customer_name="Jane",
        lines=[{"variant_id": variant.id, "qty": Decimal(1), "unit_price": Decimal(100)}],
        created_by="t",
    )
    session.add(PurchaseOrder(supplier_id=1, status=POStatus.DRAFT.value))
    session.add(ProductionOrder(style_id=style.id, bom_version_id=1, status="open", source="stock_build"))
    session.flush()

    summary = dashboard_summary(session)
    assert summary["draft_sales_orders"] == 1
    assert summary["pending_purchase_orders"] == 1
    assert summary["open_production_orders"] == 1
    assert summary["recent_events"] == []
