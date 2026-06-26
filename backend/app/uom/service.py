from decimal import Decimal

from sqlalchemy.orm import Session

from app.uom.models import UOMConversion, UnitOfMeasure


class MissingConversionFactorError(Exception):
    pass


def convert(session: Session, qty: Decimal, from_uom_code: str, to_uom_code: str) -> Decimal:
    if from_uom_code == to_uom_code:
        return qty

    from_uom = session.query(UnitOfMeasure).filter_by(code=from_uom_code).one()
    to_uom = session.query(UnitOfMeasure).filter_by(code=to_uom_code).one()

    conversion = (
        session.query(UOMConversion)
        .filter_by(from_uom_id=from_uom.id, to_uom_id=to_uom.id)
        .first()
    )
    if conversion is None:
        raise MissingConversionFactorError(
            f"No conversion factor from {from_uom_code} to {to_uom_code}"
        )
    return qty * conversion.factor
