# How we built SupplyOS

EHL Game Jam Munich · Cognition "Devin for X" · team of 4

SupplyOS is a sourcing agent. You file a shortage. The agent screens suppliers, phones them through CALL-E, and costs the options. It ships a recommended purchase order as a pull request. A human merges that pull request. This note shows how we worked that weekend: the bets, the breaks, and the fixes when reality hit.

---



## The bet

Many teams can show an agent that calls a supplier. The Cognition track grades a different bar: output as code, programmatic Devin sessions, self-check, and real artifacts without a human on every step.

We fixed the spine early:

1. **Devin** is the procurement engineer.
2. **CALL-E** is a tool the backend owns, not a free MCP dialer.
3. The deliverable is a **case in Git** with claims, checks, and a recommended purchase order. It is not a chat log.

We could delete everything else.



---



## Problem: ERPNext would eat the weekend

A full Frappe or ERPNext setup needs site work, masters, BOMs, warehouses, and header quirks. You need all of that before one believable shortage exists. Judges see JSON either way.

**What we did:** We mocked the system of record behind a thin adapter. We seeded YAML with ERPNext-shaped field names. A real ERP later stays one adapter class, not a rewrite. We cut the highest-risk hour sink on day one.



---



## Problem: voice without burning the free tier or the law

CALL-E returns schema-validated structured results and supports batch recipients. That removed our planned transcript-to-quote layer. Hard limits stayed: about 20 free calls per account, China is not a CALL-E region, German recording and AI disclosure rules, and distributors that hang up on bots.

**What we did:**

- The backend owns the API key. Devin calls `POST /tools/outreach`. Devin never dials MCP itself.
- **Rehearsal is the default.** Live dialing is an explicit opt-in. It is never a fallback.
- Mandatory AI disclosure is the first utterance. "Unknown" is a first-class field. A garbled call becomes a low-confidence claim. It does not crash the case.
- Demo path: one live call for the camera. The rest stay rehearsed so the video and stage laptop stay deterministic.

Live results still lagged. In practice they took tens of minutes. The stage answer was not to wait on stage. We held one supplier line, placed the call off the recording, collected the result, then resumed.



---



## Problem: claims look like facts if you are not careful

Early drafts put supplier answers and factory records in one blob. That kills the product quietly. You cannot tell what the phone said from what the ERP already knew.

**What we did:** We keep **claims** (what the supplier said) separate from **records** (trusted baseline). The agent recommends. A human merges the pull request. That is the governance answer for a judge. Plan 1 safety rules stayed intact. Plan 2 added the graded decision layer: policy, landed cost, split orders, and pytest before the pull request.



---



## Problem: AI builds faster than the team can agree

Before, you spent 10 to 15 minutes to specify what the backend would give the frontend. Then you spent an hour or more to build the function. Then you repeated that loop. The bottleneck was typing.

Now you talk for a minute and the full function exists. Nobody looks at it again. That repeats all day. You build until you get lost. Or you try to plan while everyone else already changed their part five times.

**What we did (and what still hurts):** We froze shared contracts early in `packages/contracts/`. We treated rehearsal fixtures as the integration surface. We forced group pings on contract changes. That is not optional soft process. Speed without a shared seam lets four people invent four APIs. You cannot slack on planning or communication when the tools outrun both.



---



## Problem: live Devin is slow and burns budget. The pitch cannot wait.

A real Devin session takes tens of minutes and ACUs. A pitch video and a five-minute stage slot cannot wait on that.

**What we did:** MVP uses one session shape: one Devin per case. The demo key stays untouched during development. On-stage and video paths use a deterministic conductor. It ticks the same checklist Devin would. `hold_for` keeps one live CALL-E line visible. The rest stay rehearsed. Same screen, two clocks.



---



## What we would not undo


| Keep                                       | Why                                                     |
| ------------------------------------------ | ------------------------------------------------------- |
| Rehearsal default and explicit live opt-in | Demo and debug without burning calls or the network     |
| Claims separate from records, plus unknown | Bad calls do not kill the case                          |
| Mock ERP adapter                           | Judges cannot tell. We shipped the graded layer instead |
| Backend-owned CALL-E                       | Kill switch, schema, and rehearsal stay in one place    |
| Case folders as the datastore              | The artifact is the review surface                      |


The weekend lesson is not that AI writes code. The lesson is that **code is cheap and alignment is not.** Plan the seams. Talk while you build. Treat every silent rewrite as a bug.



