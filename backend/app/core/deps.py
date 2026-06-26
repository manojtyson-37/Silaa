from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.warehouse import seed_default_warehouse
from app.db import get_db


def get_default_warehouse_id(db: Session = Depends(get_db)) -> int:
    """ponytail: Phase 1 has exactly one warehouse — every route defaults to
    it. Add warehouse selection to the request once Phase 3 multi-warehouse
    work starts; the warehouse_id column already exists everywhere."""
    return seed_default_warehouse(db).id
