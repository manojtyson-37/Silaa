# Phase 1 Architecture — Revision 1 (Architecture Review Board)

Supersedes assumptions in [PHASE1_ARCHITECTURE.md](PHASE1_ARCHITECTURE.md) where noted below. Implementation remains blocked until §FINAL is resolved.

---

## CHANGE 1 — Variant Model (Style → StyleVariant → Inventory)

**1. Business Reason**
Inventory, sales, and stock decisions happen at color/size level, not style level. "Black Co-ord Set, Size M" and "White Co-ord Set, Size S" are different stock-keeping realities — different sell-through, different stock-outs, different reorder points. This also retroactively resolves the risk flagged in the prior revision (§13 of the base doc) — confirmed: variant-level was needed.

**2. Risk if Ignored**
Cannot answer "how many size M black left" without a side system. Forces a breaking migration later, at a point when production orders, ledgers, and reports already reference Style directly — much more expensive to fix post-launch than pre-launch.

**3. Schema Changes**
```
Style        (id, name, category, collection)
StyleVariant (id, style_id, color, size, sku_code [unique], barcode [nullable], selling_price, status)
```
Every inventory, BOM, ledger, and reservation reference that previously pointed to `style_id` now points to `variant_id`, EXCEPT:
- `BOM` stays at `style_id` level (a button/zip/fabric choice is usually shared across all variants of a style) — `BOM` can optionally override at `variant_id` level for cases where, e.g., Black uses different buttons than White (rare, but the schema must allow `variant_id` nullable override without forcing it for every style).
- `ProductionOrder` moves from `style_id` to a planned breakdown of `variant_id → planned_qty` (one production order, many variants — cutting a single fabric lot typically produces a size/color mix in one go).

**4. API Changes**
- New `/style-variants` CRUD, scoped under `/styles/{id}/variants`.
- All `*-ledger-entries`, `cutting-records`, `reservation` endpoints take `variant_id` instead of `style_id`.
- `ProductionOrder` creation payload changes from single `style_id` to `style_id + [{variant_id, planned_qty}]`.

**5. Workflow Changes**
Production order creation now requires a size/color breakdown up front (this was implicitly true already in real operations — cutting always happens per size/color ratio — the old single-style model was hiding real complexity, not removing it).

**6. Reporting Changes**
All stock and sales reports gain a variant dimension. Style-level reports become a `GROUP BY style_id` roll-up over variant rows, not a separate stored value — avoids the "two sources of truth" trap.

**7. Costing Changes**
Cost per unit can now legitimately differ by variant (e.g., White fabric sometimes costs more due to extra processing) — `BOM` variant-override (point 3) is what enables this without forcing every style to model it.

**8. Migration Impact**
Phase 1 hasn't shipped yet — no live data to migrate. This is the right time to make this change; treat it as zero-migration-cost since we're pre-launch.

**9. Recommendation**
Approve. Mandatory before any implementation — this is the correct foundational unit for an apparel business.

---

## CHANGE 2 — Finished Goods Ledger

**1. Business Reason**
Fabric and Accessory ledgers exist; the most important stock — sellable finished goods — currently has no ledger. Sales, returns, damage, sample pulls (photoshoot/influencer) all move FG stock and must be auditable exactly like raw material.

**2. Risk if Ignored**
Finished goods becomes the one inventory class still tracked by spreadsheet/memory — defeats the entire point of the system. Sample/influencer giveaways especially tend to "disappear" without a ledger trail, and owners lose visibility into real available-to-sell stock.

**3. Schema Changes**
```
FinishedGoodsLedgerEntry (
  id, variant_id, txn_type, quantity, direction,
  reference_type, reference_id, created_at, created_by, reason_code
)
```
`txn_type` enum: `production_complete, sale, return, damage, photoshoot_sample, influencer_sample, replacement_order, adjustment, stock_audit`.

**4. API Changes**
```
POST /finished-goods-ledger-entries
GET  /inventory/finished-goods/{variant_id}/balance   # derived, SUM(in)-SUM(out)
```
`production_complete` entries are written automatically by the Production module when a `StitchingBatch`/QC step passes — not manually entered (single source, no duplicate manual entry against the same event).

**5. Workflow Changes**
QC pass step (Production module) now has a required side-effect: write `FinishedGoodsLedgerEntry(txn_type=production_complete)`. This is the join point between Production and Order/Sales modules — must be transactional (QC pass and FG ledger write succeed or fail together).

**6. Reporting Changes**
New report: FG stock by variant, with breakdown by txn_type (how much of current stock came from production vs returns; how much left via sale vs sample/damage).

**7. Costing Changes**
`production_complete` entries should carry per-unit cost (rolled up from fabric+accessory+labor consumed in that production order) so FG inventory valuation is possible — this is the bridge to the Costing Engine module, not built in Phase 1 but the ledger must carry the cost field now or it can't be retrofitted cleanly.

**8. Migration Impact**
None — new entity, no existing data.

**9. Recommendation**
Approve, mandatory. Add `unit_cost` field to the ledger entry now (point 7) even though Costing Engine ships later — cheap to add now, expensive to backfill later.

---

## CHANGE 3 — Inventory Reservation Model

**1. Business Reason**
Physical stock ≠ available-to-sell stock once you have multiple sales channels and non-sale stock uses (exhibitions, photoshoots). Without reservations, Shopify can oversell stock that's actually committed elsewhere.

**2. Risk if Ignored**
Overselling — promising stock to a customer that's physically allocated to an exhibition or already in a pending order. This is a direct revenue/trust risk, not just a bookkeeping gap.

**3. Schema Changes**
```
InventoryReservation (
  id, inventory_type [fabric_lot/accessory_item/style_variant],
  inventory_reference_id, quantity,
  source_type [customer_order/exhibition/photoshoot/influencer/internal_transfer],
  source_id, reservation_status [active/released/consumed/expired],
  expiry_date, created_at
)
```
Available stock formula becomes: `physical_balance(from ledger) - SUM(active reservations)`.

**4. API Changes**
```
POST   /inventory-reservations
PATCH  /inventory-reservations/{id}/release
PATCH  /inventory-reservations/{id}/consume   # converts reservation into actual ledger outbound entry
GET    /inventory/{type}/{id}/available        # physical - reserved, computed
```

**5. Workflow Changes**
Order Management (Phase 1 module, not yet detailed) must create a reservation at order placement, not wait until shipping — otherwise two orders can race for the same last unit. Reservation `consume` is what actually writes the FG ledger outbound entry at fulfillment/ship time.

**6. Reporting Changes**
Dashboard must show physical vs available vs reserved-by-type (e.g., "50 available, 20 reserved for Shopify, 30 for exhibition") — this was the exact example in the request, becomes a first-class report, not a derived afterthought.

**7. Costing Changes**
None directly — reservations don't move cost, only `consume` (which triggers the real ledger entry) does.

**8. Release Rules**
- `expiry_date` auto-releases stale reservations (e.g., abandoned cart holds) via a scheduled job — needs to exist from day one, not bolted on later, or "phantom reservations" silently lock stock forever.
- Manual release allowed by Owner/Admin and Production/Warehouse roles for their respective reservation types.
- `consume` is the only path that decrements ledger-level physical stock; `release` only frees the reservation, never touches the ledger.

**9. Recommendation**
Approve. This is what makes "available stock" trustworthy across channels — directly serves the Phase 1 success criterion "owner can stop using Excel," since reservation conflicts are exactly what Excel/WhatsApp coordination currently fails at.

---

## CHANGE 4 — BOM Versioning

**1. Business Reason**
BOMs change over the life of a style (supplier swaps a button, a cheaper trim is substituted). A production order placed in March used Button A; one in June uses Button B. Costing and audit must reflect what was *actually* used in each order, not today's BOM.

**2. Risk if Ignored**
Historical costing silently becomes wrong every time a BOM changes — March's margin report would (incorrectly) compute using June's components. This directly violates the Finance Agent's mandate that profitability be accurate per SKU/order.

**3. Schema Changes**
```
BOM         (id, style_id, variant_id [nullable, see Change 1], active_version_id)
BOMVersion  (id, bom_id, version_no, effective_from, effective_to [nullable], created_at)
BOMItem     (id, bom_version_id, component_type [fabric/accessory], component_id, qty_per_unit, uom)
```
`ProductionOrder` gains `bom_version_id` (set at creation, immutable after) — this is what "retains original BOM" means concretely.

**4. API Changes**
```
POST /styles/{id}/bom-versions          # creates new version, does not edit old one
PATCH /bom-versions/{id}/activate       # sets as the version new production orders default to
GET  /production-orders/{id}            # includes bom_version_id used, resolvable to exact components
```
No `PUT /bom-items/{id}` — BOM items are immutable once a version is created; corrections happen via a new version, same append-only philosophy as the ledgers.

**5. Workflow Changes**
Creating a Production Order locks in `bom_version_id = BOM.active_version_id` at that moment. Activating a new BOM version never retroactively changes open production orders.

**6. Reporting Changes**
Costing/variance reports must join through `production_order.bom_version_id`, never through `BOM.active_version_id` — otherwise historical reports drift as BOMs change. This is the same bug class as Change 2's `unit_cost` point: capture the value at the time of the event, don't recompute from "current" state later.

**7. Costing Changes**
This is the direct enabler of accurate per-order costing — without it, Change 2's `unit_cost` rollup has no stable component-cost basis to compute from.

**8. Migration Impact**
None pre-launch. Note for future: when a BOM changes, old `BOMVersion` rows are never deleted — versioning has no cleanup step by design (small table, audit value outweighs storage cost).

**9. Recommendation**
Approve, mandatory — directly required by the non-negotiable "every financial movement creates an accounting event" rule; without versioning that event would reference a moving target.

---

## CHANGE 5 — Expanded QC States

**1. Business Reason**
Binary pass/reject loses real distinctions: a slightly-flawed garment might be sellable at a discount (second sale), reworkable, scrap, or held pending a decision (e.g., waiting on customer-specific quality bar).

**2. Risk if Ignored**
"Reject" becomes a catch-all that hides whether the unit still has recoverable value (second-sale) or is a total write-off (scrap) — costing and inventory both become less accurate, and warehouse staff have no correct bucket to put borderline units in (so they'll default to whatever's easiest, polluting data).

**3. Schema Changes**
`StitchingBatch`/QC result field changes from `pass/reject` enum to:
```
qc_state: PASS | REWORK | SECOND_SALE | SCRAP | HOLD
```
`SECOND_SALE` units need a `StyleVariant`-equivalent "grade B" channel — simplest Phase 1 approach: same `variant_id`, FG ledger entry with `reason_code=second_sale_grade`, sold through a separate discounted listing (not a new variant entity — avoids combinatorial explosion of grade × size × color).

**4. API Changes**
`POST /stitching-batches/{id}/qc` payload takes `qc_state` per unit/lot instead of binary pass/fail; `HOLD` units don't move to FG or get scrapped — they sit in a pending bucket requiring explicit resolution (no auto-timeout, since this is a judgment call, unlike reservation expiry).

**5. Workflow Changes**
- `PASS` → FG ledger (Change 2), as before.
- `REWORK` → existing `ReworkRecord` flow.
- `SECOND_SALE` → FG ledger with discount-grade flag, available for sale at reduced price.
- `SCRAP` → write-off, no FG entry, cost stays sunk (per original edge-case table).
- `HOLD` → no ledger movement until manually resolved to one of the other four states.

**6. Reporting Changes**
QC outcome report gains 5-way breakdown instead of 2-way — directly serves the wastage/rejection visibility goal already in the base doc's report list.

**7. Costing Changes**
`SECOND_SALE` units carry full production cost but sell at reduced price — margin report must show this as a distinct (lower-margin) revenue line, not blended into normal-grade sales, or it silently drags down average margin in a way that's hard to diagnose.

**8. Migration Impact**
None pre-launch.

**9. Recommendation**
Approve.

---

## CHANGE 6 — UOM Conversion Engine

**1. Business Reason**
Fabric purchased by the roll, consumed by the meter; accessories purchased by the box/dozen, consumed by the piece. Without conversion, either purchasing or consumption units have to be forced to match (loses real-world purchasing units) or every report has unit-mismatch bugs.

**2. Risk if Ignored**
Either silent unit-mismatch bugs (treating "1 roll" as "1 meter" in a sum) or operational friction (forcing warehouse staff to do mental math converting dozens to pieces on every entry).

**3. Schema Changes**
```
UnitOfMeasure   (id, code, name, category [length/weight/count])
UOMConversion   (id, from_uom_id, to_uom_id, factor)   # e.g., Roll → Meter, factor = roll length
```
`FabricLot` and `AccessoryItem` gain `purchase_uom_id` and `consumption_uom_id`; ledger entries always store quantity in `consumption_uom_id` (the normalized unit), converting at entry time using the applicable `UOMConversion` factor. Conversion factor is captured at write time on the ledger entry itself (not re-derived later) — same "freeze the value at the time of the event" principle as Changes 2 and 4.

**4. API Changes**
```
POST /uom
POST /uom-conversions
```
GRN (`POST /fabric-lots`) accepts `received_qty` in `purchase_uom`, system converts and stores `consumption_uom` qty on the ledger entry, retaining both for display.

**5. Workflow Changes**
Warehouse staff enters quantities in whatever unit the supplier invoice uses (rolls, dozens); system handles conversion invisibly — directly serves the base doc's UI principle "assume users are not technical."

**6. Reporting Changes**
All consumption/variance reports normalize to `consumption_uom` automatically — no per-report conversion logic needed since it's baked into the ledger entry.

**7. Costing Changes**
Cost-per-unit must also respect UOM — `cost_per_uom` on `FabricLot` should be cost per `consumption_uom`, derived from PO price ÷ converted quantity, computed once at GRN time and stored (not recomputed live).

**8. Migration Impact**
None pre-launch, but this must ship in Phase 1 v1, not retrofitted — every fabric/accessory ledger entry from day one needs the conversion fields populated, or historical entries become ambiguous about which unit they're in.

**9. Recommendation**
Approve, mandatory for Phase 1 launch (not deferrable) — Phase 1's own Fabric/Accessory modules are unusable correctly without it given real purchasing units always differ from consumption units.

---

## CHANGE 7 — Remove Style as Inventory Unit

**1. Business Reason**
Direct consequence of Change 1 — inventory must live at Fabric Lot, Accessory Item, and Style Variant only. Style itself is a grouping/reporting concept, never a stock-holding entity.

**2. Risk if Ignored**
Two parallel "truths" about stock (style-level vs variant-level) — guaranteed to drift and produce the exact "spreadsheet didn't match reality" problem this system exists to kill.

**3. Schema Changes**
No `quantity`, `balance`, or stock field anywhere on `Style`. Already consistent with Change 1's design — this change is the explicit guard-rail stating it, not a new structure.

**4. API Changes**
No `GET /styles/{id}/balance` endpoint — only `GET /style-variants/{id}/balance`. Style-level totals are always a computed aggregation in the response layer/report, never a stored or directly-queryable field.

**5. Workflow Changes**
None beyond Change 1 — this is a constraint on Change 1, not a new workflow.

**6. Reporting Changes**
Style roll-up reports must be explicitly labeled as aggregates (e.g., "Total across all variants") so nobody mistakes a summed number for a stock-holding entity.

**7. Costing Changes**
None beyond Change 1/4.

**8. Migration Impact**
None.

**9. Recommendation**
Approve — formalizes Change 1, no independent schema cost.

---

## CHANGE 8 — Review Polymorphic References (`reference_type`/`reference_id`)

**1. Business Reason / Question posed**
Whether `reference_type` + `reference_id` (used across all ledgers for linking to production orders, samples, adjustments, etc.) remains acceptable long-term, given it bypasses DB-level foreign-key integrity.

**Tradeoffs**

| Approach | Pros | Cons |
|---|---|---|
| Polymorphic `reference_type`/`reference_id` (current) | Simple, one column pair handles all ref types, easy to add new ref types without migration | No DB-level FK integrity — a typo'd `reference_id` silently orphans, only caught at query time; harder to `JOIN` cleanly |
| Separate nullable FK column per ref type (`production_order_id`, `sample_id`, `adjustment_id`, all nullable) | Full FK integrity, clean joins | Schema grows a column per new reference type, most rows have many NULLs, adding a ref type is now a migration |
| Junction/event table per relationship | Cleanest normalized form | Significant added complexity for what's a relatively small number of reference types in Phase 1 |

**Recommendation**
Keep polymorphic references for Phase 1 — the team is small, reference types are few (production_order, sample, adjustment, reservation), and the simplicity directly serves "simplicity before scalability" (core principle #5). Mitigate the integrity gap with: (a) application-layer validation that `reference_id` exists for the given `reference_type` before insert, (b) a periodic integrity-check report (orphaned reference detector) rather than DB constraints. Revisit nullable-FK-columns approach only if reference types grow past ~6-8 or orphan-reference bugs actually occur in practice — don't pre-build for a problem not yet observed.

---

## CHANGE 9 — Review Production Event Payload Design (`payload_json`)

**1. Business Reason / Question posed**
Whether `payload_json` (free-form JSON on `ProductionEvent`) should instead be structured columns, full event sourcing, or typed metadata.

**Analysis**
- **Structured columns**: best for known, stable event types (cutting, stitching, QC) — but Phase 1 already has dedicated tables for those (`CuttingRecord`, `StitchingBatch`, `ReworkRecord`). `ProductionEvent` as currently scoped is the *audit trail*, not the primary record — its job is "what happened, when, by whom," referencing the real structured record via `ref_type/ref_id` (same pattern as Change 8).
- **Full event sourcing** (rebuilding state purely by replaying events): substantial added complexity — would mean `ProductionOrder` status is *never* directly stored, always derived by replaying its event log. This is the kind of architecture that pays off at far higher event volume/complexity than a single-brand Phase 1 ERP has. Rejected for now — violates "simplicity before scalability."
- **Typed metadata** (a fixed JSON schema per `event_type`, validated at the application layer): right middle ground — keep `payload_json` but define and validate a schema per `event_type` in application code (not DB-enforced), so the audit trail stays queryable-enough for "what changed" without the all-or-nothing jump to full event sourcing.

**Recommendation**
Keep `payload_json`, but: (a) treat `ProductionEvent` strictly as an audit/log table that *references* the structured tables (`CuttingRecord` etc.) rather than being the source of truth itself, (b) define per-`event_type` payload shapes in application code with validation, documented in the Documentation Agent's API docs, (c) revisit event-sourcing only if a future requirement needs full state reconstruction at any point in time — not needed for Phase 1's stated success criteria.

---

## FINAL — Architecture Readiness

| Dimension | Score /10 | Note |
|---|---|---|
| Inventory Architecture | 8 | Variant model + FG ledger + reservations close the major gaps. UOM conversion still needs careful implementation discipline. |
| Production Architecture | 8 | BOM versioning + 5-state QC + event audit trail are solid. Multi-vendor split already handled in base doc. |
| Scalability | 6 | Deliberately Phase-1-scoped (calculated balances, polymorphic refs) — adequate now, will need revisit at Phase 3 multi-warehouse, flagged honestly rather than over-built today. |
| Apparel Domain Fit | 9 | Variant model, dye-lot deferral path, second-sale grade, rework loop all map to real apparel operations. |
| Financial Readiness | 7 | BOM versioning + frozen unit_cost/conversion-factor-at-write-time give Costing Engine a real foundation; Costing Engine module itself isn't built yet (correctly out of Phase 1 scope per phasing). |
| Multi-Channel Readiness | 7 | Reservation model directly supports it; Order Management module (not yet detailed) still needs to be designed to actually consume reservations correctly. |

**Implementation Approval Decision: Approved with Minor Changes**

Remaining items before backend work starts (not architecture blockers, but must be settled):
1. Confirm whether `BOM` variant-level override (Change 1, point 3) is needed at Phase 1 launch or can wait — affects whether `BOMItem` needs `variant_id` from day one.
2. Order Management module (referenced by Change 3's reservation consume/release workflow) hasn't been architected yet — needed before Order Management implementation, not before Fabric/Accessory/Production implementation, so it doesn't block starting backend work on the three approved modules.
3. Confirm second-sale channel mechanics (Change 5) — same listing at discount, or a distinct "outlet" sales channel — affects Order Management design later, not Phase 1 backend modules now.

None of these block starting Fabric Inventory / Accessory Inventory / Production Management backend implementation — they block Order Management and Costing Engine, which come later in the phase anyway.
