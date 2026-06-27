from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.dashboard.service import dashboard_summary

router = APIRouter(tags=["dashboard"])


class RecentEventOut(BaseModel):
    production_order_id: int
    event_type: str
    created_at: datetime
    created_by: str


class DashboardSummaryOut(BaseModel):
    open_production_orders: int
    draft_sales_orders: int
    fulfilled_sales_orders: int
    pending_purchase_orders: int
    recent_events: list[RecentEventOut]


@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return dashboard_summary(db)
