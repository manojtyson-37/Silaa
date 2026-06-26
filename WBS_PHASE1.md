# Phase 1 Work Breakdown Structure — Multi-Agent Execution Plan

Source: [PHASE1_ARCHITECTURE.md](PHASE1_ARCHITECTURE.md) + [PHASE1_ARCHITECTURE_REVISION_1.md](PHASE1_ARCHITECTURE_REVISION_1.md) (approved with minor changes) + [FINAL_READINESS_REVIEW.md](FINAL_READINESS_REVIEW.md) (4 blocking items folded in below: `warehouse_id` in E0, new E0.5 PO module, API-contract step in E0's infra, infra baseline before E0).

**File ownership convention (applies to every epic below):** each epic owns exactly one module folder. "Forbidden" means the agent must not edit those paths even if it seems convenient — cross-module needs go through the other module's public service/API layer, opened as a request to that module's owning agent, never a direct edit.

Program Manager note: this PM does not write code. This WBS exists to let multiple AI coding agents work in parallel without colliding. File-boundary ownership (§8) is the primary mechanism for avoiding merge conflicts — each agent owns a distinct set of files/folders; nobody edits another agent's boundary without a handoff.

---

## 0. Epic Map

| Epic | Owns | Blocks |
|---|---|---|
| E0 — Core Ledger Infra + Warehouse | Shared ledger base, `Warehouse` table | Everything (E0.5–E6) |
| E0.5 — Minimum Viable Procurement | `Supplier`, `PurchaseOrder`, `PurchaseOrderLine` | E2 Feature A, E3 Feature A |
| E1 — UOM Conversion Engine | `UnitOfMeasure`, `UOMConversion` | E2, E3 |
| E2 — Fabric Inventory | `FabricItem`, `FabricLot`, `FabricLedgerEntry`, `LandedCostEntry` | E5 (cutting needs fabric lots) |
| E3 — Accessory Inventory | `AccessoryItem`, `AccessoryLedgerEntry` | E5 (consumption needs accessory items) |
| E4 — Style/Variant + BOM Versioning | `Style`, `StyleVariant`, `BOM`, `BOMVersion`, `BOMItem` | E5, E6 |
| E5 — Production Management | `ProductionOrder`, `CuttingRecord`, `StitchingBatch`, `ReworkRecord`, `ProductionEvent`, QC states | E6 |
| E6 — Finished Goods Ledger | `FinishedGoodsLedgerEntry` | (terminal for Phase 1; Order Mgmt/Reservations consume it later, out of this WBS's scope per architecture §FINAL item 2) |
| E7 — Inventory Reservation | `InventoryReservation` | Deferred — not required to ship E2/E3/E5/E6; build only if Order Mgmt work starts (architecture §FINAL flagged this as non-blocking) |
| EX — QA Harness | Test stubs/fixtures for all epics | Runs *ahead of* implementation, not after |
| ED — Documentation | API docs, schema docs | Runs *alongside* implementation, not after |

**Dependency chain (hard order):** E0 → {E0.5, E1} → {E2, E3} → E4 → E5 → E6. E7 is a side branch, not on the critical path. EX and ED run continuously across all epics, not as a final phase. Infra baseline (docker-compose, migration tool choice, backup job, OpenAPI-from-code + CI diff check) stands up in parallel with E0, owned by ops — see [FINAL_READINESS_REVIEW.md](FINAL_READINESS_REVIEW.md) §5/§4, blocking nothing functionally but must exist before E0's first migration is written.

---

## 1. E0 — Core Ledger Infrastructure

**Feature: Append-only ledger base + Warehouse**
- Context: every ledger table in this system (fabric/accessory/FG) must share one immutable, auditable pattern, and per [FINAL_READINESS_REVIEW.md](FINAL_READINESS_REVIEW.md) §1, every ledger table must carry `warehouse_id` from day one even though Phase 1 has exactly one warehouse — retrofitting it onto live ledger data later requires a manual stock-attribution exercise, not just a migration.
- User Story: As a backend agent building any ledger table, I need a shared base pattern (immutable rows, no UPDATE/DELETE, `created_by`/`created_at`/`warehouse_id` required, `reason_code` enum support) so every ledger is structurally identical and auditable the same way.
- Acceptance Criteria:
  - Migration framework enforces no UPDATE/DELETE grants on ledger tables at DB role level.
  - Shared `direction` enum (`in`/`out`) and balance-computation helper (`SUM(in)-SUM(out)`, scoped by `warehouse_id`) implemented once, imported by every ledger module — not copy-pasted per module.
  - Polymorphic `reference_type`/`reference_id` helper includes app-layer existence validation (per architecture Change 8 mitigation).
  - `Warehouse(id, name)` table exists, seeded with exactly one row; every ledger table has non-nullable `warehouse_id` FK defaulted to that seed row.
  - Index on `(item_or_lot_or_variant_id, warehouse_id, created_at)` on every ledger table (per readiness review §7 — required now, not deferred).
- Files Owned: `core/ledger_base/**`, `core/warehouse/**`, root migration files for shared enums + `Warehouse` table.
- Files Forbidden to Modify: any `fabric_inventory/**`, `accessory_inventory/**`, `finished_goods/**` (those don't exist yet, but once created, E0 must not reach into them — only the reverse, those modules import from `core/`).
- Required Inputs: Revision 1 Change 8, base doc §8, Readiness Review §1 and §7.
- Expected Outputs: `core/ledger_base` module (model mixin + balance query helper + ref-validator), `core/warehouse` module, migration for shared enums + Warehouse table + seed.
- Tests Required: unit test for balance helper (in/out sum correctness); migration test confirming no UPDATE/DELETE grant on a ledger table; seed test confirming exactly one Warehouse row exists post-seed.
- Definition of Done: helper functions + base migration + Warehouse table merged, all tests above passing, zero ledger-specific logic inside the base (must be generic across fabric/accessory/FG — verified by E2/E3 review per §4 note below).
- Blocking Dependencies: none — first thing built.
- Review Checklist: no module-specific fields leaked into base; balance helper is read-only (no caching/materialized-view logic yet — that's an optimization for later, not now per Readiness Review §7).

---

## 1.5 — E0.5 — Minimum Viable Procurement (new, per Readiness Review §2)

**Feature: Purchase Order + Line, partial-receipt support**
- Context: `FabricLot.po_id` and `AccessoryItem` GRN both reference a PO, but no PO entity exists in the approved architecture — this was a real gap, not a deferred nice-to-have, since `po_id` is already load-bearing.
- Story: As a buyer, I raise a PO with line items; GRN against a line tracks partial receipts naturally via "ordered minus received-so-far," no separate partial-receipt entity needed.
- AC:
  - `POST /purchase-orders` with `[{component_type, component_id, ordered_qty, ordered_uom, agreed_price}]` lines.
  - GRN endpoints (E2/E3) accept `po_line_id`, compute outstanding qty as `ordered_qty - SUM(received against this line)`.
  - PO status transitions: draft → approved → partially_received → closed/cancelled. No multi-step approval workflow — single approver action (owner), matching real team size.
  - Explicitly out of scope: Supplier Management UI beyond a flat `Supplier` reference table, invoice upload (defer to a flat attachment field, addable anytime without schema risk).
- Files Owned: `procurement/**`, migration for `PurchaseOrder`/`PurchaseOrderLine`/`Supplier`.
- Files Forbidden to Modify: `fabric_inventory/**`, `accessory_inventory/**` (those modules call into `procurement`'s service layer to resolve `po_line_id`, never reach into its tables directly).
- Required Inputs: Readiness Review §2.
- Expected Outputs: `procurement` module (models, migrations, minimal API).
- Tests Required: partial receipt test (PO line ordered 500m, receive 320m, outstanding correctly 180m); status transition test (draft cannot receive GRN, must be approved first).
- Definition of Done: E2/E3's GRN features can resolve a real `po_line_id` against this module without a dangling reference.
- Blocking Dependencies: E0 (uses shared ledger/warehouse base). Blocks: E2 Feature A, E3 Feature A (their GRN now depends on a real `po_line_id`).

---

## 2. E1 — UOM Conversion Engine

**Feature: UOM + Conversion**
- Story: As a warehouse user, I enter fabric in rolls and accessories in dozens; the system stores/reports in a normalized consumption unit so I never do unit math.
- AC:
  - `POST /uom`, `POST /uom-conversions` work; conversion factor captured at ledger-entry write time, not recomputed later.
  - GRN endpoint accepts `purchase_uom`, converts to `consumption_uom`, stores both.
  - Missing conversion factor for a given from/to pair → entry rejected with clear error, not silently stored unconverted.
- DoD: conversion math unit-tested with at least roll→meter and dozen→piece cases; GRN integration test confirms stored quantity is in consumption_uom.
- Files Owned: `uom/**`.
- Files Forbidden to Modify: `fabric_inventory/**`, `accessory_inventory/**` (they call `uom`'s conversion service, never compute conversion math themselves).
- Tests Required: unit tests above + missing-conversion-factor rejection test.
- Blocking Dependencies: E0.
- Required Inputs: Revision 1 Change 6.
- Expected Outputs: `uom` module (models + conversion service), migration.
- Review Checklist: conversion factor stored on the ledger entry itself (frozen at write time), not just looked up live at report time.

---

## 3. E2 — Fabric Inventory

**Feature A: Fabric master data + GRN**
- Story: As warehouse staff, I record fabric received against a PO with optional dye-lot, so stock starts existing in the system.
- AC: `POST /fabric-items`, `POST /fabric-lots` create lot + purchase ledger entry atomically; `dye_lot_no` nullable; `cost_per_uom` = PO price only (landed costs separate).
- DoD: GRN creates exactly one lot + one ledger entry in one transaction; balance query returns correct qty immediately after.

**Feature B: Fabric issue/return/adjustment**
- Story: As production staff, I issue fabric to a production order and return unused fabric, with damage/shrinkage trackable separately.
- AC: issue fails cleanly if qty > lot balance (no partial write); concurrent issue requests against the same lot — one succeeds, one fails (row-lock or optimistic concurrency per architecture edge case table).
- DoD: concurrency test (two simultaneous issue requests, combined > balance) passes deterministically.

**Feature C: Landed cost entries**
- Story: As finance/admin, I record freight/customs/handling against a fabric lot without it polluting `cost_per_uom`.
- AC: `LandedCostEntry` linked to `fabric_lot_id`, visible in lot detail, excluded from `cost_per_uom` calculation.
- DoD: lot detail view shows PO cost and landed cost as separate line items.

Files Owned: `fabric_inventory/**`.
Files Forbidden to Modify: `core/**`, `uom/**`, `procurement/**`, `accessory_inventory/**` — call their service layers, never edit their tables/files directly.
Tests Required: GRN atomicity test, insufficient-balance rejection test, concurrent-issue test (two simultaneous issues summing > balance, one fails), landed-cost-excluded-from-cost_per_uom test.
Blocking Dependencies: E0, E0.5, E1.
Required Inputs: base doc §5/§7/§8, Revision 1 Change 1 (cost_per_uom note), Change 6 (UOM), Readiness Review §2 (po_line_id).
Expected Outputs: `fabric_inventory` module (models, migrations, API routes).
Review Checklist: no direct quantity mutation path exists anywhere in this module (grep for any UPDATE on lot quantity field — should not exist).

---

## 4. E3 — Accessory Inventory

**Feature A: Accessory master + GRN**
- Story: As warehouse staff, I receive accessories (buttons, zips, labels) per-unit against a PO.
- AC: `POST /accessory-items`, ledger entry created on receive; per-unit consumption only (architecture-confirmed, no per-batch path needed).
- DoD: same atomicity guarantee as Fabric GRN.

**Feature B: Accessory issue/adjustment**
- Story: As production staff, I issue accessories to a production order; damaged/defective accessories get written off separately.
- AC: same insufficient-balance and concurrency guarantees as Fabric.
- DoD: concurrency + insufficient-balance tests pass.

Files Owned: `accessory_inventory/**`.
Files Forbidden to Modify: `core/**`, `uom/**`, `procurement/**`, `fabric_inventory/**`.
Tests Required: GRN atomicity test, insufficient-balance rejection test, concurrent-issue test — same suite shape as E2, deliberately, so drift between the two is visible at test-review time.
Blocking Dependencies: E0, E0.5, E1.
Required Inputs: base doc §5/§7/§8, Readiness Review §2 (po_line_id).
Expected Outputs: `accessory_inventory` module.
Review Checklist: same immutability check as E2 — this module is structurally near-identical to Fabric, verify no copy-paste drift introduced subtle inconsistency (e.g., different error message format) between the two.

**Note for the executing agent:** E2 and E3 share ~80% of their shape (master item + lot/item + ledger + GRN + issue/adjust). Build E0's ledger base generically enough that E2 and E3 are thin modules on top of it, not two parallel hand-written ledger implementations. This is the single biggest review item for E0's design — verify before E2/E3 start.

---

## 5. E4 — Style/Variant + BOM Versioning

**Feature A: Style + StyleVariant**
- Story: As a merchandiser, I define a style and its color/size variants, each independently trackable.
- AC: `StyleVariant.sku_code` unique; no quantity/balance field anywhere on `Style` or `StyleVariant` model itself (computed only, per Change 7).
- DoD: schema review confirms zero stock-holding fields on Style/StyleVariant tables.

**Feature B: BOM + BOMVersion + BOMItem**
- Story: As a merchandiser, I define what fabric/accessories a style needs, and can update it later without losing what older production orders actually used.
- AC: `POST /styles/{id}/bom-versions` creates new version, never edits prior version's `BOMItem` rows; `PATCH /bom-versions/{id}/activate` doesn't touch open production orders' `bom_version_id`.
- DoD: test confirms activating a new BOM version leaves an already-created (but not yet completed) production order's `bom_version_id` unchanged.

Files Owned: `style_variant/**`, `bom/**`.
Files Forbidden to Modify: `fabric_inventory/**`, `accessory_inventory/**` (reference their item IDs via FK only, never their internal logic).
Tests Required: unique sku_code constraint test; BOM-version-immutability test (activating new version doesn't alter prior version's BOMItem rows); zero-stock-field-on-Style schema assertion test.
Blocking Dependencies: E0, E2 (BOMItem references FabricItem), E3 (references AccessoryItem).
Required Inputs: Revision 1 Changes 1, 4, 7.
Expected Outputs: `style_variant` module, `bom` module.
Review Checklist: confirm `BOMItem` variant-level override field exists but defaults to style-wide (per architecture's open item #1 — build the field now, decide usage policy later, don't block on the open question).

---

## 6. E5 — Production Management

**Feature A: Production Order creation**
- Story: As a planner, I create a production order against a style with a variant breakdown (qty per size/color), which locks in the active BOM version.
- AC: `POST /production-orders` requires `[{variant_id, planned_qty}]`; `bom_version_id` set once at creation, immutable after.
- DoD: test confirms `bom_version_id` doesn't change even if BOM is re-activated mid-order.

**Feature B: Cutting**
- Story: As production staff, I record fabric issued and pieces cut, capturing wastage.
- AC: `CuttingRecord` links to specific `fabric_lot_id`; triggers Fabric ledger outbound entry (E2 dependency).
- DoD: cutting record + fabric ledger entry created atomically.

**Feature C: Stitching + multi-vendor split**
- Story: As production staff, I send cut pieces to one or more vendors (or in-house), and record what comes back.
- AC: `StitchingBatch` supports `vendor_id` nullable + in-house flag; multiple batches per production order sum correctly to total status.
- DoD: test with 2 vendors on one production order; status rollup correct.

**Feature D: QC with 5 states**
- Story: As QC staff, I grade received units as PASS/REWORK/SECOND_SALE/SCRAP/HOLD.
- AC: PASS triggers FG ledger entry (E6 dependency); SECOND_SALE triggers FG ledger entry with discount-grade flag; SCRAP writes off with no FG entry; HOLD blocks until manually resolved.
- DoD: all 5 paths integration-tested, including the QC-pass→FG-ledger-write being one atomic transaction (per architecture Change 2 point 5).

**Feature E: Rework loop**
- Story: As QC staff, I send REWORK units back through stitching without creating a phantom new production order.
- AC: `ReworkRecord` qty feeds back into the same production order's passed count.
- DoD: test confirms no duplicate inventory created by a rework cycle.

**Feature F: Production Event audit trail**
- Story: As an auditor, I can see every state change for a production order in order.
- AC: `ProductionEvent` written on every transition above, referencing the structured record (not duplicating its data) per Revision 1 Change 9.
- DoD: event log for a test production order shows complete, ordered history matching the actual record changes.

Files Owned: `production/**`.
Files Forbidden to Modify: `fabric_inventory/**`, `accessory_inventory/**`, `style_variant/**`, `bom/**`, `finished_goods/**` (Feature D calls `finished_goods`'s write API for the QC-pass side-effect, never writes to its tables directly).
Tests Required: bom_version_id immutability test, multi-vendor split rollup test, all-5-QC-states integration test, QC-pass+FG-ledger-write atomicity test (forced failure mid-transaction must roll back both sides), rework-no-phantom-inventory test, production-event-log completeness test.
Blocking Dependencies: E0, E2, E3, E4.
Required Inputs: base doc §4.3/§5/§6, Revision 1 Changes 1, 4, 5, 9.
Expected Outputs: `production` module.
Review Checklist: verify QC-pass-to-FG-ledger write is transactional (highest-risk atomicity point in the whole system — a partial failure here means a unit exists physically but not in any ledger, or vice versa).

---

## 7. E6 — Finished Goods Ledger

**Feature: FG Ledger + balance**
- Story: As anyone needing sellable stock visibility, I can see FG balance by variant, broken down by how it moved (production/sale/return/damage/sample/etc).
- AC: `FinishedGoodsLedgerEntry` supports all 9 txn_types from Revision 1 Change 2; `unit_cost` captured at `production_complete` write time (rolled up from BOM version + fabric/accessory consumption).
- DoD: production_complete entry's `unit_cost` matches manual recomputation from the production order's actual consumption — verified by integration test, not just unit test of the formula in isolation.

Files Owned: `finished_goods/**`.
Files Forbidden to Modify: `production/**` (E5 calls into this module's write API; this module never reaches back into E5's tables).
Tests Required: unit_cost-rollup-matches-actual-consumption integration test (the highest-value test in this epic — verifies the cost figure isn't just internally consistent but actually correct against real BOM+ledger data), no-manual-production_complete-entry-path test.
Blocking Dependencies: E0, E5 (production_complete entries are written by E5's QC-pass step).
Required Inputs: Revision 1 Change 2.
Expected Outputs: `finished_goods` module.
Review Checklist: confirm no manual-entry path exists for `production_complete` (must only be system-written from E5, per architecture point 4 — "not manually entered, single source").

---

## 8. Delivery Sequence & Parallelization

```
Week 0:  Infra baseline (docker-compose, migration tool, backups, OpenAPI+CI diff check) — parallel with E0, ops-owned
Week 1:  E0 (solo, blocks all)
Week 1.5: E0.5 (Minimum Viable Procurement) ─┬─ E1 (UOM, parallel with E0.5 — different files)
Week 2:  E2 ─┬─ EX(test stubs for E2/E3) ─┬─ ED(schema docs)
         E3 ─┘  [E2, E3 fully parallel — distinct modules, no shared files beyond E0/E0.5/E1]
Week 3:  E4  [depends on E2+E3 completing — BOMItem FKs need those tables to exist]
Week 4:  E5  [depends on E4]
Week 5:  E6  [depends on E5]
ongoing: EX and ED run inside every week above, not appended at the end
E7: only triggered if/when Order Management work begins — not scheduled in this WBS
```

**Parallelization opportunities:**
- E2 and E3 are fully parallel (different agents, zero shared files outside E0/E1 — verified in §6's "Note for executing agent").
- Within E5, Features B/C (cutting, stitching) for *different* production orders are parallel-safe; Features A and F (creation, audit log) are append-only and don't lock anything, so multiple agents can work on different production orders simultaneously without contention.
- EX (QA) and ED (Documentation) run continuously, not as a final phase — test stubs for E2 should exist *before* E2's implementation starts, generated directly from this WBS's Acceptance Criteria.

**Minimizing merge conflicts:** each epic owns its own module folder (`core/`, `uom/`, `fabric_inventory/`, `accessory_inventory/`, `style_variant/`, `bom/`, `production/`, `finished_goods/`). No epic edits another epic's folder — cross-module calls go through the other module's public API/service layer, never direct DB/model access. This is the actual conflict-avoidance mechanism, not branch discipline alone.

---

## 9. AI Agent Ownership

| Module | Suggested Agent | Why |
|---|---|---|
| E0 Core Ledger Infra + Warehouse | Claude Code | Foundational, cross-cutting correctness-critical — needs careful generic design (per §4 note) before others build on it. |
| E0.5 Minimum Viable Procurement | Codex | Self-contained, narrow scope (PO + line + partial receipt), good fit for a focused agent in parallel with E1. |
| Infra baseline (Docker/CI/migration tool/backups/OpenAPI) | Ops persona / Antigravity | Not a feature epic — environment + process setup, runs before/alongside E0, owned outside the feature-module boundary entirely. |
| E1 UOM Engine | Codex | Self-contained, narrow scope, well-defined math — good fit for a focused agent. |
| E2 Fabric Inventory | Claude Code | Most complex module (dye-lot deferral, landed cost), benefits from same agent family as E0 for consistency. |
| E3 Accessory Inventory | Codex (or Cursor) | Structurally near-identical to E2 — different agent forces it to follow E0's contract explicitly rather than copy E2's code, catching base-infra gaps early. |
| E4 Style/Variant + BOM | Cursor | IDE-native refactor-heavy work (versioning, immutability rules) suits an agent with strong in-editor diff review. |
| E5 Production Management | Claude Code | Highest-risk atomicity requirements (QC→FG transaction) — keep on the most capable agent. |
| E6 Finished Goods Ledger | Claude Code | Tightly coupled to E5's atomicity guarantee — same agent reduces handoff risk at the riskiest integration point. |
| EX QA Harness (all modules) | Antigravity | Dedicated test-generation agent running ahead of each module's implementation, working from this WBS's AC sections directly. |
| ED Documentation (all modules) | Antigravity (or Codex) | Generates API/schema docs alongside each module's merge, not after — triggered by each module's PR, not scheduled separately. |

Reassign freely — the binding constraint is module-folder ownership (§8), not which specific agent brand executes which folder.

---

## 10. Review Checklist (applies to every deliverable above)

- No direct quantity mutation outside a ledger write, anywhere.
- Every cost/conversion/BOM-version value is frozen at write time, never recomputed live from "current" state.
- Cross-module access goes through service/API layer, never direct model import across module folders.
- Every ledger-writing transaction that has a paired side-effect (QC pass → FG entry; GRN → purchase entry) is atomic — both succeed or both fail.
- Test stub for a feature exists before that feature's implementation PR is opened.
