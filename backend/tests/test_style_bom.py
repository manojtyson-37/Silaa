from decimal import Decimal

from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

import pytest

from app.bom.models import BOM, activate_version, create_bom_version
from app.style_variant.models import Style, StyleVariant


def test_no_stock_field_on_style_or_variant():
    for model in (Style, StyleVariant):
        columns = {c.key for c in inspect(model).columns}
        forbidden = {"quantity", "balance", "stock_qty"}
        assert not (columns & forbidden), f"{model.__name__} must never hold a stock field"


def test_sku_code_unique_constraint(session):
    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    session.add(StyleVariant(style_id=style.id, color="Black", size="S", sku_code="COORD-BLK-S"))
    session.commit()

    session.add(StyleVariant(style_id=style.id, color="White", size="S", sku_code="COORD-BLK-S"))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_bom_version_immutable_after_new_version_activated(session):
    style = Style(name="Co-ord Set", category="set")
    session.add(style)
    session.flush()
    bom = BOM(style_id=style.id)
    session.add(bom)
    session.flush()

    v1 = create_bom_version(
        session, bom, [{"component_type": "accessory", "component_id": 1, "qty_per_unit": Decimal(1), "uom": "piece"}]
    )
    activate_version(session, bom, v1)

    v2 = create_bom_version(
        session, bom, [{"component_type": "accessory", "component_id": 2, "qty_per_unit": Decimal(2), "uom": "piece"}]
    )
    activate_version(session, bom, v2)

    from app.bom.models import BOMItem

    v1_items = session.query(BOMItem).filter_by(bom_version_id=v1.id).all()
    assert len(v1_items) == 1
    assert v1_items[0].component_id == 1  # untouched by v2's activation
    assert bom.active_version_id == v2.id
