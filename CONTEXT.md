# Silaa ERP — Complete Agent Context

> **This file is the single source of truth for any AI agent resuming work on this project.**
> It lives in git and must be updated after every significant change.
> Last updated: 2026-07-03 (perf + styles qty/edit + PO detail/print + fabric edit UX)

---

## What This Is

Internal ERP for "Silaa", a clothing-manufacturing brand. Replaces Excel/WhatsApp for fabric management, production orders, accessories, costing, and now expenses. Template-first design — the goal is a system that can be white-labelled for any garment manufacturer.

**Owner:** Manoj (kbdcreditsolutions@gmail.com)  
**Repo:** https://github.com/manojtyson-37/Silaa (push with `gh auth switch -u manojtyson-37` first)

---

## Stack

### Backend (`backend/`)
- **FastAPI** + SQLAlchemy (ORM) + Alembic (migrations)
- **Python 3.9** — requires `from typing import Optional` explicit import (not inferred)
- **Database:** Supabase Postgres (`nxwiyupkznedqknwquhc`) via Session pooler, psycopg3 driver (`postgresql+psycopg://`)
- **Auth:** stdlib HMAC-signed tokens, 12-hour TTL, single admin user. Secret key: `AUTH_SECRET_KEY` env var. Credentials: `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars.
- **Upload:** Supabase Storage bucket `silaa-images`. Needs BOTH `apikey` AND `Authorization: Bearer` headers — new `sb_secret_*` keys are NOT JWTs, Bearer-only returns 403.

### Frontend (`frontend/`)
- **Next.js 16.2.9** (breaking changes from older versions — read `node_modules/next/dist/docs/` before assuming APIs)
- **TypeScript** + Tailwind v4 (PostCSS pipeline — use `next/font/google`, never CSS `@import`)
- **Forced light mode** — internal ops tool, never dark mode
- **Port:** dev server on **3001** (port 3000 is occupied by CSO Dashboard on this machine)

---

## Infrastructure

### Production
| Layer | Detail |
|-------|--------|
| **Frontend** | Vercel, https://silaa-sigma.vercel.app — Root Directory: `frontend`, env var `NEXT_PUBLIC_API_BASE` = `https://silaa-erp.duckdns.org` |
| **Backend** | DigitalOcean droplet `jodo-ops-agent`, IP `143.110.183.143`, Docker Compose, port 8000 |
| **HTTPS** | Caddy v2 systemd service on droplet → reverse proxy to localhost:8000. Auto-HTTPS via Let's Encrypt. DuckDNS cron renewal every 5 min. TTFB ~35ms. |
| **Domain** | `silaa-erp.duckdns.org` — DuckDNS free subdomain, token in droplet env. **Stable across rebuilds** (no tunnel needed). |
| **Database** | Supabase Postgres, project `nxwiyupkznedqknwquhc`, https://supabase.com/dashboard/project/nxwiyupkznedqknwquhc |
| **SSH** | `ssh -i ~/.ssh/silaa_deploy root@143.110.183.143` |

> **Cloudflare Quick Tunnel removed 2026-07-03.** No longer using `cloudflared`. Caddy+DuckDNS is stable — no URL changes on rebuild.

### Deploy backend changes:
```bash
ssh -i ~/.ssh/silaa_deploy root@143.110.183.143
cd /root/Silaa && git pull
docker compose up -d --build
# Migrations run automatically as container startup command
```

### Deploy frontend changes:
```bash
git push origin main  # Vercel auto-deploys from main
```

### Vercel account: `manojtyson-37` (not `travelkathegalu`)
Always run `gh auth switch -u manojtyson-37` before any git push.

---

## Environment Files

**Local:** `/Users/manojaaa/Silaa Collective/.env` (gitignored)  
**Droplet:** `/root/Silaa/.env`

Key vars (never commit, never print to stdout):
```
DATABASE_URL=postgresql+psycopg://...  (Supabase session pooler)
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
AUTH_SECRET_KEY=...
SUPABASE_URL=https://nxwiyupkznedqknwquhc.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
FRONTEND_ORIGINS=https://silaa-sigma.vercel.app
```

**CRITICAL:** Never type secrets into browser automation tools (preview_fill, preview_eval, Chrome MCP type). Safety classifier treats it as credential materialization and blocks the turn.

---

## Local Dev

```bash
# Backend (from project root)
cd backend && source ../.env && uvicorn app.main:app --reload --port 8000

# Or use the helper (loads env automatically):
bash backend/run_dev.sh

# Frontend
cd frontend && npm run dev  # starts on port 3001

# Migrations (ALWAYS source .env first to hit Supabase, not local SQLite)
cd backend && source ../.env && alembic upgrade head
```

**Warning:** Alembic default target is local SQLite (`erp.db`). Without sourcing `.env`, migrations run against SQLite silently and Supabase schema stays stale.

---

## What's Built (Phase 1 — Complete)

### Backend modules (`backend/app/`)
- `core/` — append-only ledger base, generic balance helper, polymorphic refs, Warehouse
- `procurement/` — Supplier, PurchaseOrder (+ description, image_url, dispatch_date, tax_rate, payment_terms added 2026-07-03), PurchaseOrderLine. `GET /purchase-orders/{id}` returns `PurchaseOrderDetail` with lines. `PATCH /purchase-orders/{id}` accepts new fields (draft-only).
- `uom/` — UnitOfMeasure + UOMConversion (frozen at write time)
- `fabric_inventory/` — GRN, issue, adjust, landed costs (concurrency-safe, row lock). `GET /fabric-lots-with-balance` bulk endpoint — balance computed server-side per lot.
- `accessory_inventory/` — GRN, issue, adjust (backend kept; UI removed per client request)
- `style_variant/` — Style (grouping only) + StyleVariant (real stock unit, includes `qty` field added 2026-07-03). `GET /styles-with-variants` bulk endpoint (1 IN query, no waterfall). `PATCH /variants/{id}` for inline edit.
- `bom/` — BOM + BOMVersion + BOMItem (immutable once created)
- `production/` — ProductionOrder, CuttingRecord, StitchingBatch, 5-state QC, ReworkRecord, audit log
- `finished_goods/` — FinishedGoodsLedgerEntry, 9 txn_types, cost rollup
- `orders/` — SalesOrder, atomic fulfill/cancel, 409 on insufficient stock
- `dashboard/` — summary endpoint (open orders, pending POs, recent events)
- `reports/` — fabric variance, wastage/rejection reports
- `auth/` — HMAC token login, 12h TTL, single admin
- `expenses/` — ExpenseCategory, Expense, CategoryBudget, CompanySetting (v2)
- `upload/` — Supabase Storage upload (10MB cap, public bucket `silaa-images`)

### Frontend pages (`frontend/src/app/`)
- `/` — Dashboard (stat cards + recent activity)
- `/login` — Auth
- `/styles` — Style cards with variant tables. **Size dropdown** (XS–4XL + waist sizes), **Qty column**, inline pencil edit per row (`EditVariantRow` → `PATCH /variants/{id}`), inline "+ Add variant" form per card (`NewVariantForm`). Data from `/styles-with-variants` bulk endpoint.
- `/fabric` — Fabric item cards. **Click any card** → full-width edit panel expands below grid (was cramped inline). Lots table with balance from `/fabric-lots-with-balance`.
- `/purchase-orders` — PO list with Dispatch column. Rows link to detail page.
- `/purchase-orders/[id]` — **PO detail**: editable when draft (dispatch date, tax%, payment terms dropdown, description textarea, reference photo upload). Line items with subtotal/tax/total breakdown.
- `/purchase-orders/[id]/print` — **Sales Order PDF**: auto-triggers `window.print()`, styled invoice (SO-XXXX, bill-to, dates, payment terms, notes, line items, totals). "Download PDF" button.
- `/production` — Production order list
- `/production/[id]` — Detail with inline cutting/stitching/QC forms (no scroll, no modal)
- `/sales-orders` — Sales order list + fulfill/cancel + margin
- `/reports` — Fabric variance + wastage
- `/expenses` — Full expense tracker (v2)

**All routes have `loading.tsx` skeleton screens** (sidebar stays rendered, content pulses). Global `error.tsx` error boundary with "Try again" button. `api.ts` 401 → auto-redirect to `/login`.

### Expenses v2 features (added 2026-07-03)
- 3-card summary: Total This Month · Top Category · vs Last Month %
- Month filter with ◀ ▶ navigation
- CSV export (formula-injection sanitized)
- Category budget tracking: per-category monthly limit, progress bar (red when over)
- Recurring flag on expenses (↻ icon)
- Receipt file upload to Supabase storage per expense
- Currency setting (₹ INR default, supports USD/EUR/GBP/JPY) — stored server-side in `company_setting` table

### Current migrations (in order)
```
b61d80ea9706 — initial schema (all core modules)
7b1f898f30fd — orders module
23acf63d71f9 — labor cost on stitching batch
afaa38bf4300 — image URLs + expenses v1 (ExpenseCategory, Expense)
c1a2b3d4e5f6 — icon field on ExpenseCategory
d1e2f3a4b5c6 — expenses v2 (receipt_url, is_recurring, CategoryBudget, CompanySetting)
e2f3a4b5c6d7 — qty (INTEGER DEFAULT 0) on style_variant
f3a4b5c6d7e8 — description/image_url/dispatch_date/tax_rate/payment_terms on purchase_order
```

---

## What's NOT Built Yet

- **Shipping module** — the only remaining Phase 1 gap
- Phase 2/3: Employee Mgmt, Tailor Productivity, Shopify/Razorpay/WhatsApp integrations

---

## Design Rules (non-negotiable)

1. **Inline edit everywhere.** Edit icons always visible (never hover-only). Pencil icon on every row. No modals, no scroll-to-top on edit. Form opens in-place.
2. **No raw HTML color pickers.** Use curated icon grid + 8 preset color swatches.
3. **Fabric width in METERS** — not cm, not inches. Client confirmed. Never override.
4. **Template-first.** Every module must be configurable, no hard-coded business assumptions. This will be white-labelled.
5. **Forced light mode.** `color-scheme: light` in globals. Never invert.

---

## Critical Bugs Fixed (2026-07-03)

| Commit | Fix |
|--------|-----|
| `0da25a4` | `serverAuth.ts` — `tokenExpired()` check; expired tokens redirect to `/login` instead of crashing page with "server error" |
| `35ee45d` | `api.ts` — handle 204 No Content; `res.json()` on empty DELETE response threw "Unexpected end of JSON input", breaking ALL deletes |
| `c49e7d2` | `ExpenseClient.tsx` — surface server error message on category delete (was generic string) |
| `02aac25` | `api.ts` — parse FastAPI `{"detail":"..."}` JSON error bodies; `ExpenseClient.tsx` — silently remove 404 categories from local state |
| `b50db51` | `api.ts` — `if (res.status === 401) redirect("/login")` in request(); 401 from expired token was crashing Server Components into error boundary instead of redirecting |
| `2617b57` | `StylesClient.tsx` — empty `<Th>` needs non-empty children for TS; build was failing on Vercel |

---

## Known Gotchas

### Token expiry
- Auth tokens expire after **12 hours**. After expiry, all server components return 401 from backend → Next.js shows "server error" page.
- Fix (deployed): `requireAuth()` in `frontend/src/lib/serverAuth.ts` now checks expiry and redirects to `/login` gracefully.
- After any Docker rebuild on droplet, existing tokens ARE still valid (key is stable in `.env`).

### ~~Cloudflare tunnel URL is ephemeral~~ — RESOLVED
- Replaced with Caddy + DuckDNS on 2026-07-03. URL `silaa-erp.duckdns.org` is stable across rebuilds.
- `NEXT_PUBLIC_API_BASE` in Vercel = `https://silaa-erp.duckdns.org` (permanent).
- `FRONTEND_ORIGINS` in droplet `.env` = `https://silaa-sigma.vercel.app` (permanent).

### Alembic hits SQLite by default
- Always `source .env` before running alembic to target Supabase.
- PostgreSQL boolean: `server_default=sa.text("false")` — not `"0"` (SQLite accepts it, Postgres rejects with DatatypeMismatch).

### FastAPI error format
- All HTTPException errors come as `{"detail":"message"}` JSON.
- `api.ts` now parses this and extracts `.detail` for clean error display.
- `typeof j.detail === 'string'` guard handles validation errors where detail is an array.

### Next.js 16 breaking changes
- `params` in server components must be `await`-ed
- `fetch` is uncached by default — must set `cache: "no-store"` explicitly
- Middleware file renamed to `proxy.ts` in this project

### Supabase storage keys
- New `sb_secret_*` keys are NOT JWTs. Storage API needs BOTH `apikey` AND `Authorization: Bearer` headers.
- Bearer-only returns `403 Invalid Compact JWS`.

---

## Agent Workflow Rules

### Before ANY push to main
1. Wait for Vercel deploy: `gh api "repos/manojtyson-37/Silaa/deployments?per_page=1" --jq '.[0].id' | xargs -I{} gh api "repos/manojtyson-37/Silaa/deployments/{}/statuses?per_page=1" --jq '.[0].state'`
2. Navigate Chrome MCP to `https://silaa-sigma.vercel.app/expenses` (or changed page)
3. Take screenshot: `mcp__claude-in-chrome__computer action=screenshot save_to_disk=true`
4. Show screenshot — only then declare done

### Verification tools
- **`preview_screenshot`** — shows localhost:3001 (local dev). NOT production.
- **Chrome MCP screenshot** — shows actual live URL. Use for production verification.
- These look the same in tool output but show completely different pages.

### Diagnosing bugs
- Reproduce the exact scenario first. Check WHICH entity, WHAT HTTP status, WHAT response body.
- Backend logs: `docker logs silaa-app-1 --tail 30` on droplet
- Don't assume error cause from code alone — look at actual response.

### Git identity
- Always `gh auth switch -u manojtyson-37` before pushing this repo.
- `travelkathegalu` account = different project, don't mix.

### CSO protocol
- State files: `/Users/manojaaa/Agents and Skills/.cso/state/`
- Run `/cso-learn` before declaring any task complete
- `workflow_state.json` gets overwritten by daemon — treat as best-effort, not source of truth

---

## File Structure Quick Reference

```
Silaa Collective/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, all routers registered here
│   │   ├── db.py            # SQLAlchemy engine + session
│   │   ├── auth/            # HMAC token auth
│   │   ├── expenses/        # models.py + router.py (full v2)
│   │   ├── upload/          # Supabase storage upload
│   │   └── [other modules]
│   ├── alembic/versions/    # Migration files
│   ├── requirements.txt
│   └── run_dev.sh           # Starts backend with .env loaded
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages (App Router)
│   │   │   ├── expenses/
│   │   │   │   ├── page.tsx        # Server component, fetches all data
│   │   │   │   └── ExpenseClient.tsx  # Client component, all interactions
│   │   │   └── [other pages]
│   │   ├── components/
│   │   │   ├── ui.tsx       # Card, Button, Input, Select, StatusPill, Table
│   │   │   └── Sidebar.tsx  # Nav sidebar
│   │   └── lib/
│   │       ├── api.ts       # Fetch wrapper, all type defs
│   │       └── serverAuth.ts  # requireAuth() — reads cookie, checks expiry
│   └── .env.local           # NEXT_PUBLIC_API_BASE (gitignored)
├── infra/docker/Dockerfile
├── docker-compose.yml
├── CONTEXT.md               # ← this file
└── .env                     # All secrets (gitignored)
```

---

## How to Update This File

After any significant change, update the relevant sections and commit:
```bash
git add CONTEXT.md && git commit -m "docs(context): update after [what changed]" && git push origin main
```

Sections to update after common tasks:
- New feature → "What's Built" section + recent commits table
- New migration → "Current migrations" list
- New bug/gotcha → "Known Gotchas"
- Infrastructure change → "Infrastructure" section
- New design rule → "Design Rules"
