# Phase 1 — Implementation Factory: Task Breakdown

Frozen inputs: [PHASE1_ARCHITECTURE.md](PHASE1_ARCHITECTURE.md), [PHASE1_ARCHITECTURE_REVISION_1.md](PHASE1_ARCHITECTURE_REVISION_1.md), [FINAL_READINESS_REVIEW.md](FINAL_READINESS_REVIEW.md), [WBS_PHASE1.md](WBS_PHASE1.md). No architecture changes here — this is execution decomposition only. Any task that seems to need an architecture change must stop and raise a change request, not improvise.

Task ID convention: `<EPIC>-T<n>` for infra/core/procurement/uom, `<EPIC>-F<feature>-T<n>` for feature-bearing epics.

---

# 1. INFRASTRUCTURE

## INFRA-T1 — Docker-compose baseline
**Context:** Every AI agent (Claude Code, Codex, Cursor, Antigravity) must run an identical environment or "works on my agent" bugs are guaranteed (Readiness Review §5).
**Module Ownership:** Allowed: `infra/docker/**`, root `docker-compose.yml`. Forbidden: any module folder (`core/`, `fabric_inventory/`, etc. don't exist yet — this task creates none of them).
**Inputs:** None — first task in the project.
**Outputs:** `docker-compose.yml` (app + Postgres + Redis), `.env.example`, `infra/docker/Dockerfile`.
**Implementation Notes:** Pin Postgres major version now — switching mid-project is real rework. Redis included per Backend Engineering Agent's stack choice (not used yet, just provisioned).
**Acceptance Criteria:** `docker-compose up` brings up app container + Postgres + Redis, app container can reach both.
**Tests Required:** Smoke test — container healthcheck passes for all 3 services.
**Definition of Done:** Any agent can clone the repo and run one command to get a working local environment.
**Review Checklist:** No secrets committed; `.env.example` has placeholder values only.
**Complexity:** Low. **Effort:** 2-3h. **Parallel with:** INFRA-T2, INFRA-T3, INFRA-T4 (all infra tasks are mutually parallel — different files). **Blocking Dependencies:** None.
**Agent:** Antigravity — infra/ops-shaped task, not domain logic.

## INFRA-T2 — Migration tool selection + CI migration check
**Context:** Switching migration tools after migrations exist is real rework (Readiness Review §5).
**Module Ownership:** Allowed: `infra/ci/**`, `alembic.ini` (or chosen tool's config) at root. Forbidden: any feature module.
**Inputs:** INFRA-T1 (needs Postgres running to test against).
**Outputs:** Migration tool config, CI job that runs `migrate` + fails build on migration error.
**Implementation Notes:** Pick the tool now — this decision is the actual deliverable, not just the config file.
**Acceptance Criteria:** CI pipeline runs migrations against a fresh DB on every PR and fails loudly if a migration errors.
**Tests Required:** CI dry-run against an intentionally broken migration confirms the pipeline fails (negative test for the CI gate itself).
**Definition of Done:** First real migration (in E0-T1) can run through this pipeline without setup changes.
**Review Checklist:** Tool choice documented in repo README, not just implied by config presence.
**Complexity:** Low. **Effort:** 2h. **Parallel with:** INFRA-T1, T3, T4. **Blocking Dependencies:** INFRA-T1.
**Agent:** Antigravity.

## INFRA-T3 — Automated backup job
**Context:** No backups before real business data enters the system is the single most common real-world ERP disaster (Readiness Review §5) — non-negotiable per the architecture's own audit/traceability principle.
**Module Ownership:** Allowed: `infra/backup/**`. Forbidden: feature modules.
**Inputs:** INFRA-T1.
**Outputs:** Scheduled `pg_dump` job (cron or equivalent) targeting cloud storage, restore-verification script.
**Implementation Notes:** Daily cadence is sufficient for Phase 1 volume — don't over-build retention/rotation logic yet.
**Acceptance Criteria:** A dump runs on schedule and a restore from that dump succeeds against a throwaway DB.
**Tests Required:** Restore-verification test — dump → restore → row-count sanity check.
**Definition of Done:** Backup + verified-restore both demonstrated before any real data is entered.
**Review Checklist:** Backup destination is not the same physical disk as the primary DB.
**Complexity:** Low-Medium. **Effort:** 3h. **Parallel with:** all infra tasks. **Blocking Dependencies:** INFRA-T1.
**Agent:** Antigravity.

## INFRA-T4 — OpenAPI-from-code + CI contract diff check
**Context:** Without a pinned contract, parallel frontend/backend agent work breaks silently (Readiness Review §4) — directly undermines the WBS's core parallelization goal.
**Module Ownership:** Allowed: `infra/contracts/**`, CI config. Forbidden: feature modules.
**Inputs:** INFRA-T2 (CI pipeline must exist first).
**Outputs:** OpenAPI generation step wired into CI, committed spec file, CI job that fails if committed spec ≠ what the running backend serves.
**Implementation Notes:** Spec is generated FROM code, never hand-written — hand-written specs drift.
**Acceptance Criteria:** Intentionally changing an endpoint's response shape without regenerating the spec fails CI.
**Tests Required:** CI negative test — stale spec committed on purpose, confirm pipeline catches it.
**Definition of Done:** Every future backend PR that touches an endpoint is structurally forced to update the spec.
**Review Checklist:** Spec generation step runs in CI, not just locally on a developer's machine (or it'll be skipped).
**Complexity:** Medium. **Effort:** 4h. **Parallel with:** INFRA-T1, T3. **Blocking Dependencies:** INFRA-T2.
**Agent:** Antigravity (sets the pattern E0 through E6 backend tasks must follow when exposing endpoints).

---

# 2. CORE LEDGER (E0)

## E0-T1 — Ledger base mixin + balance helper
**Context:** Fabric/Accessory/FG ledgers must share one structural pattern or three subtly-different implementations drift (Readiness Review §3, WBS §4 note).
**Module Ownership:** Allowed: `core/ledger_base/**`. Forbidden: `fabric_inventory/**`, `accessory_inventory/**`, `finished_goods/**`, `procurement/**`, `uom/**`.
**Inputs:** INFRA-T1, INFRA-T2 (needs DB + migration pipeline). Required entities: none yet (this creates the base, no concrete ledger table).
**Outputs:** `core/ledger_base/model_mixin.py` (or language-equivalent), `core/ledger_base/balance_service.py`, shared `direction` enum.
**Implementation Notes:** Balance helper signature must accept `(item_ref, warehouse_id)` from day one (per E0-T2's warehouse_id requirement) even though only one warehouse exists. No UPDATE/DELETE permitted on any table using this mixin — enforce at DB role grant level, not just app-layer convention.
**Acceptance Criteria:** Mixin provides `created_by`, `created_at`, `warehouse_id`, `reason_code`, `direction` fields; balance helper computes `SUM(in)-SUM(out)` correctly scoped by warehouse.
**Tests Required:** Unit test for balance helper (in/out sum correctness, multiple entries); migration test confirming no UPDATE/DELETE grant exists on a table built from this mixin.
**Definition of Done:** A throwaway test table built from the mixin demonstrates immutability + correct balance computation.
**Review Checklist:** Zero ledger-specific (fabric/accessory/FG) fields leaked into this base — must be genuinely generic.
**Complexity:** Medium-High (gets this wrong, E2/E3/E6 inherit the mistake). **Effort:** 1 day. **Parallel with:** E0-T2 only after T1's mixin shape is settled (T2 depends on T1's interface, not full implementation). **Blocking Dependencies:** INFRA-T1, T2.
**Agent:** Claude Code — highest-leverage correctness-critical task in the whole project.

## E0-T2 — Warehouse table + seed
**Context:** Retrofitting `warehouse_id` onto live ledger data later requires manual stock-attribution, not just a migration (Readiness Review §1).
**Module Ownership:** Allowed: `core/warehouse/**`. Forbidden: any feature module.
**Inputs:** E0-T1 (ledger mixin must accept `warehouse_id`).
**Outputs:** `Warehouse(id, name)` model + migration, seed script inserting exactly one row.
**Implementation Notes:** No transfer workflow, no multi-location UI — this is "add the column, don't build the feature" per Readiness Review §1.
**Acceptance Criteria:** Exactly one `Warehouse` row exists post-seed; ledger mixin's `warehouse_id` FK defaults to it.
**Tests Required:** Seed test confirming row count = 1.
**Definition of Done:** Every subsequent ledger table created in E2/E3/E6 has a working, non-nullable `warehouse_id` FK with no manual wiring needed.
**Review Checklist:** No second warehouse accidentally seeded; no UI/endpoint for warehouse switching exists (out of scope, would be over-building).
**Complexity:** Low. **Effort:** 1h. **Parallel with:** runs right after E0-T1's interface is fixed. **Blocking Dependencies:** E0-T1.
**Agent:** Claude Code (small task, but same agent for continuity with E0-T1's interface).

## E0-T3 — Polymorphic reference validator
**Context:** `reference_type`/`reference_id` lacks DB-level FK integrity; mitigation is app-layer existence validation, not a schema change (Revision 1 Change 8, Readiness Review confirms this approach).
**Module Ownership:** Allowed: `core/ledger_base/ref_validator.py`. Forbidden: feature modules.
**Inputs:** E0-T1.
**Outputs:** Validator function checked at insert time for every ledger write; periodic orphan-reference detector (scheduled job or report query).
**Implementation Notes:** Validate ref exists for the given ref_type before insert — reject the write if not, don't silently store a dangling reference.
**Acceptance Criteria:** Insert with a non-existent `reference_id` for a given `reference_type` is rejected with a clear error.
**Tests Required:** Negative test — fabricated bad reference rejected; orphan-detector report query test against a seeded orphan (inserted via direct DB access, bypassing the validator, to confirm detection works as a safety net).
**Definition of Done:** Every ledger-writing module (E2/E3/E6) can call this validator without reimplementing it.
**Review Checklist:** Validator is generic across ref types, not hardcoded to one entity.
**Complexity:** Low-Medium. **Effort:** 3h. **Parallel with:** E0-T2. **Blocking Dependencies:** E0-T1.
**Agent:** Claude Code.

---

# 3. PROCUREMENT (E0.5)

## E0.5-T1 — Supplier + PurchaseOrder + PurchaseOrderLine
**Context:** `FabricLot.po_id` is already load-bearing in the approved schema but no PO entity exists — real gap (Readiness Review §2).
**Module Ownership:** Allowed: `procurement/**`. Forbidden: `fabric_inventory/**`, `accessory_inventory/**`.
**Inputs:** E0-T1, E0-T2 (uses core ledger base patterns for consistency, though PO itself isn't a ledger). Required entities: none pre-existing.
**Outputs:** `Supplier`, `PurchaseOrder`, `PurchaseOrderLine` models + migrations, minimal status-transition service.
**Implementation Notes:** Status: draft → approved → partially_received → closed/cancelled. Single approver action, no multi-step workflow (matches real team size). No invoice upload (flat attachment field only, addable anytime). Outstanding qty on a line = `ordered_qty - SUM(received against this line)` — computed, not stored.
**Acceptance Criteria:** PO line correctly reports outstanding qty after a partial receipt is recorded against it.
**Tests Required:** Partial-receipt test (order 500m, receive 320m, outstanding = 180m); status-transition test (GRN rejected against a `draft` PO, allowed against `approved`).
**Definition of Done:** E2-F1 and E3-F1 can resolve a real `po_line_id` against this module.
**Review Checklist:** No approval-workflow over-build (single approver only); no invoice-upload feature built prematurely.
**Complexity:** Medium. **Effort:** 1 day. **Parallel with:** E1 (UOM) — different files entirely. **Blocking Dependencies:** E0-T1, T2.
**Agent:** Codex — narrow, well-defined scope, good isolated task for a focused agent.

---

# 4. UOM (E1)

## E1-T1 — UnitOfMeasure + UOMConversion + conversion service
**Context:** Fabric purchased by roll, consumed by meter; accessories purchased by dozen, consumed by piece (Revision 1 Change 6).
**Module Ownership:** Allowed: `uom/**`. Forbidden: `fabric_inventory/**`, `accessory_inventory/**` (they call this module's conversion service, never compute conversion math themselves).
**Inputs:** E0-T1 (no direct dependency, but should follow same migration conventions).
**Outputs:** `UnitOfMeasure`, `UOMConversion` models + migrations, `convert(qty, from_uom, to_uom)` service function.
**Implementation Notes:** Conversion factor must be captured ON the ledger entry at write time (frozen), not re-derived later by re-running the conversion service against possibly-changed factors.
**Acceptance Criteria:** Roll→meter and dozen→piece conversions both correct; missing conversion factor for a requested pair raises a clear error, never silently stores unconverted.
**Tests Required:** Unit tests for both conversion directions; missing-factor rejection test.
**Definition of Done:** E2/E3's GRN endpoints can call `convert()` and store both purchase-unit and consumption-unit quantities.
**Review Checklist:** Service is pure/stateless (no hidden DB writes inside the conversion function itself — only the caller writes the frozen factor onto its own ledger entry).
**Complexity:** Low-Medium. **Effort:** 4h. **Parallel with:** E0.5-T1. **Blocking Dependencies:** None beyond INFRA.
**Agent:** Codex.

---

# 5. FABRIC INVENTORY (E2)

## E2-F1-T1 — FabricItem + FabricLot + GRN
**Context:** Warehouse staff records fabric received against a PO line, with optional dye-lot (Revision 1 Change 1, base doc §4.1).
**Module Ownership:** Allowed: `fabric_inventory/**`. Forbidden: `core/**`, `uom/**`, `procurement/**`, `accessory_inventory/**`.
**Inputs:** E0-T1/T2/T3, E0.5-T1 (po_line_id), E1-T1 (UOM conversion). Required APIs: `procurement` PO-line lookup, `uom` convert().
**Outputs:** `FabricItem`, `FabricLot` models + migration, `POST /fabric-items`, `POST /fabric-lots` (GRN) endpoints.
**Implementation Notes:** `dye_lot_no` nullable (deferred decision, per Revision 1 — schema supports turning tracking on later with zero migration). `cost_per_uom` = PO price only. GRN creates lot + ledger entry atomically — one transaction, not two separate writes.
**Acceptance Criteria:** GRN against a valid `po_line_id` creates exactly one lot + one purchase ledger entry; balance query immediately reflects it.
**Tests Required:** Atomicity test (simulated failure mid-GRN rolls back both lot and ledger entry); GRN against an unapproved PO line rejected.
**Definition of Done:** A fabric lot can be received and its balance queried correctly through the shared `core/ledger_base` balance helper.
**Review Checklist:** No direct quantity field set anywhere outside the ledger-entry path.
**Complexity:** Medium. **Effort:** 1 day. **Parallel with:** E3-F1-T1 (Accessory equivalent — different files). **Blocking Dependencies:** E0 complete, E0.5-T1, E1-T1.
**Agent:** Claude Code — same agent family as E0 for consistency on the most complex inventory module.

## E2-F2-T1 — Fabric issue / return / adjustment
**Context:** Production staff issues fabric to a production order, returns unused fabric, records damage/shrinkage separately (base doc §4.1, edge case table).
**Module Ownership:** Allowed: `fabric_inventory/**`. Forbidden: same as F1.
**Inputs:** E2-F1-T1 (needs `FabricLot` to exist).
**Outputs:** `POST /fabric-ledger-entries` (issue/return/damage/adjustment), concurrency-safe balance check.
**Implementation Notes:** Issue fails cleanly (no partial write) if qty > lot balance. Concurrent issue requests against the same lot — row lock or optimistic concurrency, one must fail, never both partially succeed.
**Acceptance Criteria:** Insufficient-balance issue rejected; two simultaneous issues summing > balance — exactly one succeeds.
**Tests Required:** Concurrency test (two parallel requests, deterministic single-success outcome); insufficient-balance rejection test; damage/adjustment entry correctly reduces balance.
**Definition of Done:** Concurrency test passes deterministically across repeated runs (not flaky).
**Review Checklist:** Locking mechanism doesn't deadlock under the test's concurrent load.
**Complexity:** Medium-High (concurrency correctness). **Effort:** 1 day. **Parallel with:** E3-F2-T1. **Blocking Dependencies:** E2-F1-T1.
**Agent:** Claude Code.

## E2-F3-T1 — Landed cost entries
**Context:** Freight/customs/handling tracked separately from PO price, never folded into `cost_per_uom` (Revision 1, answer to original Q5).
**Module Ownership:** Allowed: `fabric_inventory/**`. Forbidden: same as F1.
**Inputs:** E2-F1-T1.
**Outputs:** `LandedCostEntry` model + migration, lot-detail endpoint showing PO cost and landed cost as separate lines.
**Implementation Notes:** Explicitly excluded from `cost_per_uom` calculation — this is a deliberate, audited design choice, not an oversight.
**Acceptance Criteria:** Lot detail view returns PO cost and landed cost as two distinct fields; `cost_per_uom` unaffected by landed cost entries.
**Tests Required:** Test confirming `cost_per_uom` doesn't change after a landed cost entry is added to a lot.
**Definition of Done:** Finance/Costing Engine (later module) has a stable place to read landed costs from.
**Review Checklist:** No accidental blending of landed cost into the main cost field anywhere in the codebase (grep for any calculation combining the two).
**Complexity:** Low. **Effort:** 3h. **Parallel with:** E2-F2-T1 (different feature, same module — sequence after F1, can overlap with F2 if same agent manages both carefully, otherwise sequential to avoid same-file contention). **Blocking Dependencies:** E2-F1-T1.
**Agent:** Claude Code.

---

# 6. ACCESSORY INVENTORY (E3)

## E3-F1-T1 — AccessoryItem + GRN
**Context:** Structurally near-identical to E2-F1, deliberately built by a different agent to stress-test E0's base is actually generic (WBS §4 note).
**Module Ownership:** Allowed: `accessory_inventory/**`. Forbidden: `core/**`, `uom/**`, `procurement/**`, `fabric_inventory/**`.
**Inputs:** E0-T1/T2/T3, E0.5-T1, E1-T1.
**Outputs:** `AccessoryItem` model + migration, `POST /accessory-items`, GRN endpoint.
**Implementation Notes:** Per-unit consumption confirmed (no per-batch path needed). Same atomicity guarantee as E2-F1-T1.
**Acceptance Criteria:** Same shape as E2-F1-T1's AC, applied to accessories.
**Tests Required:** Same suite shape as E2-F1-T1 — same test names/structure, deliberately, so drift is visible at review.
**Definition of Done:** Same as E2-F1-T1.
**Review Checklist:** Compare directly against E2-F1-T1's implementation for unjustified divergence (different error message formats, different atomicity guarantees) — if found, flag to E0's owning agent, since divergence usually means the base wasn't generic enough.
**Complexity:** Medium. **Effort:** 1 day. **Parallel with:** E2-F1-T1. **Blocking Dependencies:** E0 complete, E0.5-T1, E1-T1.
**Agent:** Codex (deliberately not Claude Code — different agent forces explicit adherence to E0's contract rather than copying E2's code).

## E3-F2-T1 — Accessory issue / adjustment
**Context:** Mirrors E2-F2 for accessories (base doc §4.2).
**Module Ownership:** Allowed: `accessory_inventory/**`. Forbidden: same as F1.
**Inputs:** E3-F1-T1.
**Outputs:** `POST /accessory-ledger-entries`.
**Implementation Notes:** Same concurrency/insufficient-balance guarantees as E2-F2-T1.
**Acceptance Criteria:** Same as E2-F2-T1, applied to accessories.
**Tests Required:** Same concurrency + insufficient-balance test shapes as E2-F2-T1.
**Definition of Done:** Same as E2-F2-T1.
**Review Checklist:** Same cross-check against E2-F2-T1 as F1-T1's checklist.
**Complexity:** Medium-High. **Effort:** 1 day. **Parallel with:** E2-F2-T1. **Blocking Dependencies:** E3-F1-T1.
**Agent:** Codex.

---

# 7. STYLE AND BOM (E4)

## E4-F1-T1 — Style + StyleVariant
**Context:** Inventory must exist at variant level, never style level (Revision 1 Changes 1 & 7).
**Module Ownership:** Allowed: `style_variant/**`. Forbidden: `fabric_inventory/**`, `accessory_inventory/**`.
**Inputs:** E2 and E3 complete (no direct FK dependency at this sub-feature, but module sequencing per WBS puts this after both inventory modules exist).
**Outputs:** `Style`, `StyleVariant` models + migrations, CRUD endpoints.
**Implementation Notes:** Zero quantity/balance fields anywhere on either table — schema-level guard-rail, not just a convention.
**Acceptance Criteria:** `sku_code` unique constraint enforced; no stock-holding field exists on either model.
**Tests Required:** Unique-constraint violation test; schema-assertion test (introspect model fields, assert no quantity/balance column present).
**Definition of Done:** A style with 6 variants (per the Co-ord Set example in Revision 1) can be created and queried correctly.
**Review Checklist:** No "convenience" stock-summary field snuck onto Style "just for the dashboard" — that's exactly the two-truths trap Change 7 exists to prevent.
**Complexity:** Low-Medium. **Effort:** 4h. **Parallel with:** none within E4 (F2 depends on this). **Blocking Dependencies:** E2, E3 complete.
**Agent:** Cursor — IDE-native refactor-style work suits in-editor diff review.

## E4-F2-T1 — BOM + BOMVersion + BOMItem
**Context:** BOMs change over a style's life; historical production orders must retain their original BOM (Revision 1 Change 4).
**Module Ownership:** Allowed: `bom/**`. Forbidden: `fabric_inventory/**`, `accessory_inventory/**`, `style_variant/**` (reads via FK only).
**Inputs:** E4-F1-T1, E2-F1-T1 (FabricItem FK target), E3-F1-T1 (AccessoryItem FK target).
**Outputs:** `BOM`, `BOMVersion`, `BOMItem` models + migrations, `POST /styles/{id}/bom-versions`, `PATCH /bom-versions/{id}/activate`.
**Implementation Notes:** No `PUT` on `BOMItem` — immutable once a version is created, corrections via new version only. `BOMItem` includes a nullable `variant_id` override field (built now, usage policy decided later per architecture's open item).
**Acceptance Criteria:** Activating a new BOM version never alters a prior version's `BOMItem` rows.
**Tests Required:** Version-immutability test (create v1, activate v2, assert v1's items unchanged); variant-override field exists and defaults to null/style-wide.
**Definition of Done:** A production order (built in E5) can lock in a `bom_version_id` and that reference stays stable regardless of later BOM changes.
**Review Checklist:** No update path exists on `BOMItem` rows once committed — grep for any UPDATE statement against this table.
**Complexity:** Medium. **Effort:** 1 day. **Parallel with:** none within E4. **Blocking Dependencies:** E4-F1-T1, E2 + E3 complete.
**Agent:** Cursor.

---

# 8. PRODUCTION (E5)

## E5-F1-T1 — Production Order creation
**Context:** A production order specifies a variant breakdown and locks in the active BOM version at creation (Revision 1 Changes 1 & 4).
**Module Ownership:** Allowed: `production/**`. Forbidden: `fabric_inventory/**`, `accessory_inventory/**`, `style_variant/**`, `bom/**`, `finished_goods/**`.
**Inputs:** E4 complete (Style/Variant/BOM). Required APIs: `bom`'s active-version lookup.
**Outputs:** `ProductionOrder` model + migration, `POST /production-orders`.
**Implementation Notes:** `bom_version_id` set once at creation, immutable after — even if BOM is re-activated mid-order.
**Acceptance Criteria:** Production order requires `[{variant_id, planned_qty}]`; `bom_version_id` captured at creation time.
**Tests Required:** Immutability test — re-activate a BOM version after order creation, confirm order's `bom_version_id` unchanged.
**Definition of Done:** A production order can be created referencing real variants and a real BOM version.
**Review Checklist:** No live re-lookup of "current" BOM version anywhere downstream — always reads from the order's frozen `bom_version_id`.
**Complexity:** Medium. **Effort:** 1 day. **Parallel with:** none — this is the entry point other E5 features depend on. **Blocking Dependencies:** E4 complete.
**Agent:** Claude Code — highest-atomicity-risk epic, kept on the most capable agent throughout.

## E5-F2-T1 — Cutting
**Context:** Fabric issued and cut pieces counted, capturing wastage (base doc §4.3).
**Module Ownership:** Allowed: `production/**`. Forbidden: same as F1, plus must call `fabric_inventory`'s issue API rather than writing fabric ledger entries directly.
**Inputs:** E5-F1-T1, E2-F2-T1 (fabric issue API).
**Outputs:** `CuttingRecord` model + migration, `POST /production-orders/{id}/cutting-records`.
**Implementation Notes:** Cutting record creation + fabric ledger outbound entry must be one atomic transaction.
**Acceptance Criteria:** Cutting record references a specific `fabric_lot_id`; fabric balance decreases correctly in the same transaction.
**Tests Required:** Atomicity test — forced failure mid-transaction rolls back both the cutting record and the fabric ledger entry.
**Definition of Done:** Cutting against a real production order + real fabric lot succeeds and is reflected in both modules consistently.
**Review Checklist:** No direct write to `fabric_inventory`'s tables — call its service API only.
**Complexity:** Medium-High. **Effort:** 1 day. **Parallel with:** can run in parallel with F3/F4 work on a *different* production order (per WBS §8 parallelization note), not the same order. **Blocking Dependencies:** E5-F1-T1.
**Agent:** Claude Code.

## E5-F3-T1 — Stitching + multi-vendor split
**Context:** Production sent to one or more vendors or in-house, tracking sent/received/rejected (base doc §4.3, Revision 1 Change 1 confirms "both" production models).
**Module Ownership:** Allowed: `production/**`. Forbidden: same as F1.
**Inputs:** E5-F2-T1 (cut pieces must exist before stitching).
**Outputs:** `StitchingBatch` model + migration, `POST /production-orders/{id}/stitching-batches`, `POST /stitching-batches/{id}/receive`.
**Implementation Notes:** `vendor_id` nullable + in-house flag — both production models supported by one shape. Multiple batches per order must sum correctly to total status.
**Acceptance Criteria:** A production order with 2 vendor batches reports correct aggregate sent/received/rejected.
**Tests Required:** Multi-vendor rollup test (2 batches, different vendors, correct sums); partial-receipt test (received_qty + rejected_qty < sent_qty allowed, flagged as in-transit).
**Definition of Done:** Multi-vendor rollup test passes for at least 2 vendors plus one in-house batch on the same order.
**Review Checklist:** "In-transit" remainder is correctly computed, not silently dropped or double-counted.
**Complexity:** Medium-High. **Effort:** 1 day. **Parallel with:** F2 (different orders). **Blocking Dependencies:** E5-F2-T1.
**Agent:** Claude Code.

## E5-F4-T1 — QC with 5 states
**Context:** PASS/REWORK/SECOND_SALE/SCRAP/HOLD, each with different inventory consequences (Revision 1 Change 5).
**Module Ownership:** Allowed: `production/**`. Forbidden: same as F1, plus must call `finished_goods`'s write API for the PASS/SECOND_SALE side-effect rather than writing FG ledger entries directly.
**Inputs:** E5-F3-T1, E6-T1 (finished_goods write API must exist — this is the one place E5 depends forward on E6; sequence accordingly or stub the FG write interface early so E5 and E6 can develop somewhat in parallel against an agreed contract).
**Outputs:** QC result field/endpoint on `StitchingBatch`, `POST /stitching-batches/{id}/qc`.
**Implementation Notes:** PASS and SECOND_SALE both trigger an FG ledger write (SECOND_SALE flagged discount-grade); SCRAP writes off with no FG entry; HOLD blocks until manually resolved, no auto-timeout.
**Acceptance Criteria:** All 5 paths produce the correct downstream effect (or lack thereof) on FG inventory.
**Tests Required:** One integration test per QC state (5 total); the PASS/SECOND_SALE→FG-ledger-write must be tested as a single atomic transaction (forced failure rolls back both sides) — highest-risk test in the entire project per Readiness Review and Revision 1 Change 2.
**Definition of Done:** All 5 QC-state tests pass, including the atomicity test under forced failure.
**Review Checklist:** Confirm transactional boundary actually wraps both the QC-state write and the FG ledger write — not two separate calls that could leave one without the other on a crash.
**Complexity:** High (atomicity-critical). **Effort:** 1.5 days. **Parallel with:** F5/F6 once this is stable. **Blocking Dependencies:** E5-F3-T1, E6-T1 (or an agreed-upon FG write contract stubbed early).
**Agent:** Claude Code — non-negotiable, this is the single highest-risk transaction in the whole system.

## E5-F5-T1 — Rework loop
**Context:** REWORK units re-enter stitching without creating a phantom new production order (base doc edge case table).
**Module Ownership:** Allowed: `production/**`. Forbidden: same as F1.
**Inputs:** E5-F4-T1.
**Outputs:** `ReworkRecord` model + migration, rework endpoint.
**Implementation Notes:** Rework outcome (passed/scrapped) feeds back into the same production order's passed count, never spawns a new order.
**Acceptance Criteria:** A successful rework increases passed count without creating any new inventory record outside the original order's trail.
**Tests Required:** No-phantom-inventory test — confirm total inventory created across a cut→reject→rework→pass cycle equals exactly the original cut quantity, not more.
**Definition of Done:** Rework cycle test passes with correct quantity conservation.
**Review Checklist:** Quantity conservation verified explicitly, not just "no errors thrown."
**Complexity:** Medium. **Effort:** 1 day. **Parallel with:** F6. **Blocking Dependencies:** E5-F4-T1.
**Agent:** Claude Code.

## E5-F6-T1 — Production Event audit trail
**Context:** Every state change above must be auditable in order, referencing the structured record rather than duplicating it (Revision 1 Change 9).
**Module Ownership:** Allowed: `production/**`. Forbidden: same as F1.
**Inputs:** E5-F1 through F5 (writes an event on every transition in all of them).
**Outputs:** `ProductionEvent` model + migration, event-writing hooks on every transition in F1-F5, `GET /production-orders/{id}/events`.
**Implementation Notes:** `payload_json` shape is typed per `event_type` and validated in application code (not DB-enforced) — per Revision 1 Change 9's "typed metadata" middle-ground recommendation. This table is audit/log only, never the source of truth for current state.
**Acceptance Criteria:** Event log for a test production order shows complete, ordered history matching every actual transition made via F1-F5.
**Tests Required:** Completeness test — run a full order through cut→stitch→QC→rework→pass, assert every step produced exactly one corresponding event.
**Definition of Done:** Event log is queryable and complete for the full lifecycle test above.
**Review Checklist:** No event-sourcing creep — confirm `ProductionOrder`'s actual status is still read from its own field, not reconstructed by replaying events (Change 9 explicitly rejected full event sourcing as over-scope).
**Complexity:** Medium. **Effort:** 1 day (incremental — hooks added alongside F1-F5, not a single big task at the end). **Parallel with:** woven into F1-F5 rather than a separate sequential step. **Blocking Dependencies:** F1-F5 each as their hooks are added.
**Agent:** Claude Code.

---

# 9. FINISHED GOODS (E6)

## E6-T1 — FinishedGoodsLedgerEntry + balance
**Context:** Fabric/Accessory ledgers exist; FG — the most important inventory class — currently has none (Revision 1 Change 2).
**Module Ownership:** Allowed: `finished_goods/**`. Forbidden: `production/**` (E5 calls into this module's write API; this module never reaches into E5's tables).
**Inputs:** E0-T1/T2/T3. Required APIs: none inbound (E5 calls this module, not the reverse) — but should expose its write API early enough that E5-F4 can integrate against it (see E5-F4's note on sequencing/stubbing).
**Outputs:** `FinishedGoodsLedgerEntry` model + migration supporting all 9 txn_types (`production_complete, sale, return, damage, photoshoot_sample, influencer_sample, replacement_order, adjustment, stock_audit`), balance endpoint.
**Implementation Notes:** `unit_cost` captured at `production_complete` write time, rolled up from the production order's actual BOM-version + fabric/accessory consumption — not a placeholder, must be real. No manual-entry path for `production_complete` — system-written only, called from E5's QC-pass step.
**Acceptance Criteria:** `production_complete` entry's `unit_cost` matches manual recomputation from the same production order's actual consumption data.
**Tests Required:** Integration test — build a production order with known fabric/accessory costs, run it to PASS, assert the resulting FG entry's `unit_cost` equals hand-computed expected cost; negative test confirming no API path allows manually creating a `production_complete` entry.
**Definition of Done:** Cost-rollup integration test passes with real (not mocked) BOM + ledger data.
**Review Checklist:** This is the second-highest atomicity/correctness risk after E5-F4 — reviewer must independently recompute the expected `unit_cost` for the test case, not just check that code "looks right."
**Complexity:** High. **Effort:** 1.5 days. **Parallel with:** can start in parallel with early E5 work if the write-API contract is agreed first (see E5-F4 note); full integration testing waits until E5-F1 through F4 are real. **Blocking Dependencies:** E0 complete; full integration depends on E5-F1 through F4.
**Agent:** Claude Code — same agent as E5 for continuity at this specific high-risk integration point (per WBS §9 rationale).

---

# Cross-Cutting: QA and Documentation (run continuously, not appended at the end)

Every task above gets, alongside its implementation PR:
- **QA (Antigravity):** test stub generated FROM this task's "Tests Required" section BEFORE implementation starts — Antigravity owns `tests/**` mirroring each module's folder, never the module's own source files.
- **Docs (Antigravity or Codex):** API doc entry generated from the OpenAPI spec (INFRA-T4) at merge time — owns `docs/**`, never module source.

---

# Summary: Parallel Execution Lanes

```
Lane A (Antigravity): INFRA-T1,T2,T3,T4 → QA/Doc generation threaded through every other lane
Lane B (Claude Code):  E0-T1,T2,T3 → E2-F1,F2,F3 → E5 (all features) → E6-T1
Lane C (Codex):        E0.5-T1 + E1-T1 (parallel with each other) → E3-F1,F2
Lane D (Cursor):       E4-F1,F2 (starts once Lane B's E2 and Lane C's E3 both complete)
```
Lane B is the critical path (E0 → E2 → E5 → E6 all sit on Claude Code for continuity at the highest-risk points) — if compute/agent capacity is constrained, prioritize Lane B's throughput over the others.
