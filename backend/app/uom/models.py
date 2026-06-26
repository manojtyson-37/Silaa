from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class UnitOfMeasure(Base):
    __tablename__ = "unit_of_measure"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)  # length/weight/count


class UOMConversion(Base):
    __tablename__ = "uom_conversion"
    __table_args__ = (UniqueConstraint("from_uom_id", "to_uom_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    from_uom_id: Mapped[int] = mapped_column(ForeignKey("unit_of_measure.id"), nullable=False)
    to_uom_id: Mapped[int] = mapped_column(ForeignKey("unit_of_measure.id"), nullable=False)
    factor: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)
