import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import main as _import_all_models  # noqa: F401  populates Base.metadata
from app import wiring
from app.db import Base


@pytest.fixture()
def session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    wiring.configure()
    yield db
    db.close()


@pytest.fixture()
def warehouse_id(session):
    from app.core.warehouse import seed_default_warehouse

    return seed_default_warehouse(session).id
