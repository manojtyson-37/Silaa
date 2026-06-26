# Phase 1 Architecture — Fabric Inventory, Accessories Inventory, Production Management

Status: SUPERSEDED IN PART — see [PHASE1_ARCHITECTURE_REVISION_1.md](PHASE1_ARCHITECTURE_REVISION_1.md) for 9 mandatory changes (variant model, finished goods ledger, reservations, BOM versioning, expanded QC states, UOM conversion, polymorphic-ref and event-payload review). Approved with minor changes — read both files together. This file's §5 `Style`/`SKU`/`ProductionOrder` definitions below are overridden by Revision 1 Changes 1 & 7.

---

## 1. Problem Statement

Brand currently tracks fabric, accessories, and production manually (Excel + WhatsApp). No single source of truth for: what fabric is in stock, what's committed to production, what's been consumed, wastage, or true cost per SKU. Owner cannot see profitability per style without manual reconciliation.

Goal: replace these three workflows with a transactional system where stock and production state are *derived from events*, never hand-edited.

---

## 2. Assumptions

- Single warehouse/location for Phase 1 (multi-warehouse is Phase 3).
- Single currency, single GST/tax regime (India-based, adjust if wrong).
- Manufacturing happens in-house and/or via job-work vendors (cut-and-sew outsourced), not pure in-house factory — confirm.
- Fabric purchased by weight/length (kg or meters), accessories by count.
- One fabric can map to many styles; one style can use multiple fabrics + accessories (BOM).
- No barcode scanning yet — manual entry via forms (Phase 3 adds scanning).

## 3. Questions — ANSWERED

1. In-house stitching, job-work, or both? → **Both.** `StitchingBatch` stays as designed (vendor_id nullable + in_house flag covers both paths).
2. Fabric tracked by roll/lot (dye-lot) or bulk qty? → **Not decided yet, may change later.** Schema keeps `FabricLot` but makes `dye_lot_no` optional. See §5 note — designed so lot-granularity can be turned on/off without a rework.
3. Accessories consumed per-unit or per-batch? → **Per-unit.** Matches original assumption, no schema change.
4. SKU = size/color combo, or SKU = piece regardless of size/color? → **SKU = piece, irrespective of size/color.** Drops the separate `SKU` entity — `Style` is the sellable unit for Phase 1. See §5.
5. Landed cost folded into fabric cost, or PO price only? → **PO price only.** Freight/customs/handling tracked as separate expense entries, not blended into `cost_per_uom`. Feeds Finance/Costing Engine as distinct allocation lines later.

---

## 4. Business Workflows

### 4.1 Fabric Inventory
1. **Purchase** — PO raised → fabric received (with dye-lot, GSM, width, supplier) → GRN (Goods Receipt Note) creates inbound stock ledger entry.
2. **Issue to production** — fabric allocated to a production order (cutting) → outbound ledger entry, tied to that production order.
3. **Returns/leftover** — uncut fabric returned to inventory after cutting → inbound ledger entry (linked to source production order, for traceability).
4. **Damage/shrinkage** — fabric damaged in storage or shrinks on wash-test → adjustment ledger entry with reason code.

### 4.2 Accessories Inventory
1. **Purchase** — PO → GRN → inbound ledger entry per accessory SKU (buttons, zippers, thread, labels, poly bags, cartons).
2. **Issue to production** — consumed per BOM at production-order creation or at packing stage (zips/buttons at stitching, labels/poly at packing) → outbound ledger entry.
3. **Damage/wastage** — defective accessories (e.g. broken zips) → adjustment entry.

### 4.3 Production Management
1. **Production Order (PO-Mfg) created** from a sales order or stock-build decision — specifies style, quantity, target fabric + accessory BOM.
2. **Cutting** — fabric issued, cut pieces counted (cut qty may be less than planned due to fabric defects/shrinkage) → records actual fabric consumed vs planned.
3. **Stitching** — assigned to in-house tailor or external vendor (job-work) → tracks qty sent, qty received, qty rejected.
4. **Quality check** — received goods checked → pass qty → Finished Goods Inventory; reject qty → either reworked (new sub-cycle) or scrapped.
5. **Rework** — rejected units sent back through stitching/finishing → tracked as a child production event, not a new order (preserves cost traceability to original order).
6. **Completion** — production order closes when all planned qty is either delivered to FG, scrapped, or explicitly written off as short.

---

## 5. Entities

**Shared / Master Data**
- `Supplier` (id, name, type: fabric/accessory/job-work-vendor, contact, payment terms)
- `Style` (id, name, category, season) — **this is the sellable unit (= SKU).** No separate SKU entity, no size/color variants in Phase 1.
- `BOM` (style_id, component_type: fabric/accessory, component_id, qty_per_unit, uom)

**Fabric**
- `FabricItem` (id, name, composition, GSM, width, default_uom)
- `FabricLot` (id, fabric_item_id, supplier_id, dye_lot_no **[nullable]**, po_id, received_qty, received_date, cost_per_uom **[PO price only — landed costs tracked separately, not folded in]**)
- `FabricLedgerEntry` (id, fabric_lot_id, txn_type: purchase/issue/return/damage/adjustment, qty, direction: in/out, ref_type, ref_id, created_at, created_by, reason_code)

Lot-tracking note: `dye_lot_no` nullable so you can start without dye-lot discipline and turn it on later — every fabric receive still creates a `FabricLot` row, just with `dye_lot_no=null` until you decide to track it. Allocation logic always references `fabric_lot_id`, never `fabric_item_id` directly, so switching dye-lot tracking on later needs zero schema migration — just start populating the field.

Landed cost note: freight/customs/handling go on a separate `LandedCostEntry` (fabric_lot_id, expense_type, amount) — visible in Finance/Costing Engine as a distinct line, not blended into `cost_per_uom`.

**Accessories**
- `AccessoryItem` (id, name, type, uom, default_cost)
- `AccessoryLedgerEntry` (id, accessory_item_id, supplier_id, txn_type, qty, direction, ref_type, ref_id, created_at, reason_code)

**Production**
- `ProductionOrder` (id, style_id, planned_qty, status, source: sales_order/stock_build, created_at)
- `CuttingRecord` (id, production_order_id, fabric_lot_id, planned_fabric_qty, actual_fabric_qty, cut_pieces_qty, wastage_qty, created_at)
- `StitchingBatch` (id, production_order_id, vendor_id_or_inhouse_flag, sent_qty, received_qty, rejected_qty, sent_date, received_date)
- `ReworkRecord` (id, parent_stitching_batch_id, qty, reason_code, outcome: passed/scrapped)
- `ProductionEvent` (id, production_order_id, event_type, qty, payload_json, created_at, created_by) — append-only audit trail for every state change above

**Accounting hook (referenced, not built in Phase 1 finance module, but ledger must support it)**
- Every `FabricLedgerEntry`, `AccessoryLedgerEntry`, and finished-goods movement must be able to emit a costed accounting event for the Finance/Costing Engine module.

---

## 6. Edge Cases (per Apparel Domain Expert review)

| Case | Handling |
|---|---|
| Dye-lot mismatch across rolls for same style | `FabricLot` is the unit of allocation, not `FabricItem` — cutting record pins exact lot(s) used, so color variance is traceable |
| Fabric shrinkage discovered after wash-test | Adjustment ledger entry with `reason_code=shrinkage`, reduces available qty without deleting the original purchase entry |
| Partial production (vendor returns 80 of 100 sent) | `StitchingBatch.received_qty < sent_qty`; difference sits as "in-transit/pending" until explicitly marked short or rejected |
| Rejected units reworked successfully | `ReworkRecord.outcome=passed` feeds qty back into the production order's passed count — does not create a new production order |
| Rejected units scrapped | `ReworkRecord.outcome=scrapped` — qty written off, fabric/accessory cost already consumed is not reversed (sunk cost, visible in costing report as wastage) |
| Multi-vendor split for one production order | One `ProductionOrder` can have multiple `StitchingBatch` rows (different vendors/lots), summed for completion status |
| Fabric returned uncut after cutting cancelled | Inbound `FabricLedgerEntry` with `ref_type=production_order`, `reason_code=cutting_cancelled` — links back for audit |
| Sample fabric/accessory usage | Routed through Sample Management module (separate ledger reason code `sample_consumption`) so it doesn't pollute production costing |
| Concurrent stock issue (two production orders racing for same lot) | DB-level row lock / optimistic concurrency on `FabricLot` during issue; second request fails fast with "insufficient stock in lot" rather than overdrawing |

---

## 7. API Design (representative, not exhaustive)

```
POST   /fabric-items
POST   /fabric-lots                  # GRN — creates lot + purchase ledger entry
GET    /fabric-lots/{id}/balance     # derived, computed from ledger
POST   /fabric-ledger-entries        # issue / return / damage / adjustment

POST   /accessory-items
POST   /accessory-ledger-entries

POST   /production-orders
POST   /production-orders/{id}/cutting-records
POST   /production-orders/{id}/stitching-batches
POST   /stitching-batches/{id}/receive     # records received_qty, rejected_qty
POST   /stitching-batches/{id}/rework
GET    /production-orders/{id}             # full status, all child events
GET    /production-orders/{id}/events      # audit trail

GET    /inventory/fabric/{fabric_item_id}/balance     # SUM(in) - SUM(out), computed
GET    /inventory/accessory/{accessory_item_id}/balance
```

No `PUT /fabric-lots/{id}/quantity` — quantity is never directly mutated, only via ledger entries.

---

## 8. Database Design Notes

- All ledger tables are **append-only**. No UPDATE/DELETE on ledger rows — corrections happen via a new offsetting entry with `reason_code=correction` and `ref_id` pointing to the entry being corrected.
- Current stock = `SELECT SUM(CASE WHEN direction='in' THEN qty ELSE -qty END) FROM ledger WHERE item_id = ?` — materialized as a cached/indexed view for dashboard performance, but source of truth is always the ledger.
- Every ledger entry has `created_by` and `created_at` for audit. None are nullable.
- Foreign keys from ledger entries to `ref_type/ref_id` are polymorphic (production_order, sample, adjustment) — enforced at application layer, not DB FK, since ref target varies.

---

## 9. UI Screens (Phase 1 scope)

1. **Fabric Inventory** — lot list (filterable by fabric item, supplier, dye lot), balance view, "Receive Fabric" form, "Issue/Adjust" form.
2. **Accessory Inventory** — item list with balances, "Receive" / "Issue/Adjust" forms.
3. **Production Order list** — status (cutting/stitching/QC/complete), filter by style/date.
4. **Production Order detail** — single page showing: planned vs actual at every stage (cut → sent → received → rejected → reworked → passed), with inline action buttons to record next event. No navigation away to record a step — this is the "seamless" requirement: actions happen in place on the detail page, not via a separate modal that scrolls the page or loses context.
5. **New Production Order** form — style/SKU breakdown, BOM auto-pulled, planned qty.

UI rule carried into this build (per your earlier feedback on the tags UI): inline edit actions must open in place, anchored to the element being edited — not trigger a scroll-to-top or route change. Apply this standard to every edit/record action in these screens, especially the Production Order detail page where users will be recording many small updates in sequence.

---

## 10. Permissions (Phase 1, simple roles)

- **Owner/Admin** — full access, can edit/correct ledger via offsetting entries.
- **Warehouse staff** — can record receive/issue for fabric & accessories, cannot delete or see costing.
- **Production staff** — can record cutting/stitching/QC events, cannot edit inventory directly.
- **Finance/view-only** — read access to all ledgers and costing reports, no write.

## 11. Reports (Phase 1)

- Current fabric stock by item/lot.
- Current accessory stock by item.
- Fabric consumption vs BOM-planned, per production order (variance report — flags overuse/wastage).
- Production order status board (in cutting / in stitching / at vendor / QC / complete).
- Wastage & rejection report by style/vendor (feeds the Apparel Domain Expert's stated concern about rework/rejection visibility).

## 12. Test Cases (representative)

- Issue fabric qty > available lot balance → rejected with clear error, no partial write.
- Two concurrent issue requests against same lot, combined qty > balance → one succeeds, one fails cleanly.
- Stitching batch received_qty + rejected_qty ≠ sent_qty → allowed (rest is "in transit"), but flagged in report until reconciled.
- Rework outcome=passed correctly increments production order's passed count without creating phantom inventory.
- Adjustment entry with reason_code=damage correctly reduces balance and appears in wastage report.
- Production order with multiple stitching batches across vendors sums correctly to total passed/rejected.
- Ledger entries are immutable — attempting update/delete via API returns 405/403.

## 13. Risks

- "Inventory is calculated, never stored" makes balance queries more expensive at scale — fine for Phase 1 volume, will need materialized/cached balance table well before Phase 3 multi-warehouse.
- Deferring dye-lot tracking decision is safe (no schema cost — see §5), but report design (variance/wastage reports) should be written generically enough that adding lot granularity later doesn't require report rework, only more granular filters.
- SKU = Style with no size/color variant means if you later need size/color-level stock (e.g. "how many size-M left"), that's a breaking schema change, not additive. Flag now: confirm this is genuinely not needed in Phase 1, since retrofitting variants under an existing Style-as-SKU model is more disruptive than building it in from the start.

## 14. Recommendation

All 5 open questions answered — schema updated accordingly (§3, §5). Approved for backend implementation.

Next step: Backend Engineering Agent — migrations + API for these three modules only (no Order Management, Costing Engine, or Dashboard yet). One thing to settle with you before that starts: the SKU-variant risk above — worth a 2-minute confirmation since it's the one decision that's expensive to reverse later.
