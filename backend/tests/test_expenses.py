"""HTTP-layer tests for expense categories — duplicate-name handling + icon/PATCH."""
import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base


def make_client(tmp_path):
    db_path = tmp_path / "expenses.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

    import app.db as db_module

    db_module.engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    db_module.SessionLocal = sessionmaker(bind=db_module.engine, autoflush=False, autocommit=False)

    from app.main import app

    Base.metadata.create_all(db_module.engine)
    client = TestClient(app)
    token = client.post("/auth/login", json={"username": "admin", "password": "test-password"}).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


def test_create_category_with_icon_and_color(tmp_path):
    client = make_client(tmp_path)
    resp = client.post("/expense-categories", json={"name": "Rent", "icon": "home", "color": "#3b82f6"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["icon"] == "home"
    assert body["color"] == "#3b82f6"


def test_duplicate_create_returns_409(tmp_path):
    client = make_client(tmp_path)
    assert client.post("/expense-categories", json={"name": "Salary"}).status_code == 201
    dup = client.post("/expense-categories", json={"name": "Salary"})
    assert dup.status_code == 409


def test_patch_updates_icon_and_name(tmp_path):
    client = make_client(tmp_path)
    cat = client.post("/expense-categories", json={"name": "Misc", "icon": "tag"}).json()
    resp = client.patch(f"/expense-categories/{cat['id']}", json={"name": "Utilities", "icon": "zap"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Utilities"
    assert resp.json()["icon"] == "zap"


def test_patch_rename_to_existing_returns_409(tmp_path):
    client = make_client(tmp_path)
    client.post("/expense-categories", json={"name": "A"})
    b = client.post("/expense-categories", json={"name": "B"}).json()
    resp = client.patch(f"/expense-categories/{b['id']}", json={"name": "A"})
    assert resp.status_code == 409


def test_patch_empty_name_returns_422(tmp_path):
    client = make_client(tmp_path)
    cat = client.post("/expense-categories", json={"name": "Keep"}).json()
    assert client.patch(f"/expense-categories/{cat['id']}", json={"name": "   "}).status_code == 422
