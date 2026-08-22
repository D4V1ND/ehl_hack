# Autonomous Sourcing Agent — Build Plan (v3, team distribution copy)
EHL Game Jam Munich · Cognition "Devin for X" track · team of 4 · ~weekend

**Read this whole document, then give feedback.** Nothing here is final until we've all commented. Slice ownership is *not* assigned yet — that's the next conversation. What *is* settled: the contracts in §4 must be frozen in hour 1, and the walking skeleton in §3 must exist by hour 3.

---

## 1. What we're building

> **Procurement is an engineering problem. Give it an engineer.**
>
> A production line is 12 days from standing still because a part won't arrive. We file that shortage with Devin. Devin reads the ERP, works out exactly what's missing, finds alternative suppliers, dispatches **CALL-E** agents to phone and negotiate with them, runs the offers through a **landed-cost model** (quantity price breaks, MOQ, freight, duty, carrying cost) and through the company's **compliance rules** — then ships the whole decision as a **pull request**: the case, the executable policy checks, the real call transcripts, the cost model, and a recommended purchase order.

### Why this wins the Cognition track

| Track requirement | How we satisfy it |
|---|---|
| "output can be expressed as code" | A procurement decision **is a Git repo**: `sourcing_case.yaml`, `policy/*.py`, `cost_model.py`, `quotes/*.json`, `decision.md`. Procurement-as-code. |
| "programmatically triggers Devin sessions" | Reorder-point scanner / ERP webhook / UI button → `POST /v1/sessions` on the Devin API. No human writes the prompt. |
| "gives them a way to check their own work" | Two `pytest` suites per case — the compliance policy and the cost model. Devin must get both green **before** opening the PR. |
| "produces real artifacts without a human in the loop" | A merged PR, real recorded CALL-E calls, real quotes, a costed PO recommendation. |

**The differentiator to say out loud:** everyone else will demo "an agent that calls a supplier." We demo the *autonomous layer* — Devin is the procurement engineer, CALL-E is one of its tools, and the deliverable is reviewable, testable, diffable code.

---

## 2. Decisions taken (and the reasoning, so you can argue with it)

### 2.1 Voice layer: CALL-E — three features delete work we'd planned

[heycall-e.com](https://www.heycall-e.com/) · [docs](https://docs.heycall-e.com/) · [integrations repo](https://github.com/CALLE-AI/call-e-integrations)

1. **`recipient_result_schema`** — you hand CALL-E a JSON Schema; it returns `structured_result` validated against it, plus `evidence`, `completion_confidence`, and full `transcript_turns`. **We pass our `Quote` schema straight in**, so the "transcript → structured data" layer is *deleted*.
2. **Batch calling** — one `POST /v1/calls` takes a `recipients[]` array, so CALL-E *is* the parallel dispatcher. Our dispatcher is *deleted*.
3. **`webhook_url` + `Idempotency-Key`** — terminal results are pushed to us. No polling loop, and retries are safe.

```bash
POST $CALLE_BASE_URL/v1/calls        # Authorization: Bearer $CALLE_API_KEY
{
  "task": "You are a procurement buyer for <company>. Ask whether they can supply
           <part spec>, <qty> pcs, delivered by <date>. Get unit price, quantity
           price breaks, MOQ, lead time, incoterm, and certification. Negotiate
           toward <target> but never below <floor>. State up front that you are an
           AI assistant and that the call is recorded.",
  "recipients": [ {"phones": ["+49..."], "region": "DE", "locale": "de-DE"}, ... ],
  "recipient_result_schema": { ...our Quote schema... },
  "webhook_url": "https://<our-tunnel>/calle/webhook",
  "metadata": { "case_id": "CASE-001" }
}
```

**Two hard constraints:**

- ⚠️ **China is not a supported CALL-E region.** Germany is (`DE`, English + German) but on an *international* line, so a Munich distributor sees a foreign caller ID. **The China-sourcing leg therefore cannot be a phone call** — it goes via email RFQ / Alibaba message. We present this as deliberate *channel routing by supplier geography*, not as a gap.
- **20 free calls per account.** 4 accounts = 80 calls, and debugging eats them fast. `FAKE_CALLS=1` is the dev default; real calls only in rehearsal and demo; **one account stays untouched for the live demo.**

**Use the Developer API, not the MCP endpoint.** CALL-E's MCP path (`plan_call` → `run_call` → `get_call_run`) would let Devin dial directly, but it needs OAuth in a headless session and `run_call` accepts no webhook, so we'd be stuck polling. Instead **our backend owns the CALL-E key** and Devin calls *our* `POST /tools/outreach`. That also gives us the kill switch, the concurrency cap, and fake mode. "Devin dials via MCP directly" is a great next-steps slide.

### 2.2 ERP: mock behind an adapter — not ERPNext

The Frappe Docker path (`docker compose -f pwd.yml up -d`) needs site creation, a chart of accounts, item masters, BOMs, warehouses, stock entries, suppliers and price lists before you have one believable shortage — most of a day of *data entry* — plus `Host`/`X-Frappe-Site-Name` header handling on every API call. Highest-risk hour-sink on the board, and **the judges cannot tell the difference**: they see JSON from an endpoint either way.

So: build `MockERP` behind an **ERP adapter interface** (`get_part`, `get_stock`, `get_open_pos`, `get_suppliers`, `get_price_history`), seeded from YAML that mirrors ERPNext's real doctype field names (`item_code`, `item_name`, `warehouse`, `actual_qty`, `supplier_name`, …). Then we can say, truthfully, **"swapping in a real ERPNext is one adapter class"** — more credible than a half-configured instance. If someone finishes early, implementing `ERPNextAdapter` is the stretch goal.

### 2.3 Part class: bearings primary — because the *maths* is the interesting part

Yannik's point is the right one: the part matters less than how much calculation it supports. A **deep-groove ball bearing 6204-2RS (DIN 625)** is the best vehicle:

| Candidate | Multi-source? | Phone-reachable? | Calculation surface | Verdict |
|---|---|---|---|---|
| **Ball bearing 6204-2RS** | Excellent — SKF, FAG, NSK, NTN, Koyo + generics | Yes, industrial distributors have real sales lines | **Rich**: 10× price spread OEM↔generic, real quantity price breaks, MOQ/pallet quantities, weight-driven freight, genuine counterfeit problem → the compliance gate has a *true* story | ✅ **primary** |
| Hex bolt DIN 933 M8×40 A2 | Excellent | Yes | Good — big volumes, steep price breaks, trivial spec | ✅ secondary seeded case |
| Electronic component (MLCC, STM32) | Good | **No** — Mouser/Digi-Key/Farnell are web-only | Best compliance story (RoHS/REACH, export control) but **kills the calling demo** | ❌ post-MVP |

**Crucially, nothing in the design is bearing-specific.** `part_class` is a field on `Part`, and it selects which policy rules and which cost parameters apply. Adding "complex electrical component" later means adding a row to the profile YAML, not changing code. Say that on stage.

### 2.4 Devin API budget: 4 keys × $200

- **One key per person; treat the 4th as the demo key** — never develop against it, so demo day has guaranteed headroom.
- Sessions burn ACUs while they *think*, so a session sitting on a slow endpoint costs money for nothing. Every tool endpoint must be fast, and CALL-E results must arrive by **webhook**, never by Devin polling.
- **Two session shapes — choose deliberately:**
  - **(a) One session per case** — Devin runs all stages. Simpler, cheaper, easier to demo. **This is the MVP.**
  - **(b) Session fan-out** — a supervisor session spawns one child per candidate supplier for deep research. More impressive, ~4× cost, more failure modes. **Stretch only**, and only if the happy path is solid by hour 14. It is the one thing you genuinely cannot do without the Devin API, so it's a strong closer if it works.
- Iterate prompts with `FAKE_CALLS=1` against a fixture case so you're not paying for calls *and* ACUs on every loop.

---

## 3. The MVP, cut with Musk's algorithm

The five steps, in order — and the order is the whole point. Most hackathon teams jump straight to step 5.

### Step 1 — Make the requirements less dumb

Question every requirement and name where it came from. Ours came from imagining a real procurement department, which is exactly how you end up building an ERP instead of a demo.

| We assumed we need… | Interrogated | Verdict |
|---|---|---|
| A real ERP | Judges see JSON from an endpoint either way | ❌ mock behind an adapter |
| A database | A case is ~8 files and we want them in Git anyway | ❌ **the repo is the database** |
| User accounts / auth | Nobody logs into a 4-minute demo | ❌ delete |
| An approve/reject workflow | The value is Devin *deciding*, not a human clicking | ❌ read-only review view |
| Transcript→JSON extraction | CALL-E's `recipient_result_schema` does it | ❌ delete |
| A parallel call dispatcher | CALL-E `recipients[]` is the dispatcher | ❌ delete |
| WebSockets for live updates | Append-only event log + 2s poll looks identical on stage | ❌ delete |
| Calling Chinese suppliers | CALL-E has no CN region | ❌ → email/Alibaba channel |
| A real PO PDF | A committed `po_draft.md` is more on-thesis | ⚠️ downgrade |
| Many part classes | One part, told well, with `part_class` as the seam | ⚠️ one primary, one secondary |
| **Devin: API-triggered, self-checking, artifact-emitting** | **This is the actual graded requirement** | ✅ **the only thing truly required** |

### Step 2 — Delete the part or process

Deleted outright: Postgres, ORM/migrations, auth, Docker Compose orchestration, the email channel *on the MVP path*, Alibaba automation, the dispatcher, the extraction layer, the approve endpoint, WebSockets, multi-tenancy.

The big one, and the one that makes the pitch coherent: **delete the database.** State lives in `cases/<case_id>/` as files that Devin writes and commits; the UI reads a served JSON index of that directory. The artifact *is* the datastore, so there is zero gap between what the system knows and what the judges can review.

> Musk's own caveat: if you don't add back ~10% of what you deleted, you didn't delete enough. Expect to re-add the email channel and the PO PDF late. Fine.

### Step 3 — Simplify and optimise (only now)

- **One** FastAPI process serves the Devin tool endpoints *and* the UI read API. No service mesh.
- **One** contracts file (`packages/contracts/models.py`, Pydantic) → JSON Schema exported for the UI **and** for CALL-E's `recipient_result_schema`. One source of truth, three consumers, contract drift impossible.
- **One** scenario, seeded for drama: incumbent slips, 12 days to line stop, 5 candidates, 1 rejected by compliance, 1 too slow, 3 quote — and **the cheapest unit price is not the right answer** (see §5). Devin explains why. That's the demo.
- Policy rules and cost functions as pure functions over dataclasses. No rules engine, no DSL.

### Step 4 — Accelerate cycle time

- `make demo` runs a full case end-to-end in **under 90 seconds** with `FAKE_CALLS=1` and a cached Devin transcript. You should run it 50× on Saturday.
- `make replay CASE=001` replays a recorded event log into the UI at 4× speed — the frontend never waits on the backend, and it's the fallback if venue wifi dies on stage.
- Fixture-first everywhere: every slice ships its fake before its real.

### Step 5 — Automate (last)

Only once a human-triggered case runs green end-to-end: switch on the reorder-point scanner (cron every 60s over the mock ERP) and the ERP webhook, so a shortage **launches a Devin session with nobody in the room.** That's the sentence the track asks for, and it's ~30 lines — which is exactly why it comes last, not first.

### The MVP as one testable sentence

> `python -m orchestrator.run --case CASE-001` (or the cron detector firing) launches a real Devin session that reads the mock ERP, produces 5 candidates, filters them through the policy rules, gets 3 quotes back through CALL-E (fake or real), computes landed cost with quantity breaks and freight, ranks the options including a split-order strategy, gets both `pytest` suites green, and opens a GitHub PR with the case, quotes, policy report, cost model and PO draft — **with no human input after the trigger.** The cockpit shows all of it live.

Everything else in this document is optional.

### The hour-3 walking skeleton — build this before anything pretty

End-to-end, ugly, all fakes, one command: trigger → Devin session created → reads one hardcoded part from the stub API → writes a two-line `decision.md` → opens a PR → UI shows "done" + PR link.

**Once that loop is closed, every remaining task is fill-in-the-blank** and can be done in parallel with no integration risk. Teams that skip the skeleton integrate at hour 20 and lose.

---

## 4. The contracts — freeze in hour 1

The single most important artifact of the weekend. Written as Pydantic in `packages/contracts/`, reviewed by everyone for 15 minutes, then **frozen**; later changes need a group ping.

```python
Part        = { part_id, sku, description, spec:{...}, unit, criticality,
                part_class, weight_kg, hs_code }
Shortage    = { case_id, part_id, qty_needed, needed_by, line_stop_date,
                plant_id, incumbent_supplier_id, reason }
Supplier    = { supplier_id, name, country, channels:{phone,email,marketplace_url},
                certifications:[...], audit_status, approved, source:"erp"|"web" }
Candidate   = { case_id, supplier_ref, confidence, why_matched, channel,
                compliance:{passed, failed_rules:[...]} }
OutreachTask= { task_id, case_id, supplier_ref, channel:"voice"|"email"|"marketplace",
                brief:{part_spec, qty, needed_by, target_price, floor_price,
                       must_ask:[price_breaks, moq, lead_time, incoterm, cert]} }

PriceBreak  = { min_qty, unit_price }                      # <- the interesting one
Quote       = { task_id, case_id, supplier_ref, available, qty_offered,
                unit_price, price_breaks:[PriceBreak], currency, moq,
                lead_time_days, expedite_option:{days, surcharge}|null,
                incoterm, certs_claimed:[...], payment_terms, notes,
                transcript_url, recording_url, confidence, raw }

LandedCost  = { supplier_ref, qty, goods_cost, freight, duty, tooling,
                carrying_cost, expedite_surcharge, total, unit_effective,
                breakdown_md }
OrderLine   = { supplier_ref, qty, mode:"air"|"sea"|"road", eta, landed:LandedCost }
Strategy    = { lines:[OrderLine], total_cost, coverage_date, risk_score, rationale }
Decision    = { case_id, strategies:[Strategy], recommended, runner_ups,
                policy_report_url, cost_report_url, pr_url }
Event       = { case_id, ts, actor:"devin"|"calle"|"system", stage, level,
                message, payload }
```

**`Quote` does double duty**: it is also CALL-E's `recipient_result_schema`, exported as JSON Schema from the same Pydantic model.

The `Event` log is what makes the UI feel alive *and* makes debugging possible — `GET /cases/{id}/events`, append-only, everything writes to it.

---

## 5. The cost engine — this is where "Devin makes a smart decision" lives

Yannik's volume-discount point promotes this from a footnote to a headline. It's also the best possible answer to "why does this need an *engineer* and not a chatbot": the answer is a **model with tests**, and the recommendation is only trustworthy because the tests pass.

`cost_model.py` — pure functions, fully unit-tested:

```python
goods_cost(qty, price_breaks)      # step function; 10M pcs may cross a 25% break
freight(weight_kg, mode, origin)   # air vs sea vs road; part weight × qty
duty(hs_code, origin_country)      # tariff by origin
carrying_cost(qty_ahead, unit, days_held, wacc)   # the cost of the discount
expedite(quote, days_saved)        # surcharge to beat the line-stop date
landed_cost(quote, qty, mode) -> LandedCost
```

Four decisions Devin then makes on top of the model — each one a genuine trade-off:

1. **Quantity-break vs. carrying cost.** A 25% break at 10M units is only real if warehousing + tied-up capital for 14 months costs less than the discount. `carrying_cost` is what turns a naive "buy more, it's cheaper" into an actual optimum.
2. **Split sourcing to beat the deadline.** The classic answer, and the demo's best beat: *air-freight 20% from the expensive supplier to cover the line-stop date, sea-freight the remaining 80% from the cheap one.* Total cost beats either single-source option. A pure LLM will not find this; a model + a search over strategies will.
3. **Cheapest unit price ≠ cheapest landed cost.** MOQ overshoot, freight on a heavy part, and duty by origin routinely reorder the ranking. Seed the scenario so this is visibly true.
4. **Risk-weighted lead time.** A new unaudited supplier promising 8 days is not the same as an incumbent promising 10.

**Seed the data so the naive answer is wrong.** If the cheapest quote is also the right answer, there's nothing to demo. Make the winning answer a **split order** — then the comparison table has a punchline.

---

## 6. Vertical slices

Each is a demoable strip through the whole stack, not a layer. Each ships **its fake before its real**. Ownership TBD.

### SLICE A — Cockpit UI
| # | Deliverable |
|---|---|
| A1 | **ERP / shortage dashboard** — parts at risk, days-to-line-stop, stock vs. reorder point, "Launch sourcing agent" button |
| A2 | **Case timeline** — stages live from the event feed, with the Devin session link |
| A3 | **Supplier board** — candidate cards: matched / compliance-passed / contacted / quoted / **rejected + the rule that rejected it** |
| A4 | **Live calls panel** — which CALL-E calls are in flight, status, transcript streaming in |
| A5 | **Quote & strategy comparison** — landed-cost breakdown per supplier, price-break curve, lead time vs. needed-by, **and the split-order strategy** with Devin's pick highlighted |
| A6 | **Decision view** — rationale, runner-ups, link to the GitHub PR |

**Unblock:** build 100% against contract fixtures + `make replay`; the UI must be fully demoable with the backend switched off. **DoD:** `npm run demo` tells the whole story with no backend running.

### SLICE B — Core API, ERP mock & supplier data
| # | Deliverable |
|---|---|
| B1 | **Seeded mock ERP** behind the adapter, ERPNext-shaped field names. ~40 parts, BOMs, stock, reorder points, open POs, 15 suppliers with price history + price breaks, 2 plants. *Believable data is not optional — the demo lives or dies here.* |
| B2 | **Case store + event log** — files under `cases/<id>/`, `GET /cases/{id}/events` |
| B3 | **Devin tool endpoints** — `/tools/part/{id}`, `/tools/stock`, `/tools/suppliers`, `/tools/price_history`, `/tools/alternates`, `POST /tools/outreach`, `POST /tools/quotes`. Boring, fast, documented, stable. |
| B4 | **Shortage detector** — reorder-point + open-PO-delay scan → launches a Devin session. The "no human in the loop" trigger. *(Step 5 — build last.)* |
| B5 | **Company profile YAML** — legal entity, country, blocked origin countries, required certs **per part class**, audit requirements, budget thresholds, WACC + warehousing rate for the carrying-cost model |

**Unblock:** publish contracts + a running stub with fixture responses within 2 hours. Stub before logic. **DoD:** `curl` any tool endpoint → schema-valid data.

### SLICE C — CALL-E outreach & negotiation
| # | Deliverable |
|---|---|
| C1 | **Fake dispatcher first** — `OutreachTask → Quote` with plausible values, price breaks and random delays. Ships hour 1; B and D develop against it all weekend. |
| C2 | **CALL-E integration** — batch `POST /v1/calls`, our `Quote` JSON Schema as `recipient_result_schema`, `Idempotency-Key`, `metadata.case_id` |
| C3 | **Webhook receiver** — `/calle/webhook` → normalise `structured_result` + `evidence` + `confidence` + `transcript_turns` → `Quote` → event log. Needs a public tunnel (ngrok/cloudflared) — **set it up in hour 1, it's a classic time sink.** |
| C4 | **The negotiation brief** — identify as AI, state the recording, ask the must-ask list **including quantity price breaks**, negotiate within `[target_price, floor_price]`, confirm numbers back before hanging up |
| C5 | **Channel router** — voice for CALL-E-supported regions, email RFQ for the rest (China). Same `Quote` out either way. |
| C6 | **Demo call fixtures** — teammate numbers with printed "supplier" personas so rehearsals are repeatable and nobody cold-calls a stranger on stage |

⚠️ **Legal, and non-negotiable:** in Germany recording a call without consent is criminal (§201 StGB), and EU AI Act transparency means the callee must know they're talking to an AI. The agent's **first two sentences** disclose AI + recording. Put it in the pitch — it shows we thought about deployment, not just the demo.

**DoD:** one real call to a teammate produces a schema-valid `Quote` end-to-end.

### SLICE D — Devin orchestration & procurement-as-code
The slice the judges are actually grading. Strongest Devin-API person; must not be a side job.

| # | Deliverable |
|---|---|
| D1 | **Session launcher** — Devin API client: create session with structured prompt + `case_id`, stream status, capture session URL into the event log |
| D2 | **Prompt pack / playbook** — versioned, in-repo: the procedure, the available tool endpoints, the artifacts to write, and the rule *"both test suites must be green before you open the PR"* |
| D3 | **Policy-as-code** — four rules, pure functions, ~60 lines total: `blocked_origin_country`, `missing_required_certification`, `audit_required_and_not_audited`, `lead_time_after_line_stop`. Enough to reject a supplier **by name, citing the rule** — that's the screenshot that sells the product. |
| D4 | **Self-check suites** — `pytest` over the policy **and** over the cost model; fail loudly. **This is the "checks its own work" requirement — name it explicitly on stage.** |
| D5 | **Cost engine** (§5) — `cost_model.py` + strategy search over split orders and quantity breaks |
| D6 | **Artifact writer** — `cases/<id>/{sourcing_case.yaml, candidates.json, quotes/*.json, policy_report.md, cost_report.md, decision.md, po_draft.md}` → branch → PR |
| D7 | **Web supplier research** — Devin searches for distributors matching the exact spec → `Candidate` records with `why_matched` and a contact channel |

**Unblock:** you need only the contracts + stub. Start by launching one Devin session from a script that reads a fixture case and opens a PR with a hand-written `decision.md`. **Close the loop empty, then fill it.**
**DoD:** `python -m orchestrator.run --case CASE-001` → real session → real PR → both suites green → zero human input.

---

## 7. Auditability for the judging panel

The jam requires the panel to be able to walk our repo and verify the work, using the sponsor code-review/tracking platform we must integrate. **Name check needed:** the transcript garbled it both times — my best guess from context (code review + tracking + panel review) is **Entelligence**. Correct me in one word and I'll adjust; nothing below depends on which tool it is, because the requirements are the same either way:

1. **One monorepo on GitHub**, four top-level folders matching the slices. One repo = one review surface = one integration to configure.
2. **Connect the review platform to the repo in hour 1**, before there's anything to review. These tools work off PR events, so if it's wired up late it has nothing to show the panel, and that's unrecoverable at hour 40.
3. **Everything lands through a PR. Nothing is pushed to `main` directly.** A direct push is invisible to a PR-driven review tool — so a single lazy `git push origin main` is a hole in the audit trail.
4. **Never force-push, never squash-merge, never rewrite history.** History *is* the evidence. Merge commits keep the trail intact.
5. **Two PR streams, clearly labelled:**
   - `feat/*` — the system being built (Devin sessions doing engineering work)
   - `case/CASE-xxx` — the artifacts the *product* generates (Devin sessions doing procurement work)
   The second stream is what proves autonomy. Have **several merged** by demo time, not one.
6. **Every PR body carries its Devin session URL** (Devin's PR tooling adds this automatically — don't strip it). Prompt → diff → review → merge, fully traceable.
7. **`AGENTS.md` at the repo root** — conventions, how to run things, the tool endpoints, commit style. Makes every Devin session reproducible and shows the panel our operating manual.
8. **`DEMO.md`** — the exact commands to reproduce the demo from a clean clone. Costs 10 minutes, and judges love it.
9. **Commit convention** `slice(scope): summary`, and **one Devin session per meaningful unit of work** — not one 40-hour session. Easier to audit, easier to point at on stage.

---

## 8. Timeline & sync rhythm

Hourly sync, 5 minutes, structured: **(1) what's green, (2) what I need from whom, (3) contract changes.** Anything longer becomes a 1:1 between the two people involved.

| Phase | Focus | Gate |
|---|---|---|
| **H0–H1** | Together: freeze contracts, create repo + `AGENTS.md`, **wire up the review platform**, CALL-E accounts + keys, **public tunnel working**, agree the demo script | Contracts merged, tunnel reachable, review tool receiving PR events |
| **H1–H3** | **Walking skeleton** (§3) + each slice's fake running standalone | One command → empty PR + UI shows it |
| **H3–H8** | Real logic per slice, still on fakes | Each slice demoable alone |
| **H8** | **Integration checkpoint #1** — A↔B and D↔B real, C fake | One case end-to-end on fakes |
| **H8–H14** | Real Devin session, cost engine + policy suites green, **first real CALL-E call** | |
| **H14** | **Integration checkpoint #2** — everything real, one full case | 🎥 **Record the backup demo video the moment this goes green** |
| **H14–H18** | Polish, better seed data, the compliance-rejection beat, the split-order beat, second case, optional session fan-out | |
| **Last 3h** | **Code freeze.** Rehearse 3×, finish `DEMO.md` + README + architecture diagram, get the `case/*` PRs merged | |

Two rules that save hackathons: **record the backup video the first time the happy path works**, and **hard freeze 3 hours out, no exceptions.**

---

## 9. Risks and hedges

| # | Risk | Hedge |
|---|---|---|
| 1 | **Real distributors don't cooperate on the phone** — IVR, gatekeeper, hangs up on a bot, no sales line | Validate in the **first 3 hours**: one person hand-dials two real distributors for 30 minutes and reports what actually happens. Worth more than any code written in that window. Demo with teammate personas. |
| 2 | 20-call free tier burns out mid-Saturday | `FAKE_CALLS=1` default; one account untouched for the demo |
| 3 | Tunnel/webhook dies on venue wifi | Polling fallback behind the same interface; `make replay` for the UI |
| 4 | Devin's decision looks like a black box | Policy tests + `cost_report.md` + runner-ups; show a **rejected** supplier and the exact rule |
| 5 | Web search returns garbage suppliers | Curated shortlist of real bearing distributors seeded; free search is bonus, not the path |
| 6 | Integration hell at hour 20 | Walking skeleton at H3 + the two checkpoints are mandatory |
| 7 | Review-platform integration left until Sunday | Wire it in hour 1 (§7.2) — it can only report on PRs it saw happen |
| 8 | Scope creep into "central ERP brain" | Roadmap slide, not MVP. One part, one plant, one scenario. |
| 9 | ACU budget spent on debugging | Fixture-driven prompt iteration, fast endpoints, webhooks not polling |

---

## 10. Open, deliberately deferred

- **Slice ownership** — next conversation, after everyone has read this.
- **Name** — later. Current front-runners: **Stockout**, **LineStop**.
- **Session fan-out** (§2.4b) — decide at hour 14 based on whether the happy path is solid. Don't decide now.
- **Review-platform name** — confirm it's Entelligence (or correct me); §7 holds either way.
