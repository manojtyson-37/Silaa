from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db import Base


class BOM(Base):
    __tablename__ = "bom"

    id: Mapped[int] = mapped_column(primary_key=True)
    style_id: Mapped[int] = mapped_column(ForeignKey("style.id"), nullable=False)
    # no DB-level FK to bom_version: circular dependency (bom_version.bom_id -> bom.id).
    # Integrity held at app layer — activate_version() only ever points this at a
    # version that was just created against this same BOM.
    active_version_id: Mapped[int] = mapped_column(nullable=True)


class BOMVersion(Base):
    __tablename__ = "bom_version"

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("bom.id"), nullable=False)
    version_no: Mapped[int] = mapped_column(nullable=False)


class BOMItem(Base):
    """Immutable once created — corrections happen via a new BOMVersion,
    never an edit to an existing version's items (Revision 1 Change 4)."""

    __tablename__ = "bom_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_version_id: Mapped[int] = mapped_column(ForeignKey("bom_version.id"), nullable=False)
    component_type: Mapped[str] = mapped_column(String, nullable=False)  # fabric/accessory
    component_id: Mapped[int] = mapped_column(nullable=False)
    qty_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String, nullable=False)
    variant_id: Mapped[int] = mapped_column(
        ForeignKey("style_variant.id"), nullable=True
    )  # style-wide by default; set to override for a specific variant


def create_bom_version(session: Session, bom: BOM, items: list[dict]) -> BOMVersion:
    last = (
        session.query(BOMVersion)
        .filter_by(bom_id=bom.id)
        .order_by(BOMVersion.version_no.desc())
        .first()
    )
    next_no = (last.version_no + 1) if last else 1
    version = BOMVersion(bom_id=bom.id, version_no=next_no)
    session.add(version)
    session.flush()

    for item in items:
        session.add(BOMItem(bom_version_id=version.id, **item))
    session.commit()
    return version


def activate_version(session: Session, bom: BOM, version: BOMVersion) -> None:
    """Activating a new version never touches existing BOMItem rows or any
    already-created ProductionOrder's frozen bom_version_id."""
    bom.active_version_id = version.id
    session.commit()
