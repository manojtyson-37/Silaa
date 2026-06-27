from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.accessory_inventory.service import issue_accessory
from app.bom.models import BOM, BOMItem
from app.core.ledger_base import Direction
from app.fabric_inventory.service import issue_fabric
from app.production.models import (
    CuttingRecord,
    ProductionEvent,
    ProductionOrder,
    ProductionOrderVariant,
    QCState,
    ReworkRecord,
    StitchingBatch,
)


def _log_event(session: Session, production_order_id: int, event_type: str, payload: dict, created_by: str) -> None:
    session.add(
        ProductionEvent(
            production_order_id=production_order_id,
            event_type=event_type,
            payload_json=payload,
            created_by=created_by,
        )
    )


def create_production_order(
    session: Session,
    *,
    style_id: int,
    variants: list[dict],  # [{variant_id, planned_qty}]
    source: str,
    created_by: str,
) -> ProductionOrder:
    bom = session.query(BOM).filter_by(style_id=style_id).one()
    if bom.active_version_id is None:
        raise ValueError(f"Style {style_id} has no active BOM version")

    order = ProductionOrder(
        style_id=style_id,
        bom_version_id=bom.active_version_id,  # frozen now, immutable after this point
        source=source,
    )
    session.add(order)
    session.flush()

    for v in variants:
        session.add(
            ProductionOrderVariant(
                production_order_id=order.id,
                variant_id=v["variant_id"],
                planned_qty=v["planned_qty"],
            )
        )

    serializable_variants = [
        {"variant_id": v["variant_id"], "planned_qty": str(v["planned_qty"])} for v in variants
    ]
    _log_event(session, order.id, "order_created", {"style_id": style_id, "variants": serializable_variants}, created_by)
    session.commit()
    return order


def record_cutting(
    session: Session,
    *,
    production_order_id: int,
    fabric_lot_id: int,
    planned_fabric_qty: Decimal,
    actual_fabric_qty: Decimal,
    cut_pieces_qty: Decimal,
    wastage_qty: Decimal,
    warehouse_id: int,
    created_by: str,
) -> CuttingRecord:
    """Cutting record + fabric ledger outbound entry in one transaction."""
    record = CuttingRecord(
        production_order_id=production_order_id,
        fabric_lot_id=fabric_lot_id,
        planned_fabric_qty=planned_fabric_qty,
        actual_fabric_qty=actual_fabric_qty,
        cut_pieces_qty=cut_pieces_qty,
        wastage_qty=wastage_qty,
    )
    session.add(record)
    session.flush()

    issue_fabric(
        session,
        fabric_lot_id=fabric_lot_id,
        qty=actual_fabric_qty,
        warehouse_id=warehouse_id,
        reference_type="production_order",
        reference_id=production_order_id,
        created_by=created_by,
        commit=False,  # folded into this function's single commit below — one atomic transaction
    )

    _log_event(
        session,
        production_order_id,
        "cutting_recorded",
        {"fabric_lot_id": fabric_lot_id, "actual_fabric_qty": str(actual_fabric_qty)},
        created_by,
    )
    session.commit()
    return record


def create_stitching_batch(
    session: Session,
    *,
    production_order_id: int,
    sent_qty: Decimal,
    vendor_id: int | None,
    in_house: bool,
    warehouse_id: int,
    created_by: str,
    labor_cost: Decimal = Decimal("0"),
) -> StitchingBatch:
    """Issues accessory stock per the production order's active BOM
    (qty_per_unit * sent_qty, style-wide items only — ponytail: per-variant
    BOMItem overrides aren't applied here since a stitching batch isn't
    split by variant; revisit if variant-level accessory costs diverge
    enough to matter) in the same transaction as creating the batch."""
    batch = StitchingBatch(
        production_order_id=production_order_id,
        vendor_id=vendor_id,
        in_house=in_house,
        sent_qty=sent_qty,
        labor_cost=labor_cost,
    )
    session.add(batch)
    session.flush()

    order = session.get(ProductionOrder, production_order_id)
    accessory_items = (
        session.query(BOMItem)
        .filter_by(bom_version_id=order.bom_version_id, component_type="accessory", variant_id=None)
        .all()
    )
    for bom_item in accessory_items:
        issue_accessory(
            session,
            accessory_item_id=bom_item.component_id,
            qty=bom_item.qty_per_unit * sent_qty,
            warehouse_id=warehouse_id,
            reference_type="production_order",
            reference_id=production_order_id,
            created_by=created_by,
            commit=False,
        )

    _log_event(
        session, production_order_id, "stitching_sent", {"batch_id": batch.id, "sent_qty": str(sent_qty)}, created_by
    )
    session.commit()
    return batch


def receive_stitching(
    session: Session,
    *,
    batch: StitchingBatch,
    received_qty: Decimal,
    rejected_qty: Decimal,
    created_by: str,
) -> StitchingBatch:
    batch.received_qty = received_qty
    batch.rejected_qty = rejected_qty
    _log_event(
        session,
        batch.production_order_id,
        "stitching_received",
        {"batch_id": batch.id, "received_qty": str(received_qty), "rejected_qty": str(rejected_qty)},
        created_by,
    )
    session.commit()
    return batch


def apply_qc(
    session: Session,
    *,
    batch: StitchingBatch,
    qc_state: QCState,
    qty: Decimal,
    variant_id: int,
    warehouse_id: int,
    created_by: str,
    fg_writer=None,  # callable(session, *, production_order_id, variant_id, qty, warehouse_id, grade, created_by, commit) -> None
) -> StitchingBatch:
    """PASS/SECOND_SALE write to Finished Goods atomically with the QC state
    change — both succeed or both fail, per Revision 1 Change 2 point 5.
    SCRAP writes off (no FG entry). HOLD blocks until manually resolved.
    fg_writer is injected so production doesn't import finished_goods
    directly (module-boundary rule) — caller wires the real writer."""
    batch.qc_state = qc_state.value

    if qc_state in (QCState.PASS, QCState.SECOND_SALE):
        if fg_writer is None:
            raise ValueError("fg_writer is required for PASS/SECOND_SALE")
        grade = "second_sale" if qc_state == QCState.SECOND_SALE else None
        fg_writer(
            session,
            production_order_id=batch.production_order_id,
            variant_id=variant_id,
            qty=qty,
            warehouse_id=warehouse_id,
            grade=grade,
            created_by=created_by,
            commit=False,  # folded into this function's single commit below
        )

    _log_event(
        session,
        batch.production_order_id,
        "qc_applied",
        {"batch_id": batch.id, "qc_state": qc_state.value, "qty": str(qty)},
        created_by,
    )
    session.commit()
    return batch


def apply_rework(
    session: Session,
    *,
    batch: StitchingBatch,
    qty: Decimal,
    outcome: str,
    reason_code: str,
    created_by: str,
) -> ReworkRecord:
    """Feeds back into the same production order's passed count — never
    spawns a new production order (base doc edge case table)."""
    record = ReworkRecord(
        parent_stitching_batch_id=batch.id,
        qty=qty,
        reason_code=reason_code,
        outcome=outcome,
    )
    session.add(record)
    _log_event(
        session,
        batch.production_order_id,
        "rework_applied",
        {"batch_id": batch.id, "qty": str(qty), "outcome": outcome},
        created_by,
    )
    session.commit()
    return record
