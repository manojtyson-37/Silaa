from decimal import Decimal

import pytest

from app.uom.models import UOMConversion, UnitOfMeasure
from app.uom.service import MissingConversionFactorError, convert


def _seed_units(session):
    roll = UnitOfMeasure(code="roll", name="Roll", category="length")
    meter = UnitOfMeasure(code="meter", name="Meter", category="length")
    session.add_all([roll, meter])
    session.flush()
    session.add(UOMConversion(from_uom_id=roll.id, to_uom_id=meter.id, factor=Decimal(50)))
    session.commit()


def test_roll_to_meter_conversion(session):
    _seed_units(session)
    assert convert(session, Decimal(2), "roll", "meter") == Decimal(100)


def test_missing_conversion_factor_raises(session):
    _seed_units(session)
    with pytest.raises(MissingConversionFactorError):
        convert(session, Decimal(1), "meter", "roll")  # reverse direction has no row seeded


def test_same_unit_is_identity(session):
    _seed_units(session)
    assert convert(session, Decimal(7), "meter", "meter") == Decimal(7)
