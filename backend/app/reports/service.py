from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.production.models import CuttingRecord, ProductionOrder, ReworkRecord, StitchingBatch


def fabric_variance_report(session: Session) -> list[dict]:
    """Per cutting record: actual vs BOM-planned fabric usage, frozen at write time
    on the record itself (PHASE1_ARCHITECTURE.md §11)."""
    rows = session.execute(
        select(CuttingRecord, ProductionOrder.style_id)
        .join(ProductionOrder, ProductionOrder.id == CuttingRecord.production_order_id)
        .order_by(CuttingRecord.id)
    ).all()
    return [
        {
            "cutting_record_id": cr.id,
            "production_order_id": cr.production_order_id,
            "style_id": style_id,
            "fabric_lot_id": cr.fabric_lot_id,
            "planned_fabric_qty": cr.planned_fabric_qty,
            "actual_fabric_qty": cr.actual_fabric_qty,
            "variance_qty": cr.actual_fabric_qty - cr.planned_fabric_qty,
            "wastage_qty": cr.wastage_qty,
        }
        for cr, style_id in rows
    ]


def wastage_rejection_report(session: Session) -> dict:
    """Wastage by style (cutting) + rejection by vendor (stitching) + scrap (rework) —
    the visibility the spec calls out for rework/rejection (PHASE1_ARCHITECTURE.md §11)."""
    wastage_by_style = session.execute(
        select(ProductionOrder.style_id, func.sum(CuttingRecord.wastage_qty))
        .join(ProductionOrder, ProductionOrder.id == CuttingRecord.production_order_id)
        .group_by(ProductionOrder.style_id)
    ).all()

    rejection_by_vendor = session.execute(
        select(StitchingBatch.vendor_id, func.sum(StitchingBatch.rejected_qty))
        .where(StitchingBatch.rejected_qty > 0)
        .group_by(StitchingBatch.vendor_id)
    ).all()

    scrapped_by_style = session.execute(
        select(ProductionOrder.style_id, func.sum(ReworkRecord.qty))
        .join(StitchingBatch, StitchingBatch.id == ReworkRecord.parent_stitching_batch_id)
        .join(ProductionOrder, ProductionOrder.id == StitchingBatch.production_order_id)
        .where(ReworkRecord.outcome == "scrapped")
        .group_by(ProductionOrder.style_id)
    ).all()

    return {
        "wastage_by_style": [{"style_id": s, "wastage_qty": q} for s, q in wastage_by_style],
        "rejection_by_vendor": [
            {"vendor_id": v, "rejected_qty": q} for v, q in rejection_by_vendor
        ],
        "scrapped_by_style": [{"style_id": s, "scrapped_qty": q} for s, q in scrapped_by_style],
    }
