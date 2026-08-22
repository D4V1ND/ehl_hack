# Proposal — Slice B (Core API · System of Record · Seed Data) + Slice A (Cockpit UI)

Owner: Zeynep · Status: **built — §9 lists what shipped and what is deliberately left to other slices** · Against: [`sourcing_agent_plan_v3.md`](../../sourcing_agent_plan_v3.md) §6 Slice B + Slice A, reconciled with [`docs/PLAN.md`](../PLAN.md) and [`docs/specs/supplyguard-plan-1-foundation-spec.md`](../specs/supplyguard-plan-1-foundation-spec.md).

Read §1 first — there are three decisions I need from the team before I can freeze anything, and the rest of the document assumes my recommended answers.

---

## 0. What I found in the repo right now

Worth knowing before you read the layout, because two of these are landmines:

| Finding | Consequence |
|---|---|
| `supplyguard/` exists but is **completely empty** — only `record/`, `call/`, `record/demo_data/`, `call/rehearsals/` directories survive. `demo/fixtures/` is empty too. | Nothing to migrate. The directory names already map to Slices B and C, so I'll keep them. |
| **No `pyproject.toml` / `requirements.txt` anywhere.** `.venv` happens to have fastapi 0.141, pydantic 2.13, uvicorn, httpx, pyyaml, pytest 9.1, python-dotenv. | Nobody else can reproduce the env. Pinning this is part of my first commit. |
| **`node_modules/` is not installed.** | `npm install` is step zero. |
| **`app/page.tsx` uses ~14 Tailwind classes that don't exist**: `bg-canvas`, `text-ink`, `text-body`, `border-hairline`, `border-hairline-strong`, `bg-surface-card`, `bg-canvas-soft`, `bg-primary`, `text-on-primary`, `bg-primary-active`, `bg-timeline-*`, `text-muted-soft`, `text-muted-ink`. `app/globals.css` only has the stock shadcn neutral palette. | **The landing page is currently rendering unstyled-ish** — every one of those classes is a no-op. `DESIGN.md` defines all of them; they were never wired into Tailwind. Fixing this is task A0 and it is the single cheapest visual win available. (`text-muted-ink` is also a typo — `DESIGN.md` has `muted` and `muted-soft`, no `muted-ink`.) |
| Two plan docs disagree on the core contract: v3 says `Quote` + `POST /tools/quotes`; `docs/PLAN.md` §4 and the foundation spec say `Claim` + `POST /tools/claims`. | See decision **D2**. I serve this type and I render it, so I can't start without an answer. |
| `components/theme-provider.tsx` binds the bare key `d` to toggle theme. | Will fire on any keypress outside an input — including scrolling a demo with the keyboard. Recommend removing before the demo. |

---

## 1. Three decisions I need (with my recommendation)

### D1 — Python package root: `supplyguard/`, not `packages/`

Both plans write `packages/contracts/models.py`. I recommend **`supplyguard/contracts/models.py`** instead:

- `supplyguard/` already exists on disk with `record/` and `call/` subpackages matching Slices B and C.
- `CLAUDE.md` already names `supplyguard` as *the* package.
- `packages/` implies a monorepo with per-package build tooling we do not have and will not build this weekend.

One installable package, one import path: `from supplyguard.contracts import Claim`. **This is a 60-second decision; what matters is that it's frozen in hour 1, not which way it goes.**

### D2 — The contract type is `Claim`, not `Quote` — merge v3's commercial fields into it

`docs/PLAN.md` §2.6 already argues this and I agree with it strongly: *"what the supplier said"* is a claim, never a fact. Collapsing it into a `Quote` blob deletes the product's whole point — and `stock_status: in_stock_allocated` ("yes we have some" = "yes, but not for you") is the single most demo-able field we own.

But v3's `Quote` has commercial fields the spec's `Claim` lacks. **Recommendation: keep the name `Claim`, absorb v3's fields.** Final shape:

```python
Claim = {
  # identity
  task_id, case_id, supplier_id, round, call_id,
  # spec fields — unknown is always allowed
  qty_offered, earliest_ready_text,
  price_quoted: yes|no|unknown, unit_price: Decimal|None, currency,
  certification_current: yes|no|unknown, part_number_confirmed: yes|no|unknown,
  stock_status: free_in_stock|in_stock_allocated|to_be_made|unavailable|unclear,
  # absorbed from v3's Quote — the cost engine needs these
  price_breaks: [PriceBreak], moq, lead_time_days,
  expedite_option: {days, surcharge} | None,
  incoterm, certs_claimed: [...], payment_terms, notes,
  # provenance
  transcript_url, recording_url, confidence, evidence: [...], raw
}
```

Consequence: the endpoint is **`POST /tools/claims`**. v3 §4 needs a one-line edit.

### D3 — Demo scale: 36,000 pcs, not 8

`docs/PLAN.md` §2.6 conflict 1, unresolved. At a shortfall of 8 units there are no price breaks, no freight trade-off, no split order and no carrying cost — the entire §5 cost engine has nothing to chew on and Slice D has nothing to demo.

**Recommendation: 36,000 pcs against a 12-day line stop.** Keeps the spec's fixture *shape* exactly; changes only the numbers. See §5 for the full seeded scenario. **B1 cannot start until this is agreed** — it's the one thing in my slice that other people's work depends on being right.

---

## 2. Repo layout — everything I'd add

### 2.1 Backend and shared contracts

Matches the `backend/` + `packages/` layout the team settled on.

```
packages/contracts/          The frozen contract -- shared, everyone imports it
  models.py                  ALL Pydantic models. One file.
  enums.py                   StockStatus / Answer(yes|no|unknown) / Channel / Stage / PolicyRule ...
  money.py                   Decimal-only money. Exact in, string out. No float arithmetic.
  phone.py                   E.164 validation + masking. The only module handling raw numbers.
  safe.py                    claim_from_result() -- never raises, whatever it is handed
  export.py                  `python -m packages.contracts.export` -> the three consumers below
  schema.json                GEN  every model as JSON Schema
  claim.schema.json          GEN  the one Slice C hands CALL-E as recipient_result_schema

backend/                     Slice B -- the service
  record/                    B1 + B5 -- the system of record
    ports.py                 SystemOfRecord Protocol (the spec's two questions + ERP extras)
    mock_erp.py              MockERP: loads demo_data/*.yaml, validates, serves from memory
    demo_data/               company_profile / parts / suppliers / bins / boms
                             purchase_orders / item_supplier_prices / warehouses / incidents
  store/                     B2 -- cases/<id>/ is the database
    case_store.py            atomic writes, typed artifact read/write
    events.py                append-only events.jsonl, monotonic seq, poll with ?since=
  api/                       B3 -- one FastAPI process
    main.py  settings.py  deps.py  routers/{tools,cases,meta}.py
  detect/                    B4 -- shortage_detector.py (built last, ~30 lines)
  tests/                     test_seed_scenario / test_no_raw_phones
                             test_tools_contract / test_claim_never_raises

cases/                       Runtime output. The artifact IS the datastore.
Makefile                     install / test / api / ui / fixtures / detect
```

### 2.2 Cockpit (`ui/`)

```
ui/
  app/
    globals.css              DESIGN.md palette wired into Tailwind v4 @theme
    layout.tsx               Inter + JetBrains Mono, light-only
    page.tsx                 the existing landing page, now linked to the cockpit
    cockpit/page.tsx         ONE route. Six sections, narrative order.
  components/cockpit/
    primitives.tsx           Section / Stat / Card / Kicker / Mono / AwaitingSlice
    countdown.tsx            ticking time-to-line-stop
    event-dock.tsx           the pinned live event feed
    stage-rail.tsx           five stages, five pastels
    shortage-strip.tsx       parts at risk, worst first
    incident-panel.tsx       the shortage as our records see it
    supplier-table.tsx       what our own files say (masked phones only)
  lib/
    contracts.ts             GEN  TypeScript from the Pydantic models
    fixtures/*.json          GEN  a recording of the live endpoints
    api/client.ts            fixtures | live, one interface
    api/use-events.ts        2s poll, or replay at 4x -- same code path
    format.ts  stages.ts     money/date/qty/mask -- the stage -> colour map
```

---

## 3. Slice B in detail

### B0 — Contracts (do this first, it unblocks everyone)

One file, `supplyguard/contracts/models.py`. Reviewed for 15 minutes, then frozen; changes need a group ping.

`python -m supplyguard.contracts.export` emits:
- `contracts/schema.json` — every model as JSON Schema
- the `Claim` schema is what Slice C hands CALL-E as `recipient_result_schema` — **same model, no second definition**
- `demo/fixtures/*.json` — a full fixture bundle so Slice A builds with the backend off and Slice D iterates prompts without spending ACUs
- `lib/contracts.ts` via `json-schema-to-typescript` — the UI's types are generated from the Python models, so contract drift is structurally impossible. Good line for the judges.

**DoD:** `from supplyguard.contracts import Claim` works; `contracts/schema.json` is committed; `npm run typecheck` passes against generated types.

### B3 — Devin tool endpoints (stub before logic, ~45 min after B0)

Ship these returning fixture responses the same hour. Slice D needs a real URL to point a session at, not a promise.

```
GET  /healthz
GET  /schema/{model}                    → JSON Schema (Claim is what CALL-E gets)
GET  /profile                           → company profile (B5)

GET  /tools/part/{part_id}
GET  /tools/stock?part_id=&plant_id=
GET  /tools/suppliers?part_id=&approved_only=   ← phone_masked only, never raw
GET  /tools/price_history?part_id=&supplier_id=
GET  /tools/alternates?part_id=
GET  /tools/incident/{case_id}
POST /tools/outreach                    → OutreachTask[]  (hands off to Slice C)
POST /tools/claims                      → file a Claim into the case store
POST /tools/events                      → Devin narrates its own progress into the event log
```

Non-negotiables baked in, not bolted on:
- **No route may serialize a raw phone number.** `/tools/suppliers` returns `phone_masked: "+49 30 231*****12"`. Raw numbers exist only inside `record/mock_erp.py` and the literal CALL-E request body Slice C builds in-process. `test_no_raw_phones.py` scans every response body with an E.164 regex and fails if it matches anything.
- **Rehearsal is the default.** `POST /tools/outreach` with live calling not explicitly enabled returns rehearsal claims and touches no network. Never a fallback, never triggered by an unset variable.
- **Fast.** Devin burns ACUs while it waits. Everything is an in-memory dict lookup over YAML loaded once at startup. No I/O per request.

**DoD:** `curl` any endpoint → schema-valid data, p99 under 20 ms.

### B2 — Case store + event log

`cases/<case_id>/` is the database. Layout (Slice D writes most of it, I own the read/append primitives):

```
cases/CASE-001/
  sourcing_case.yaml   candidates.json      claims/*.json
  policy_report.md     cost_report.md       decision.md      po_draft.md
  events.jsonl         ← append-only, one JSON object per line, monotonic seq
```

JSONL rather than a JSON array: appends are a single `write()` with no read-modify-write, so Devin, CALL-E's webhook and the API can all append concurrently without corrupting it, and `tail -f` works for debugging.

`GET /cases/{id}/events?since=<seq>` returns everything after `seq`. UI polls every 2s. §3 of the plan is right that this looks identical to WebSockets on stage and costs a tenth as much.

### B5 — Company profile (30 lines of YAML, but Slice D's policy rules read it — do it early)

```yaml
legal_entity: Meridian Motors GmbH
country: DE
blocked_origin_countries: [CN, RU, BY, IR]
required_certifications:
  rolling_bearing:  [ISO_9001, DIN_625_CONFORMITY]
  fastener:         [ISO_9001]
audit_required_above_criticality: high
budget_thresholds: {single_po_eur: 75000, requires_second_quote_above_eur: 25000}
cost_model: {wacc: 0.089, warehousing_eur_per_pallet_month: 14.50, ...}
```

Every one of Slice D's four policy rules reads exactly one field from this file. That's what makes "rejected by name, citing the rule" possible.

### B4 — Shortage detector (build LAST)

Cron every 60s over the mock ERP: `actual_qty - reserved_qty < reorder_level` **or** an open PO whose revised date now lands past the requirement date → `POST` to Slice D's launcher. ~30 lines. It is the sentence the track asks for, which is exactly why it comes last and not first.

---

## 4. Slice A in detail

### 4.0 — A0: fix the design system first (~45 min, unblocks every other UI task)

1. **Wire `DESIGN.md` into Tailwind v4.** Add the full palette to `@theme` in `globals.css` so `bg-canvas` / `text-ink` / `border-hairline` / `bg-timeline-*` actually resolve. This alone fixes the existing landing page.
2. **Fonts:** `Inter` (DESIGN.md's named CursorGothic substitute, weight 400 with -1.5% tracking on display) + `JetBrains Mono` for every code, number and identifier surface. Currently Geist/Geist Mono.
3. **Light only.** The warm cream canvas *is* the brand; a dark cockpit would look like every other hackathon dashboard. Leave the `.dark` block in place, spend zero time on it, and remove the bare-`d` theme hotkey.

### 4.1 — The look, stated as rules so it stays consistent

> Warm cream editorial canvas, hairlines instead of shadows, one orange accent used scarcely, and every number in JetBrains Mono. It reads as a quietly-confident developer tool, not a BI dashboard — which is the point, because the pitch is "procurement is an engineering problem."

- **One question per screen.** Dashboard answers *what's on fire*. Case page answers *what did the engineer do*. Nothing else gets a screen.
- **The five timeline pastels are the stage language**, used identically in the event dock, the stage rail and the candidate cards. One colour, one meaning, everywhere:

  | Stage | Token | Colour |
  |---|---|---|
  | `detected` | `timeline-thinking` | peach |
  | `researching` | `timeline-grep` | mint |
  | `calling` | `timeline-read` | blue |
  | `costing` | `timeline-edit` | lavender |
  | `decided` | `timeline-done` | gold |

  (`DESIGN.md` scopes these to in-product agent visualisations only — the cockpit *is* that visualisation, so this is on-brand, and it keeps the orange free for the one CTA that matters.)
- **Numbers are monospaced, `tabular-nums`, right-aligned in tables.** Money always carries its currency and is never a bare float — the same rule as the backend, visible.
- **Every rejection shows the rule name in mono** (`blocked_origin_country`) next to a plain-language sentence. That is the screenshot that sells the product; it should be impossible to miss on the page.
- **Two motions only:** event rows fade+slide in, and the line-stop countdown ticks. No page transitions, no skeleton shimmer theatre.

### 4.2 — Navigation: one scrolling case page, not tabs

The case page is the demo script, so it should read top-to-bottom in the order you'd narrate it:

```
┌──────────┬───────────────────────────────────────┬──────────────┐
│ app rail │  CASE-001 · 6204-2RS · ⏱ 11d 04h      │  event dock  │
│          ├───────────────────────────────────────┤              │
│ Cockpit  │  ▸ Shortage      the incident         │ 14:02 detected│
│ Cases    │  ▸ Candidates    6 found, 3 rejected  │ 14:02 research│
│ Suppliers│  ▸ Calls         3 in flight          │ 14:03 calling │
│ Settings │  ▸ Claims        said vs. our records │ 14:05 claim   │
│          │  ▸ Cost          strategies compared  │      …        │
│          │  ▸ Decision      the PR               │              │
└──────────┴───────────────────────────────────────┴──────────────┘
   220px              max 880px, sticky scroll-spy      320px, collapsible
```

Why scrolling over tabs: on stage you never click between tabs mid-sentence, there are no per-tab loading states, and the whole story stays screenshot-able in one scroll. The event dock stays pinned so the "it's alive" signal is visible in every section.

### 4.3 — Backend-off by default, and `?replay=4`

`NEXT_PUBLIC_DATA_SOURCE=fixtures` is the default. The UI imports `demo/fixtures/*.json` directly and renders the full story with no backend, no network, no Python. `npm run demo` is just `next dev`.

`?replay=4` reads `case-001.events.jsonl`, rescales the timestamps to 4× and streams them into the event dock and the stage rail. Roughly 40 lines, and it means:
- the frontend never waits on the backend during development,
- the demo survives venue wifi dying,
- and it's the same code path as live polling, so it isn't a fake that rots.

This is the highest-value 40 lines in the whole slice. I'd build it in the first UI block, not the last.

---

## 5. The seeded scenario — B1's real deliverable

*Believable data is not optional; the demo lives or dies here.* And the seed has one job: **make the naive answer wrong.**

### 5.1 The incident (CASE-001)

| | |
|---|---|
| Part | `6204-2RS` deep-groove ball bearing, DIN 625 · `part_class: rolling_bearing` · 0.102 kg · HS 8482.10 |
| Plant | `PLANT-MUC`, assembly line `ASSY-3`, consumes 1,500 pcs/day |
| Stock | 4,200 on hand · reorder level 9,000 |
| Trigger | Open PO `PO-2291` from the incumbent for 30,000, promised day 4, **revised to day 26** |
| Need | 36,000 pcs by day 12 (2026-09-03) |
| Cost of standing still | €18,400/hour |

### 5.2 The six candidates — every policy rule fires exactly once

| Supplier | Country | Unit @ vol | Lead | Capacity | Outcome |
|---|---|---|---|---|---|
| Kugellager Bayern (incumbent) | DE | €1.55 | 8 d road | **12,000 free · 18,000 allocated** | quotes — fast, but `in_stock_allocated` means it can't cover |
| SKF Deutschland Vertrieb | DE | €1.72 @25k | 6 d road | 36,000 | quotes — fast and dear |
| Rulmenti Est SRL | RO | €1.18 @20k · €0.98 @50k | 21 d road | 60,000 | quotes — **cheapest, and too late alone** |
| Ningbo Precision Bearing | CN | €0.74 @50k | 34 d sea | 100,000 | ❌ `blocked_origin_country` — *and* routes to email, not voice (no CALL-E CN region) |
| Anadolu Rulman A.Ş. | TR | €1.05 @25k | 16 d road | 40,000 | ❌ `missing_required_certification` — ISO 9001 expired 2026-03-31 |
| NordBearing Trading ApS | DK | €1.28 @25k | 8 d road | 36,000 | ❌ `audit_required_and_not_audited` — new supplier, part criticality `high` |

Three rejections, three *different* rules, each nameable on stage. The fourth rule — `lead_time_after_line_stop` — fires against Rulmenti the moment the cost engine tries to single-source it. **All four policy rules are visible in one case.**

The winning answer is a split: a fast tranche that covers the line-stop date plus a cheap tranche that arrives later and carries the volume — which beats every single-source option on total landed cost *and* meets the date. Splitting costs SKF its 25k price break, and that tension is exactly what makes the cost engine's answer non-obvious. A chatbot doesn't find this; a model with tests does.

### 5.3 `test_seed_scenario.py` — the seed data has its own test suite

This is B1's DoD, and it's the part I'd most like feedback on. Four invariants:

1. The cheapest-unit-price compliant supplier **misses** `line_stop_at` when single-sourced → the naive answer is provably wrong.
2. The fastest compliant supplier **cannot cover `qty_required` alone** (allocation cap) → single-sourcing is impossible, not merely suboptimal.
3. The best two-line split beats the best single-source total by **≥ 8%** → the comparison table has a punchline.
4. **Exactly three** candidates fail policy, one per distinct rule → every rule is on screen.

If someone tunes a number on Saturday night and quietly kills the drama, this goes red instead of us finding out on stage. Exact figures get retuned once Slice D's `cost_model.py` lands — the test is what keeps them honest in the meantime.

### 5.4 Phone numbers

Officially reserved fictional ranges only, per `CLAUDE.md`. German suppliers use the BNetzA drama range **+49 30 23125 xxxx**; each other country gets its own reserved range (checked individually, not guessed). Stored raw in `demo_data/suppliers.yaml`, masked at every serialization boundary, asserted by `test_no_raw_phones.py`.

---

## 6. Build order

The ordering is the whole point — the first block unblocks two other people, so it ships before anything pretty.

| Block | Tasks | Unblocks | Rough |
|---|---|---|---|
| **1** | `pyproject.toml` · **B0 contracts + schema export + fixture bundle** · **B5 profile** | Slice C's `recipient_result_schema`, Slice D's policy rules, Slice A's types | ~1.5 h |
| **2** | **B3 stubbed** — all tool endpoints, fixture responses, schema-valid | Slice D can point a real session at a real URL | ~45 min |
| **3** | **A0** — DESIGN.md tokens, fonts, cockpit shell, fixture data layer, **`?replay=4`** | every other UI task | ~1.5 h |
| **4** | **B1 seed data** + `test_seed_scenario.py` ∥ **A1 dashboard** + **A2 event dock** | Slice D's cost engine gets real numbers | ~3 h |
| **5** | **B2 case store + event log** · **A3 candidate board** (rejection badges, stock-status chips) | the compliance-rejection beat | ~2.5 h |
| **6** | **A4 calls panel** · **A5 claim-vs-record + strategy compare + charts** · **A6 decision** | the demo | ~3.5 h |
| **7** | **B4 shortage detector** — last, ~30 lines | the "no human in the loop" sentence | ~30 min |

Blocks 1–3 are what I'd want green before the hour-3 walking-skeleton checkpoint.

---

## 7. The interface between me and you

**What I hand you, and when:**

| To | What | When |
|---|---|---|
| Slice C | `Claim` JSON Schema at `GET /schema/Claim` — paste straight into `recipient_result_schema`. `OutreachTask` shape for the dispatcher. | end of block 1 |
| Slice D | Every `/tools/*` endpoint live with fixture data · `contracts/schema.json` · `/profile` for the four policy rules · `POST /tools/events` to narrate into the log | end of block 2 |
| Slice D | Seeded ERP with the spread that makes the split win, plus the test that proves it | end of block 4 |
| Everyone | `demo/fixtures/` — develop with no backend, no network, no ACUs | end of block 1 |

**What I need from you:**

| From | What | When |
|---|---|---|
| Everyone | **D1, D2, D3 answered** (§1) | before I write a line |
| Slice C | Confirm the `Claim` field list survives contact with CALL-E's real response shape | block 1 |
| Slice D | The launcher URL/signature `POST /cases` should call, and the `Event` `stage` vocabulary you'll emit | block 3 |
| Slice D | Real `LandedCost` / `Strategy` output once `cost_model.py` lands, so I can retune the seed | block 5 |

**Explicitly not mine:** the cost engine, the policy rules, the Devin prompt pack, the CALL-E client, the artifact writer, the PR. I serve the data those read and I render what they produce.

---

## 8. MVP cut — what the UI actually is for the hackathon

Added after review. §4 above is the *level-up* target; this section is what gets built this weekend. The reasoning is that the UI is **not the graded deliverable** — the Cognition track grades Devin's autonomy, the self-checking suites and the PR. The cockpit's only job is to make four minutes of invisible agent work legible, and to land the punchline. Every hour spent on it past that point is an hour not spent on Slice D.

### 8.1 The decision: one page, progressively revealed, driven by a recorded event log

**One route. No dashboard, no case list, no tabs, no dynamic segment.** `app/cockpit/page.tsx`, `CASE-001` hardcoded with a `?case=` override.

```
┌────────────────────────────────────────────┬──────────────┐
│  stockout · CASE-001 · 6204-2RS · ⏱ 11d04h │              │
├────────────────────────────────────────────┤  event dock  │
│  ① Shortage      [Launch sourcing agent]   │  14:02 ●     │
│  ② Candidates    6 found · 3 rejected      │  14:02 ●     │
│  ③ Calls         3 placed · stock status   │  14:03 ●     │
│  ④ Claims        said vs. our records      │  14:05 ●     │
│  ⑤ Cost          4 strategies compared     │  …           │
│  ⑥ Decision      → the pull request        │              │
└────────────────────────────────────────────┴──────────────┘
          max 880px, sections mount in sequence      320px
```

**The mechanic that replaces four screens:** before launch only ① is visible. Press *Launch sourcing agent* and the recorded event log streams at 4×; each section mounts with a fade+slide as its stage arrives, and the page auto-scrolls to the newest one. Pressing one button and watching the story write itself down the screen *is* the "agent is working" feeling — it does the job of the dashboard, the timeline page and the live-calls page at once, and it costs a fraction of them.

Why this is the right MVP shape:

- **Zero routing work.** No route transitions, no per-route loading or error states, no `[caseId]` plumbing, no nav that can be clicked into a dead end mid-demo.
- **The narrative order is the DOM order.** The page can't get out of sync with the pitch, because it *is* the pitch.
- **It degrades silently.** A section with no data simply never appears. A half-finished cost engine on Saturday night costs us a section, not a broken page.
- **Fully offline and deterministic.** No backend, no network, no ACUs, no venue wifi.

### 8.2 Fixtures are a *recording*, not a mock — and we say so on stage

`make record` captures a real end-to-end run's `events.jsonl` and case artifacts into `demo/fixtures/`; the committed fixture is that recording. `?replay=4` plays it back through the same code path live polling would use.

This matters for how it's framed: *"this is Tuesday's run played back at 4× — here's the commit that recorded it, and here's the live PR it opened. We can run it cold in 90 seconds afterwards if you'd like."* That is a stronger answer than a live run that might stall on stage, and it is honest — nothing on screen is invented.

### 8.3 Scope, explicitly

**Build (≈5–6 h):**

| | Why it survives the cut |
|---|---|
| **A0 — DESIGN.md tokens + Inter/JetBrains Mono** | ~45 min, and it also repairs the existing landing page, which is currently half-styled |
| Top bar + live line-stop countdown | the entire sense of urgency, for ~20 lines |
| ① Shortage panel + launch button | the "before" state that motivates everything |
| ② Candidate cards + **rejection badges naming the rule** | the screenshot that sells the product |
| ③ Call cards, masked numbers, **stock-status chips** | `in_stock_allocated` is our sharpest field — §2.6 is right |
| ④ Claim-vs-record table | the claim/record separation, which is the differentiator. It's just a table |
| ⑤ **One** chart: four strategies as stacked landed-cost bars, with a "misses line stop" marker on the ones that do, split highlighted | carries cost *and* time in one image — the whole punchline |
| ⑥ Decision panel + PR link | the artifact |
| Right-hand event dock, stage-coloured | the "it's alive" signal, visible in every section |
| `?replay=4` | ~40 lines; makes all of the above demoable with everything switched off |

**Do not build:** dashboard route · case list · app rail · tabs · dynamic routing · dark mode · responsive below 1024px (the demo is a projector at fixed width) · live transcript streaming · price-break curve · lead-time track · skeletons · error states · empty states · settings · auth · the landing page beyond the token fix.

**Level-up slide (say these out loud as roadmap, don't build them):** multi-case dashboard, live backend polling instead of replay, transcripts streaming in as CALL-E emits turns, the price-break curve, mobile.

### 8.4 Effect on the build order in §6

Blocks 1–3 are unchanged — contracts, stubbed tool endpoints, and A0 + shell + replay still come first and still unblock everyone else. Blocks 5 and 6 collapse into a single UI block of six sections against fixtures, and the freed time goes to B1's seed data and to Slice D, which is where the grade is.


---

## 9. What shipped, and what is deliberately not here

Built and green -- `make test` runs 62 backend tests plus the UI typecheck, and
touches no network.

| | |
|---|---|
| **packages/contracts** | 22 models, 11 enums. One command exports JSON Schema, TypeScript and the fixture bundle, so `Claim` is simultaneously our Python type, CALL-E's `recipient_result_schema` and the cockpit's interface. |
| **B1 seed data** | 40 parts, 15 suppliers, 2 plants, 3 BOMs, 260 price-history rows, 6 open POs, 2 incidents -- referentially checked at load, so bad data fails at boot rather than in front of a judge. |
| **B5 company profile** | Blocked origins, certifications per part class, audit threshold, budget gates, WACC, warehousing rate, duty by origin, freight and transit by mode. |
| **B2 case store** | `cases/<id>/`, atomic writes, append-only `events.jsonl` with monotonic seq. |
| **B3 tool endpoints** | 12 reads + 4 writes, all in-memory, all schema-checked by test. |
| **B4 shortage detector** | Reorder-point + PO-slip scan, idempotent, stops at the launcher hook. |
| **Slice A cockpit** | One route, six sections, pinned event dock, replay at 4x, fully offline. |

**Not built, on purpose.** These belong to other slices, and fabricating them
would misrepresent someone else's output:

- Policy evaluation, the cost model, strategy search, the decision and its
  artifacts (**Slice D**). The cockpit has a real section for each, stating what
  will appear and which endpoint produces it.
- CALL-E's client, its webhook, the call script and rehearsal personas
  (**Slice C**). `POST /tools/claims` accepts a claim and never raises; mapping
  CALL-E's own response shape onto our field names is the webhook's job.
- The Devin session launcher (**Slice D**). `open_case()` takes a hook and calls it.

**Two things needing a team decision:**

1. `packages.contracts` is the import path. If Davin's tree already has a
   contracts module, the two must be merged into this one before anyone builds
   on either -- it is meant to be frozen after fifteen minutes of review.
2. Seed phone numbers all use the German BNetzA drama range (`+49 30 23125 xxxx`),
   including for non-German suppliers, because guessing another country's
   fictional range risks hitting a real subscriber. None is ever dialed
   (rehearsal is the default; live rehearsals use a teammate's own number from
   their env). Swap to per-country reserved ranges before any real call.
