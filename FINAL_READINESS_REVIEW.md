# Program Manager — Final Delivery Readiness Review

Source of truth: [PHASE1_ARCHITECTURE.md](PHASE1_ARCHITECTURE.md), [PHASE1_ARCHITECTURE_REVISION_1.md](PHASE1_ARCHITECTURE_REVISION_1.md), [WBS_PHASE1.md](WBS_PHASE1.md).

This is a gap-finding pass, not a rubber stamp. Several real gaps found below — none are fatal, but two are cheap-now/expensive-later and must be decided before E0 starts.

---

## 1. Warehouse Readiness

**Current State:** No `warehouse_id` anywhere. Every ledger entry, lot, and FG balance is implicitly single-location.

**Risk:** Phase 3 explicitly plans multi-warehouse. If `warehouse_id` is bolted on later, every ledger table, every balance query, and every reservation needs a migration plus a backfill decision ("which warehouse does existing stock belong to?") — that backfill is a real operational risk, not just a schema change, because it requires someone to manually attribute existing physical stock to a location after the fact.

**Recommendation:** Add a nullable `warehouse_id` (FK to a minimal `Warehouse` table, single row seeded for Phase 1) to every ledger table now — `FabricLedgerEntry`, `AccessoryLedgerEntry`, `FinishedGoodsLedgerEntry`, and `FabricLot`/`AccessoryItem` balance scope. Do NOT build transfer workflows, multi-location UI, or per-warehouse permissions now — that's still Phase 3. This is "add the column, don't build the feature."
- Schema: `Warehouse(id, name)`, `warehouse_id` FK added to the 3 ledger tables + lot/item tables, defaulted to the single seeded warehouse.
- API: no new endpoints now; existing endpoints implicitly scope to the default warehouse.
- Migration impact: trivial now (one nullable FK, one seed row), severe later (retrofitted FK + backfill across live ledger data).

**Priority:** High — must go into E0/E2/E3/E6 schemas now.
**Estimated Future Cost if Ignored:** Multi-week migration + manual data-attribution exercise at Phase 3, on live transactional data instead of an empty table.

---

## 2. Procurement Readiness

**Current State:** Design starts at GRN — no `Supplier` lifecycle beyond a flat reference, no `PurchaseOrder`, no approval, no partial-receipt tracking, no invoice handling.

**Risk:** "GRN against a PO" is mentioned throughout the architecture (`FabricLot.po_id`) but no PO entity actually exists yet — this is a real gap, not a deferred nice-to-have. Without it, `po_id` is a dangling reference to nothing, and partial receipts (ordered 500m, received 320m, balance still owed) have no home.

**Recommendation:** Procurement cannot realistically stay outside the ERP — `po_id` is already load-bearing in the approved schema. Build a **minimal** PO module now, not the full agent-spec'd version (Supplier Management UI, approval workflow, invoice upload are over-scope for Phase 1):
- `PurchaseOrder(id, supplier_id, status[draft/approved/partially_received/closed/cancelled], created_at)`
- `PurchaseOrderLine(id, po_id, component_type[fabric/accessory], component_id, ordered_qty, ordered_uom, agreed_price)`
- GRN (`FabricLot`/`AccessoryItem` receive) references `po_line_id`, decrements an implicit "outstanding" amount (`ordered_qty - SUM(received against this line)`), supporting partial receipts naturally without a separate "partial receipt" entity.
- Skip: approval workflow (single approver = owner, no workflow needed at this team size), invoice upload (file storage feature, not core to inventory correctness — can be a flat attachment field added anytime without schema risk).

**Priority:** High — blocks E2/E3 GRN features from being correct (`po_id` currently points nowhere).
**Estimated Future Cost if Ignored:** GRN entries with orphaned `po_id` references; no way to answer "what's still owed from this PO" — a question the owner will ask in week one.

---

## 3. Inventory Core Review

**Current State:** Fabric/Accessory/FG ledgers are three separate modules, explicitly designed to share a common base (E0 in WBS) but as three distinct table sets.

**Risk:** If E0's shared base isn't disciplined, three "almost-identical" implementations drift (already flagged in WBS §4 note for E2/E3 specifically).

**Recommendation:** Keep three separate tables (not one polymorphic mega-ledger table) — different item types have genuinely different fields (`dye_lot_no` only matters for fabric, `unit_cost`+`txn_type` enum differs for FG). A single shared table would need a wide nullable-column union or a JSON escape hatch, both worse than three disciplined tables sharing a code-level base class. This is already the WBS's plan (E0 = shared base, E2/E3/E6 = thin modules on top) — confirming it's correct, not changing it. The complexity/maintainability tradeoff favors three typed tables over one generic one at this entity count (3 ledger types, not 30).

**Priority:** Medium — no schema change needed, but E0's code review (already flagged in WBS) must actually be enforced, not just stated as intent.
**Estimated Future Cost if Ignored:** Three subtly-different ledger behaviors, inconsistent error messages/edge-case handling, harder onboarding for new agents/devs.

---

## 4. API Contract Management

**Current State:** No contract mechanism specified — multiple agents (Claude Code, Codex, Cursor, Antigravity) building backend and frontend in parallel with nothing pinning the shape between them.

**Risk:** Highest real risk in a multi-agent delivery model. Backend agent ships a field rename or response shape change; frontend agent (different agent, different session, no shared memory) breaks silently until integration, which in a parallel-agent model might be days later.

**Recommendation:** OpenAPI spec is the contract, generated FROM backend code (not hand-written separately, which drifts) and committed to the repo on every backend PR that touches an endpoint. Frontend agents consume the committed spec to generate/validate DTOs — never hand-type request/response shapes from memory of a chat conversation. Add a CI check: "does the committed OpenAPI spec match what the running backend actually serves" — fails the build if they diverge. Skip full contract testing (consumer-driven contracts, Pact, etc.) — that's infra for many independent teams; here it's an automated diff check, far cheaper and adequate at this scale.

**Priority:** High — without this, the entire "maximize parallel development" goal in WBS §8 is unsafe, not just inefficient.
**Estimated Future Cost if Ignored:** Recurring integration breakage every time a backend agent ships independently of a frontend agent — directly undermines the parallelization the WBS was built to enable.

---

## 5. Infrastructure Readiness

**Current State:** Not addressed anywhere yet — WBS jumps straight to feature epics.

**Recommendation — minimum before E0 starts:**
1. **Docker** (single docker-compose: app + Postgres + Redis) — needed so every agent (Claude Code, Codex, Cursor, Antigravity) runs an identical environment; without it, "works on my agent" bugs are guaranteed. *(Owner: ops, blocks: everything)*
2. **Migration strategy** — pick one tool (e.g. Alembic) before E0's first migration is written; switching tools after migrations exist is real rework. *(Owner: engineer, blocks: E0)*
3. **CI** — run migrations + tests on every PR. Doesn't need deploy automation yet, just "does it build and pass tests." *(Owner: ops, blocks: nothing functionally, but should exist by E0's first PR or test discipline erodes immediately)*
4. **Secrets management** — even at Phase 1 scale, DB credentials/API keys must not be committed to the repo. A `.env` + gitignore is sufficient now; a secrets vault is over-scope. *(Owner: ops, blocks: nothing, but must exist before any real credential is created)*
5. **Logging** — structured logging on ledger-writing endpoints from day one (every stock movement should be traceable in logs, not just in the DB) — cheap to add now, painful to retrofit into every existing endpoint later. *(Owner: engineer, parallel with E0)*
6. **Backup strategy** — automated Postgres backup (even daily pg_dump to cloud storage) before any real business data enters the system — this is non-negotiable per the architecture's own audit/traceability principles, and "we'll add backups later" is the single most common real-world ERP disaster. *(Owner: ops, blocks: production launch, not development)*
7. **Monitoring** — defer. Phase 1 team size doesn't need alerting infrastructure yet; basic uptime check is enough until Phase 2.

**Priority:** Docker + migration tool choice = blocking (must exist before E0). CI = should exist by E0. Backups = blocking before any real data, not before development starts. Monitoring = defer.
**Estimated Future Cost if Ignored:** Inconsistent agent environments causing false bugs (Docker); migration tool switch mid-project (strategy); silent data loss with no recovery path (backups) — this last one is the most severe possible failure mode for an "auditability over convenience" system.

---

## 6. Seed Data Strategy

**Current State:** Not addressed.

**Recommendation:**
- Seed: 1 warehouse, 2-3 suppliers, 5-10 `FabricItem`/`AccessoryItem` with realistic UOM conversions, 2-3 `Style`+`StyleVariant` sets (covering the Co-ord Set example from Revision 1 directly — already a good test case), 1-2 `BOMVersion` per style, 1 sample `PurchaseOrder` with a partial receipt already recorded (exercises the partial-receipt logic from §2 immediately), 1 in-progress `ProductionOrder` sitting mid-stitching (exercises status displays without needing a live workflow run).
- This seed set should be a fixture script run in CI before integration tests AND usable for local frontend development — same script, two consumers. Frontend agents build against seeded data, never wait for "real" production data to exist.
- QA test fixtures are a superset of the dev seed — add edge-case rows (a fabric lot at exactly zero balance, a production order with a SCRAP unit, a HOLD QC state) that wouldn't naturally occur in a "nice" demo seed.

**Priority:** High — directly serves WBS's stated goal ("frontend should not wait for production data, QA should not wait for implementation completion") but no concrete mechanism existed yet to make that true. This is that mechanism.
**Estimated Future Cost if Ignored:** Frontend agents blocked waiting for backend + real data; QA writing tests against guessed shapes instead of real fixtures.

---

## 7. Performance Readiness

**Current State:** Architecture explicitly says "inventory is calculated, never stored," flagged in Revision 1 as a scalability risk to revisit before Phase 3, not Phase 1.

**Recommendation, what must exist NOW vs can wait:**
- **Must exist now:** index on every ledger table's `(item_id/lot_id/variant_id, created_at)` — without this, balance queries (SUM over ledger) get slow even at modest Phase 1 volume (a few thousand entries already makes an unindexed SUM noticeably slow). This is not premature optimization — it's the minimum for the chosen "calculate, don't store" design to function at all.
- **Must exist now:** pagination on every list endpoint (production orders, ledger entries) — trivial to add now, awkward to retrofit once frontend agents have built unpaginated list views against it.
- **Can wait:** materialized/cached balance views (flagged correctly in Revision 1 as a Phase-3-adjacent concern) — building this now is the over-engineering the ladder warns against; the indexed live SUM is adequate at Phase 1 scale.
- **Can wait:** search strategy (full-text search on style/SKU names) — Phase 1 volume is small enough for simple `ILIKE` filtering; a real search engine (Elastic etc.) is unjustified now.
- **Can wait:** caching layer (Redis is in the stack per Backend Engineering Agent's tech choice, but don't reach for it on balance queries yet — cache invalidation on a ledger-based system is genuinely tricky, premature here).

**Priority:** Indexing + pagination = high (cheap, must exist now). Everything else = defer, correctly already flagged as such in Revision 1.
**Estimated Future Cost if Ignored:** Slow balance queries degrading the dashboard experience within months, not years, given ledger tables grow with every single stock movement.

---

## 8. Integration Readiness

**Current State:** Shopify/Razorpay/WhatsApp/Shipping/Accounting are all Phase 3 (per original phasing doc), no integration module exists or is being built now.

**Recommendation:** Do not build an integrations/plugin architecture now — that's designing for a hypothetical future requirement before any concrete integration is being implemented, which the project's own core principles explicitly warn against ("build only what the business needs today... design for expansion tomorrow" — expansion via clean module boundaries, not a speculative plugin framework). The one thing worth doing now: keep `reference_type`/`reference_id` polymorphic pattern (already approved in Revision 1 Change 8) generic enough that a future integration (e.g., Shopify order → reservation `source_type=customer_order`) slots in as a new enum value, not a schema change. That's already true of the current design — no additional work needed now.

**Priority:** Low — correctly deferred, no action needed in Phase 1.
**Estimated Future Cost if Ignored:** None — this isn't being ignored, it's correctly out of scope.

---

## 9. Delivery Process Validation

**Current State:** WBS assigns modules to agent types by folder ownership; no explicit merge/review/deployment process stated.

**Risks:**
- No stated merge strategy — if two agents both branch from main and the integration order isn't explicit, even folder-disjoint changes can produce a messy merge if migrations are involved (migration files often have ordering dependencies even when models don't conflict).
- No stated review gate — "self-review as code-reviewer persona" (CSO protocol) is good for solo-agent work but multi-agent parallel work needs an actual human or designated-agent merge gate before main, not just self-review.

**Recommendation:**
- **Merge strategy:** each epic = one branch, merged to main only when its own tests pass AND its migration is the newest one at merge time (rebase-before-merge on migrations specifically, even if models don't conflict) — migration ordering is the real hidden conflict source in parallel DB-schema work, not the code.
- **Review process:** every epic branch gets one designated review pass before merge (rotate which agent type reviews, e.g. Cursor reviews Claude Code's E0, Antigravity's QA harness reviews E5) — cross-agent review catches blind spots a single agent's self-review won't.
- **Deployment strategy:** not addressed yet anywhere — out of this review's scope to design fully, but flag now: decide staging vs direct-to-prod for Phase 1 before E6 finishes, not after.

**Priority:** Medium-high — the merge/migration-ordering risk is concrete and will hit during E2/E3's parallel work specifically (per WBS, they're explicitly parallel and both will add migrations).
**Estimated Future Cost if Ignored:** Migration ordering conflicts during exactly the parallel work the WBS designed for — undermines the plan's core goal if not addressed before E2/E3 start.

---

## FINAL — Architecture Readiness Score

| Dimension | Score /10 |
|---|---|
| Domain Design | 8 |
| Scalability | 6 |
| Maintainability | 7 |
| AI Agent Compatibility | 6 — drops here specifically because of the API contract gap (§4) and migration-ordering gap (§9), both AI-multi-agent-specific risks not present in a single-developer delivery model |
| Financial Readiness | 7 |
| Production Readiness | 5 — backups (§5) and warehouse_id (§1) gaps are the reason; both are cheap fixes, not deep flaws |

## Delivery Readiness Score

| Dimension | Score /10 |
|---|---|
| Parallel Development Readiness | 6 — WBS structure is sound, but unsafe without §4 (API contracts) and §9 (migration ordering) fixes |
| Merge Conflict Risk | Medium (folder ownership mitigates code conflicts; migration-ordering is the unaddressed residual risk) |
| Testability | 7 — seed/fixture strategy (§6) needed to make EX's "test-ahead-of-implementation" goal actually executable |
| Deployment Readiness | 3 — infra (§5) barely addressed before this review |
| Documentation Readiness | 6 — ED epic exists in WBS but no contract mechanism (§4) to keep docs accurate as code changes |

## Final Decision: **Ready With Minor Changes**

Not "Ready For Development" as-is — 4 items below must be resolved before E0 starts, not after. None require new architecture (Revision 1's design is sound) — they're delivery-process and schema-completeness gaps.

### Blocking Issues
1. No `warehouse_id` on ledger tables (§1) — add now, costs one nullable FK column.
2. `PurchaseOrder`/`PurchaseOrderLine` don't exist despite `po_id` being referenced in approved schema (§2) — minimum viable PO module needed before E2/E3 GRN features are buildable as specified.
3. No API contract mechanism (§4) — without it, parallel frontend/backend agent work is unsafe, not just inefficient.
4. No infra baseline — Docker + migration tool choice + backup strategy (§5) — must exist before E0's first migration.

### Suggested Resolution
1. Add `Warehouse` table + nullable `warehouse_id` FK to E0's scope.
2. Add minimal PO module (§2's scoped version) as a new epic, E0.5, before E2/E3 — small enough to not delay them meaningfully.
3. Stand up OpenAPI-from-code + CI diff-check as part of E0's infra setup, not a separate later epic.
4. Stand up docker-compose + pick migration tool + automated backup job before any agent writes the first migration.

### Estimated Effort
Items 1, 3, 4: each under a day, can run in parallel with each other (different concerns, no shared files). Item 2 (minimal PO module): roughly half a day, same complexity tier as E1 in the WBS.

### Recommended Owner
Items 1, 2: engineer persona, folded into/alongside E0 (warehouse_id) and as new E0.5 (PO module). Item 3: engineer persona, infra task, parallel with E0. Item 4: ops persona, parallel with E0 — none of these block each other, all can resolve in the same window before E1 starts.
