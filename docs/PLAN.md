# SupplyGuard — Build Plan & Vertical Slices

EHL Game Jam Munich · Cognition "Devin for X" track · team of 4 · ~weekend

**Read this whole document, then comment on this PR.** Nothing here is final until we've all commented. Slice ownership is **not** assigned yet — that's the next conversation. What *is* settled: the contracts in §4 must be frozen in hour 1, and the walking skeleton in §3 must exist by hour 3.

This plan builds **on top of** [`docs/specs/supplyguard-plan-1-foundation-spec.md`](specs/supplyguard-plan-1-foundation-spec.md). That spec is the foundation layer (calls → typed claims) and stands. §2.6 lists exactly what this plan adopts from it, what it adds, and the three places the two conflict.

---

## 1. What we're building

> **Procurement is an engineering problem. Give it an engineer.**
>
> A German automotive manufacturer is 12 days from a bearing shortage across its Munich and Stuttgart plants. Devin reads the system of record, finds Candidates, launches parallel **CALL-E** Outreach Tasks, checks Claims against Supplier Records, runs landed-cost and compliance models, and presents one Decision in Stockout. A human marks that Decision approved; approved is final.

### Why this wins the Cognition track

| Track requirement | How we satisfy it |
|---|---|
| "output can be expressed as code" | Policy and landed-cost checks remain executable and testable; the user-facing output is an auditable Decision in Stockout. |
| "programmatically triggers Devin sessions" | Reorder-point scanner / webhook / UI button → `POST /v1/sessions` on the Devin API. No human writes the prompt. |
| "gives them a way to check their own work" | Two `pytest` suites per case — the compliance policy and the cost model. Both must be green before the Decision is ready for approval. |
| "produces real artifacts without a human in the loop" | Structured Claims, checked Strategies, and a costed recommendation are produced before human approval. |

**The differentiator to say out loud:** everyone else will demo "an agent that calls a supplier." We demo the autonomous layer: Devin is the procurement engineer, CALL-E is one tool, checks are executable, and the human approves one auditable Decision in Stockout.

---

## 2. Decisions taken (and the reasoning, so you can argue with it)

### 2.1 Voice layer: CALL-E — three features delete work we'd planned

[heycall-e.com](https://www.heycall-e.com/) · [docs](https://docs.heycall-e.com/) · [integrations repo](https://github.com/CALLE-AI/call-e-integrations). `test/test_calle.py` already talks to this API.

1. **`recipient_result_schema`** — you hand CALL-E a JSON Schema; it returns `structured_result` validated against it, plus `evidence`, `completion_confidence`, and full `transcript_turns`. This *is* the foundation spec's "answer sheet", enforced server-side. **The transcript → structured data layer is deleted.**
2. **Batch calling** — one `POST /v1/calls` takes a `recipients[]` array, so CALL-E *is* the parallel dispatcher. Ours is deleted.
3. **`webhook_url` + `Idempotency-Key`** — terminal results are pushed to us. No polling loop, and retries are safe.

**Two hard constraints:**

- ⚠️ **China is not a supported CALL-E region.** Germany is (`DE`, English + German) but on an *international* line, so a Munich distributor sees a foreign caller ID. **The China-sourcing leg cannot be a phone call** — it goes via email RFQ / Alibaba message. We present this as deliberate *channel routing by supplier geography*, not as a gap.
- **20 free calls per account.** 4 accounts = 80 calls, and debugging eats them fast. Rehearsal mode is the default (already the spec's rule); real calls only in rehearsal-override and demo; **one account stays untouched for the live demo.**

**Use the Developer API, not the MCP endpoint.** CALL-E's MCP path (`plan_call` → `run_call` → `get_call_run`) would let Devin dial directly, but it needs OAuth in a headless session and `run_call` accepts no webhook, so we'd be stuck polling. Instead **our backend owns the CALL-E key** and Devin calls *our* `POST /tools/outreach`. That also keeps the kill switch, the concurrency cap and rehearsal mode in one place. "Devin dials via MCP directly" is a great next-steps slide.

### 2.2 ERP: mock behind the two-question adapter — not ERPNext

The foundation spec already got this right (Building Block 3: a two-capability contract). Confirming the call: **do not stand up ERPNext.** The Frappe Docker path needs site creation, a chart of accounts, item masters, BOMs, warehouses, stock entries, suppliers and price lists before you have one believable shortage — most of a day of *data entry* — plus `Host`/`X-Frappe-Site-Name` header handling on every request. Highest-risk hour-sink on the board, and **the judges cannot tell the difference**: they see JSON from an endpoint either way.

Seed the mock from YAML using ERPNext's real doctype field names (`item_code`, `item_name`, `warehouse`, `actual_qty`, `supplier_name`, …) so we can say, truthfully, **"swapping in a real ERPNext is one adapter class."** If someone finishes early, implementing `ERPNextAdapter` is the stretch goal.

### 2.3 Part class: bearings primary — because the *maths* is the interesting part

The part matters less than how much calculation it supports. A **deep-groove ball bearing 6204-2RS (DIN 625)** is the best vehicle:

| Candidate | Multi-source? | Phone-reachable? | Calculation surface | Verdict |
|---|---|---|---|---|
| **Ball bearing 6204-2RS** | Excellent — SKF, FAG, NSK, NTN, Koyo + generics | Yes, industrial distributors have real sales lines | **Rich**: 10× price spread OEM↔generic, real quantity price breaks, MOQ/pallet quantities, weight-driven freight, and a genuine counterfeit problem → the compliance gate has a *true* story | ✅ **primary** |
| Hex bolt DIN 933 M8×40 A2 | Excellent | Yes | Good — big volumes, steep price breaks, trivial spec | ✅ secondary case |
| Electronic component (MLCC, STM32) | Good | **No** — Mouser/Digi-Key/Farnell are web-only | Best compliance story (RoHS/REACH, export control) but **kills the calling demo** | ❌ post-MVP |

**Nothing in the design is bearing-specific.** `part_class` is a field on `Part` and it selects which policy rules and cost parameters apply, so "complex electrical component" is a row in the profile YAML, not a code change. Say that on stage.

### 2.4 Devin API budget: 4 keys × $200

- **One key per person; treat the 4th as the demo key** — never develop against it, so demo day has guaranteed headroom.
- Sessions burn ACUs while they *think*, so a session sitting on a slow endpoint costs money for nothing. Every tool endpoint must be fast, and CALL-E results must arrive by **webhook**, never by Devin polling.
- **Two session shapes — choose deliberately:**
  - **(a) One session per case** — Devin runs all stages. Simpler, cheaper, easier to demo. **This is the MVP.**
  - **(b) Session fan-out** — a supervisor session spawns one child per candidate supplier for deep research. More impressive, ~4× cost, more failure modes. **Stretch only**, decided at hour 14. It's the one thing you genuinely cannot do without the Devin API, so it's a strong closer if it works.
- Iterate prompts in rehearsal mode against a fixture case so you're not paying for calls *and* ACUs on every loop.

### 2.5 Compliance depth: exactly four rules

Four pure functions, ~60 lines total:

```python
blocked_origin_country(candidate, profile)      # sanctions / import restrictions
missing_required_certification(candidate, part) # e.g. ISO 9001 for rotating parts
audit_required_and_not_audited(candidate, part)
lead_time_after_line_stop(claim, incident)      # the one that actually bites
```

Enough to reject a supplier **by name, citing the rule that rejected it** — that's the screenshot that sells the product. Dual-use classification, REACH and tariff codes are post-MVP.

### 2.6 Reconciliation with the foundation spec

**Adopted wholesale — these are better than what I had, don't water them down:**

- **The claim/record separation.** "What the supplier said" is a *claim*, never a fact; "what our records say" is the trusted baseline. My earlier draft merged both into one `Quote` blob, which would have quietly destroyed the product's whole point. The models below keep them separate.
- **`stock_status` with "in stock but already allocated to another customer."** This is the sharpest idea in the spec. A yes/no availability question never catches the supplier who says "yes, we have some" meaning "yes, but not for you." It's also the most demo-able single field we have — build the UI around it.
- **"Unknown" as a first-class answer, and claim conversion that never raises.** A garbled call becomes a confidence-0 claim, not an exception. This matters more once Devin is orchestrating: one bad call must not kill a 5-supplier case mid-run.
- **All the safety rules**: E.164 validation on entry, masking everywhere but the outbound request body, rehearsal-by-default with explicit live opt-in, mandatory AI disclosure, `Decimal` money, fictional-range phone numbers only. These are non-negotiable and they map cleanly onto CALL-E's API.
- **Deterministic supplier call ordering** (preferred first, then cheapest contract price). Never leave "who gets called first" to the model.

**What this plan adds — and why it's not optional:**

The foundation spec explicitly puts comparison and decision-making out of scope: *"It never compares those claims against the factory's own records or makes any purchasing decision."* That's the right call for Plan 1, but **the Cognition track grades exactly that layer** — the autonomous decision and the artifact it produces. Foundation-only, we have a well-engineered call-logging tool and no answer to "where does Devin do the work?" So Plan 2 (§5, §6 Slice D) is the graded deliverable, not a nice-to-have. Plan 1 is the substrate; Plan 2 is the submission.

**Three genuine conflicts to settle:**

1. **Demo scale.** The spec's demo data is 12 units needed / 4 on hand → shortfall of **8 units**. At 8 units there are no quantity price breaks, no freight-mode trade-off, no split order, no carrying cost — the entire cost engine in §5 has nothing to chew on, and the decision is trivially "call the preferred supplier." **Proposal:** keep the 4-supplier fixture shape exactly as specified, but scale the incident to a realistic production quantity (e.g. 40 000 pcs against a 12-day line stop) and give each supplier record price-break tiers. Small data change, and it's the difference between a demo with a punchline and one without.
2. **Claims are per-supplier; Decisions are per-case.** SQLite stores both scopes and their relationship. Fixture objects preserve the same boundary until persistence is implemented.
3. **"Never makes a purchasing decision" as a permanent rule vs. a Plan-1 boundary.** It stays true in the strict sense: Devin recommends, and a human marks the Decision approved in Stockout. Approved is final; there is no PR card or merge approval.

---

## 3. The MVP, cut with Musk's algorithm

The five steps, in order — and the order is the whole point. Most hackathon teams jump straight to step 5.

### Step 1 — Make the requirements less dumb

| We assumed we need… | Interrogated | Verdict |
|---|---|---|
| A real ERP | Judges see JSON from an endpoint either way | ❌ mock behind the adapter |
| A production database in this fixture UI | The rehearsal must run with no backend | ⚠️ SQLite intended; fixtures now |
| User accounts / auth | Nobody logs into a 4-minute demo | ❌ delete |
| A PR-based approve/reject workflow | Approval belongs on the Decision in Stockout | ❌ delete PR and merge approval |
| Transcript→JSON extraction | CALL-E's `recipient_result_schema` does it | ❌ delete |
| A parallel call dispatcher | CALL-E `recipients[]` is the dispatcher | ❌ delete |
| WebSockets for live updates | Append-only event log + 2s poll looks identical on stage | ❌ delete |
| Calling Chinese suppliers | CALL-E has no CN region | ❌ → email/Alibaba channel |
| A real PO PDF | The Cockpit Decision carries the approval evidence | ❌ delete |
| Many part classes | One part told well, with `part_class` as the seam | ⚠️ one primary, one secondary |
| **Devin: API-triggered and self-checking** | **This is the graded requirement** | ✅ **the only thing truly required** |

### Step 2 — Delete the part or process

Deleted outright: Postgres, Supabase, auth, Docker Compose orchestration, the email channel *on the MVP path*, Alibaba automation, the extraction layer, WebSockets, and multi-tenancy.

**SQLite is the intended operational datastore.** The current implementation remains fixture-driven and needs no backend. Supabase is explicitly ignored. Files can remain exportable audit artifacts, but the repository is not the operational datastore.

> Musk's caveat: if you don't add back ~10% of what you deleted, you didn't delete enough. Expect to re-add the email channel and the PO PDF late. Fine.

### Step 3 — Simplify and optimise (only now)

- **One** FastAPI process serves the Devin tool endpoints *and* the UI read API. No service mesh.
- **One** contracts module (Pydantic) → JSON Schema exported for the UI **and** for CALL-E's `recipient_result_schema`. One source of truth, three consumers, contract drift impossible.
- **One** scenario, seeded for drama: incumbent slips, 12 days to line stop, 5 Candidates, 1 rejected by compliance, 1 whose stock turns out to be allocated elsewhere, 4 Claims — and **the cheapest unit price is not the right answer** (§5).
- Policy rules and cost functions as pure functions over dataclasses. No rules engine, no DSL.

### Step 4 — Accelerate cycle time

- `make demo` runs a full case end-to-end in **under 90 seconds** in rehearsal mode with a cached Devin transcript. You should run it 50× on Saturday.
- `make replay CASE=001` replays a recorded event log into the UI at 4× speed — the frontend never waits on the backend, and it's the fallback if venue wifi dies on stage.
- Fixture-first everywhere: every slice ships its fake before its real.

### Step 5 — Automate (last)

Only once a human-triggered case runs green end-to-end: switch on the reorder-point scanner (cron every 60s over the mock) and the webhook, so a shortage **launches a Devin session with nobody in the room.** That's the sentence the track asks for, and it's ~30 lines — which is exactly why it comes last.

### The MVP as one testable sentence

> `python -m orchestrator.run --case CASE-001` (or the detector firing) launches a Devin session that reads the system of record, produces five Candidates, runs parallel Outreach Tasks, checks Claims against Supplier Records, computes landed cost, ranks split-order Strategies, and gets both `pytest` suites green. The Cockpit shows the run, then a human marks the Decision approved in Stockout.

Everything else in this document is optional.

### The hour-3 walking skeleton — build this before anything pretty

End-to-end, ugly, all rehearsal, one command: trigger → Devin session created → reads one hardcoded bearing from the fixture → creates a checked Decision → UI shows ready for approval.

**Once that loop is closed, every remaining task is fill-in-the-blank** and can be done in parallel with no integration risk. Teams that skip the skeleton integrate at hour 20 and lose.

---

## 4. The contracts — freeze in hour 1

The single most important artifact of the weekend. Pydantic models, reviewed by everyone for 15 minutes, then **frozen**; later changes need a group ping. Types extend the foundation spec's vocabulary — `Incident`, `SupplierRecord` and `Claim` keep their spec meanings.

```python
# --- from the foundation spec, unchanged in meaning ---
Incident       = { case_id, part_id, qty_required, qty_on_hand, line_stop_at,
                   line_stop_cost_per_hour, expedite_fee, currency }   # shortfall = required - on_hand, floored at 0
SupplierRecord = { supplier_id, name, phone (E.164, masked on display), country, locale,
                   part_id, approved, preferred, contract_unit_price: Decimal,
                   standard_lead_days, certification, certification_expires_at,
                   known_allocations, max_historical_fill }
Claim          = { supplier_id, round, call_id, qty_offered, earliest_ready_text,
                   price_quoted: yes|no|unknown, unit_price: Decimal|None, currency,
                   certification_current: yes|no|unknown, part_number_confirmed: yes|no|unknown,
                   stock_status: free_in_stock|in_stock_allocated|to_be_made|unavailable|unclear,
                   confidence, evidence:[...] }

# --- added by this plan ---
Part        = { part_id, sku, description, spec:{...}, unit, criticality,
                part_class, weight_kg, hs_code }
Candidate   = { case_id, supplier_ref, confidence, why_matched, channel,
                compliance:{passed, failed_rules:[...]} }
OutreachTask= { task_id, case_id, supplier_ref, channel:"voice"|"email"|"marketplace",
                brief:{part_spec, qty, needed_by, target_price, floor_price,
                       must_ask:[price_breaks, moq, lead_time, incoterm, cert, stock_status]} }
PriceBreak  = { min_qty, unit_price: Decimal }
LandedCost  = { supplier_ref, qty, goods_cost, freight, duty, tooling, carrying_cost,
                expedite_surcharge, total, unit_effective, breakdown_md }
OrderLine   = { supplier_ref, qty, mode:"air"|"sea"|"road", eta, landed: LandedCost }
Strategy    = { lines:[OrderLine], total_cost, coverage_date, risk_score, rationale }
Decision    = { case_id, strategies:[Strategy], recommended, runner_ups,
                policy_report_url, cost_report_url, status:"ready"|"approved",
                approved_at, approved_by }
Event       = { case_id, ts, actor:"devin"|"calle"|"system", stage, level, message, payload }
```

**`Claim` does double duty**: it is also CALL-E's `recipient_result_schema` (the spec's "answer sheet"), exported as JSON Schema from the same model. `price_breaks` is added to the answer sheet — the call must ask for tiers, not just one price.

The `Event` log is what makes the UI feel alive *and* makes debugging possible: `GET /cases/{id}/events`, append-only, everything writes to it.

---

## 5. The cost engine — where "Devin makes a smart decision" lives

This is the best answer to "why does this need an *engineer* and not a chatbot": the answer is **a model with tests**, and the recommendation is only trustworthy because the tests pass.

`cost_model.py` — pure functions, `Decimal` throughout, fully unit-tested:

```python
goods_cost(qty, price_breaks)       # step function; a big order may cross a 25% break
freight(weight_kg, mode, origin)    # air vs sea vs road; part weight × qty
duty(hs_code, origin_country)       # tariff by origin
carrying_cost(qty_ahead, unit, days_held, wacc)   # the cost of taking the discount
expedite(claim, days_saved)         # surcharge to beat the line stop
line_stop_cost(hours)               # what the shortage costs if we do nothing
landed_cost(claim, qty, mode) -> LandedCost
```

Four decisions Devin then makes on top of the model — each a genuine trade-off:

1. **Quantity-break vs. carrying cost.** A 25% break at high volume is only real if warehousing plus tied-up capital costs less than the discount. `carrying_cost` is what turns naive "buy more, it's cheaper" into an actual optimum.
2. **Split sourcing to beat the deadline.** The demo's best beat: *air-freight 20% from the expensive supplier to cover the line-stop date, sea-freight the remaining 80% from the cheap one.* Total cost beats either single-source option. A pure LLM won't find this; a model plus a search over strategies will.
3. **Cheapest unit price ≠ cheapest landed cost.** MOQ overshoot, freight on a heavy part and duty by origin routinely reorder the ranking.
4. **Risk-weighted lead time, and claims you shouldn't trust.** A confidence-0.2 claim of 8 days from an unaudited new supplier is not the same as an incumbent's 10 — and `in_stock_allocated` means the units aren't ours at all. This is exactly where the claim/record separation pays off.

**Seed the data so the naive answer is wrong.** If the cheapest quote is also the right answer there's nothing to demo. Make the winning answer a **split order** — then the comparison table has a punchline.

---

## 6. Vertical slices

Each is a demoable strip through the whole stack, not a layer. Each ships **its fake before its real**. Ownership TBD.

### SLICE A — Cockpit UI

One Cockpit route: `/chat`. The private-beta landing stays at `/`. There is no `/dashboard`, no Dashboard navigation, and no additional product route. The ERP still owns the live stock picture. CASE-001 is a bearing Incident for a German automotive manufacturer with Munich and Stuttgart plants.

The Cockpit composes [AI Elements](https://elements.ai-sdk.dev/) (`Conversation`, `Message`, `PromptInput`, `Tool`, `Task`) and a local 24×24 `DotLoader` for in-flight states.

The prototype enters an existing Session, matching an external ERP link. The sidebar lists fixture Sessions; every selection opens the same CASE-001 rehearsal. The linked Incident appears inline in the first user message, and a bottom composer accepts local follow-up messages.

`/chat` has the main conversation and one resizable **Candidate** panel. Its navigation and Candidate sidebars have bounded viewport-relative widths. It has no file tree and no **Files | Results** tabs. Candidate cards are stable and independently expandable, so several can remain open. Outreach Tasks progress in parallel. `?call=<id>` opens a large call modal. The status rail stays in the main conversation. A compact expandable Decision bar ends the thread.

| # | Deliverable |
|---|---|
| A0 | **Direct entry** — `/` links to `/chat`; the resizable sidebar lists icon-free fixture Sessions that all render the same CASE-001 rehearsal |
| A1 | **Incident context** — the first user message contains an inline primary-colour CASE-001 mention, while compact Munich and Stuttgart plant context shows the 6204-2RS bearing shortage |
| A2 | **Status rail** — stages and Devin session state live in the main conversation |
| A3 | **Candidate panel** — one fixed panel contains stable multi-expand Candidate rows with matched, compliance-passed, claimed, or rejected status and the exact rejection rule |
| A4 | **Parallel Outreach Tasks and calls** — tasks progress together; a large `?call=<id>` modal shows transcript, masked number, and structured Claim progress |
| A5 | **Claim versus Supplier Record** — Candidate detail keeps the separation explicit, then shows Landed Cost and the selected split Strategy |
| A6 | **Decision bar** — compact at the thread end, expandable for rationale, runner-ups, and checks. A human marks the Decision approved in Stockout; approved is final. No PR card or merge approval |

**Data:** SQLite is the intended operational datastore. This implementation remains fully fixture-driven, works with no backend, and explicitly ignores Supabase. **DoD:** the rehearsal tells the whole story from `/chat` with no backend running.

### SLICE B — Core API, system of record & seed data
| # | Deliverable |
|---|---|
| B1 | **Seeded mock system of record** behind the spec's two-question adapter, ERPNext-shaped field names. ~40 parts, BOMs, stock, reorder points, open POs, 15 suppliers with price history **and price-break tiers**, 2 plants. *Believable data is not optional — the demo lives or dies here.* |
| B2 | **Case store + event log** — SQLite behind the case API, `GET /cases/{id}/events`; fixtures stand in for it in the current UI |
| B3 | **Devin tool endpoints** — `/tools/part/{id}`, `/tools/stock`, `/tools/suppliers`, `/tools/price_history`, `/tools/alternates`, `POST /tools/outreach`, `POST /tools/claims`. Boring, fast, documented, stable. |
| B4 | **Shortage detector** — reorder-point + open-PO-delay scan → launches a Devin session. The "no human in the loop" trigger. *(Step 5 — build last.)* |
| B5 | **Company profile YAML** — legal entity, country, blocked origin countries, required certs **per part class**, audit requirements, budget thresholds, WACC + warehousing rate for carrying cost |

**Unblock:** publish contracts + a running stub with fixture responses within 2 hours. Stub before logic. **DoD:** `curl` any tool endpoint → schema-valid data.

### SLICE C — CALL-E outreach & negotiation
| # | Deliverable |
|---|---|
| C1 | **Rehearsal dispatcher first** — `OutreachTask → Claim` from saved results, with price breaks and random delays. Ships hour 1; B and D develop against it all weekend. |
| C2 | **CALL-E integration** — batch `POST /v1/calls`, our `Claim` JSON Schema as `recipient_result_schema`, `Idempotency-Key`, `metadata.case_id` |
| C3 | **Webhook receiver** — `/calle/webhook` → normalise `structured_result` + `evidence` + `completion_confidence` + `transcript_turns` → `Claim` → event log. **Never raises** (spec rule): garbage in → confidence-0 claim. Needs a public tunnel (ngrok/cloudflared) — **set it up in hour 1, it's a classic time sink.** |
| C4 | **The call script** — mandatory AI disclosure first, then the answer-sheet questions **including price-break tiers and the free-vs-allocated stock question**, negotiate within `[target, floor]`, never mention our contract price, confirm numbers back before hanging up |
| C5 | **Channel router** — voice for CALL-E-supported regions, email RFQ for the rest (China). Same `Claim` out either way. |
| C6 | **Rehearsal-override personas** — teammate numbers from their own env (never committed) with printed "supplier" personas, so rehearsals are repeatable and no real supplier is ever dialed by accident |

⚠️ **Legal, and non-negotiable (already in the spec, restated because it's easy to lose under time pressure):** in Germany recording a call without consent is criminal (§201 StGB), and EU AI Act transparency means the callee must know they're talking to an AI. The disclosure is the **first thing said**, always. Put it in the pitch — it shows we thought about deployment, not just the demo.

**DoD:** one real call to a teammate's own number produces a schema-valid `Claim` end-to-end.

### SLICE D — Devin orchestration & auditable sourcing
The slice the judges are actually grading. Strongest Devin-API person; must not be a side job.

| # | Deliverable |
|---|---|
| D1 | **Session launcher** — Devin API client: create session with structured prompt + `case_id`, stream status, capture session URL into the event log |
| D2 | **Prompt pack / playbook** — versioned, in-repo: the procedure, tool endpoints, outputs, and the rule *"both test suites must be green before the Decision is ready for approval"* |
| D3 | **Policy-as-code** — the four rules from §2.5 as pure functions |
| D4 | **Self-check suites** — `pytest` over the policy **and** the cost model; fail loudly. **This is the "checks its own work" requirement — name it explicitly on stage.** |
| D5 | **Cost engine** (§5) — `cost_model.py` + strategy search over split orders and quantity breaks |
| D6 | **Claim-vs-record verification** — the comparison the foundation spec deliberately left out: claimed price vs. contract price, claimed lead time vs. standard, `qty_offered` vs. `known_allocations`, certification claim vs. `certification_expires_at`. Low-confidence claims get distrusted, not used. |
| D7 | **Decision persistence** — store the case, Claims, policy and cost reports, Decision, and approval state in SQLite; allow audit exports |
| D8 | **Web supplier research** — Devin searches for distributors matching the exact spec → `Candidate` records with `why_matched` and a contact channel |

**Unblock:** you need only the contracts and fixtures. Start with one Devin session that reads a fixture bearing case and produces a checked Decision. **Close the loop empty, then fill it.**
**DoD:** one command → real session → Decision ready → both suites green → human approval in Stockout.

---

## 7. Auditability: Entire + GitHub

The panel reviews our work through **Entire**, which is already wired into this repo (`.entire/settings.json`, `.github/hooks/entire.json`, plus hook configs for Claude Code, Codex, Cursor, Copilot CLI, Factory, Gemini, OpenCode and Pi). Checkpoints are configured as `git-refs`.

⚠️ **The gap nobody has checked yet, and it's the biggest risk on this board.** Entire captures agent work through **per-agent-CLI hooks**, and **Devin is not one of the eight wired-up CLIs.** Our whole submission is "Devin did the work" — so if Entire only sees the other agents' sessions, the panel's view of our repo could be missing the exact thing we're being judged on. Someone must verify this **in hour 1**, not on Sunday:

1. Ask the Entire people at the venue directly how work from an agent without a CLI hook gets captured — they're sponsors, they're there, and this takes five minutes.
2. Confirm whether `git-refs` checkpointing is enough on its own: if Entire reconstructs sessions from commits and PRs, Devin's work is covered automatically and we do nothing.
3. If it isn't, the fallback is to install the `entire` CLI in the Devin environment (add it to the blueprint so every session has it) and invoke the hooks around Devin's work, or run Devin sessions' output through a locally-hooked agent CLI before merge.

Until that's answered, assume nothing. Everything below holds regardless:

1. **One monorepo — this one.** Four top-level areas matching the slices. One repo = one review surface = one integration to configure.
2. **Everything lands through a PR. Nothing is pushed to `main` directly.** A direct push is invisible to PR-driven tooling — one lazy `git push origin main` is a hole in the audit trail.
3. **Never force-push, never squash-merge, never rewrite history.** History *is* the evidence. Merge commits keep the trail intact. Entire's checkpoints are git refs — rewriting refs is exactly what breaks them.
4. **Development PRs stay separate from product Decisions.** `feat/*` PRs audit engineering work. Product cases live in SQLite and end as approved Decisions in Stockout.
5. **Every development PR body carries its Devin session URL** when available. This engineering review flow is not product approval.
6. **`AGENTS.md` at the repo root**, and keep `CLAUDE.md` in sync with it — conventions, how to run things, the tool endpoints, commit style. Makes every session reproducible and shows the panel our operating manual.
7. **`DEMO.md`** — the exact commands to reproduce the demo from a clean clone. Costs 10 minutes; judges love it.
8. **One Devin session per meaningful unit of work** — not one 40-hour session. Easier to audit, easier to point at on stage.

---

## 8. Timeline & sync rhythm

Hourly sync, 5 minutes, structured: **(1) what's green, (2) what I need from whom, (3) contract changes.** Anything longer becomes a 1:1 between the two people involved.

| Phase | Focus | Gate |
|---|---|---|
| **H0–H1** | Together: freeze contracts, `AGENTS.md`, **resolve the Entire/Devin coverage question (§7)**, CALL-E accounts + keys, **public tunnel working**, agree the demo script | Contracts merged, tunnel reachable, Entire coverage confirmed |
| **H1–H3** | **Walking skeleton** (§3) + each slice's fake running standalone | One command → checked fixture Decision in the UI |
| **H3–H8** | Real logic per slice, still on fakes | Each slice demoable alone |
| **H8** | **Integration checkpoint #1** — A↔B and D↔B real, C in rehearsal | One case end-to-end in rehearsal |
| **H8–H14** | Real Devin session, cost + policy suites green, **first real CALL-E call** | |
| **H14** | **Integration checkpoint #2** — everything real, one full case | 🎥 **Record the backup demo video the moment this goes green** |
| **H14–H18** | Polish, better seed data, the compliance-rejection beat, the allocated-stock beat, the split-order beat, second case, optional session fan-out | |
| **Last 3h** | **Code freeze.** Rehearse 3×, finish `DEMO.md` + README + architecture diagram, verify the approved Decision ending | |

Two rules that save hackathons: **record the backup video the first time the happy path works**, and **hard freeze 3 hours out, no exceptions.**

---

## 9. Risks and hedges

| # | Risk | Hedge |
|---|---|---|
| 1 | **Entire doesn't capture Devin's work** → the panel can't see the thing we're judged on | §7 — resolve in hour 1 by asking the sponsors directly |
| 2 | **Real distributors don't cooperate on the phone** — IVR, gatekeeper, hangs up on a bot, no sales line | Validate in the **first 3 hours**: one person hand-dials two real distributors for 30 minutes and reports what actually happens. Worth more than any code written in that window. Demo with teammate personas. |
| 3 | 20-call free tier burns out mid-Saturday | Rehearsal default; one account untouched for the demo |
| 4 | Tunnel/webhook dies on venue wifi | Polling fallback behind the same interface; `make replay` for the UI |
| 5 | Devin's decision looks like a black box | Policy tests + `cost_report.md` + runner-ups; show a **rejected** supplier and the exact rule |
| 6 | Web search returns garbage suppliers | Curated shortlist of real bearing distributors seeded; free search is bonus, not the path |
| 7 | Integration hell at hour 20 | Walking skeleton at H3 + the two checkpoints are mandatory |
| 8 | Foundation-only scope means nothing to grade | §2.6 — Plan 2 is the submission, prioritise Slice D accordingly |
| 9 | Scope creep into "central ERP brain" | Roadmap slide, not MVP. One part, one plant, one scenario. |
| 10 | ACU budget spent on debugging | Fixture-driven prompt iteration, fast endpoints, webhooks not polling |

---

## 10. Open, deliberately deferred

- **Slice ownership** — next conversation, after everyone has read this.
- **The three conflicts in §2.6** — especially the demo scale. Needs a decision before B1 seed data is written.
- **Session fan-out** (§2.4b) — decide at hour 14 based on whether the happy path is solid. Don't decide now.
- **Name** — SupplyGuard is the working name and it's good. Alternatives floated: LineStop, Stockout.
