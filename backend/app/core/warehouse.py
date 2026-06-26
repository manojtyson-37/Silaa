from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Warehouse(Base):
    __tablename__ = "warehouse"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


def seed_default_warehouse(session) -> Warehouse:
    """ponytail: single seeded row for Phase 1 (one warehouse). Add transfer
    workflows / multi-location logic only when Phase 3 multi-warehouse work starts."""
    existing = session.query(Warehouse).first()
    if existing:
        return existing
    wh = Warehouse(name="Default Warehouse")
    session.add(wh)
    session.commit()
    return wh
