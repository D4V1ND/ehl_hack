---
marp: true
theme: default
paginate: true
size: 16:9
title: Stockout — autonomous sourcing
style: |
  section {
    background: #ffffff;
    color: #16181d;
    font-family: Inter, -apple-system, "Segoe UI", sans-serif;
    padding: 60px 80px;
  }
  h1 { font-size: 60px; letter-spacing: -2px; font-weight: 500; line-height: 1.1; color: #16181d; }
  h1 strong { color: #e8500f; }
  h2 { font-size: 40px; letter-spacing: -1px; font-weight: 500; color: #16181d; }
  h3 { font-size: 26px; font-weight: 600; margin-bottom: 4px; }
  section.lead { justify-content: center; text-align: center; }
  strong { color: #e8500f; }
  .big { font-size: 92px; font-weight: 500; letter-spacing: -3px; line-height: 1; }
  .sub { color: #5c6370; font-size: 26px; }
  .note { color: #8b919c; font-size: 20px; }
  section::after { color: #b0b5bd; }
  table { font-size: 24px; }
  table thead { display: none; }
  section.demo h2 { margin-bottom: 8px; }
  section.demo img { display: block; margin: 0 auto; }
  blockquote { border-left: 4px solid #e8500f; padding-left: 24px; color: #5c6370; }
---

<!-- _class: lead -->

![bg fit](../assets/hero.png)

<!--
Speaker: 0:30. The slide is the product, full bleed — do not read it out. One
sentence: a bearing in a bin at PLANT-MUC runs out in twelve days, and the line
it feeds costs eighteen thousand four hundred euros an hour when it stops. Then
move.
-->

---

## A shortage costs three things

### It is slow
Days of phone tag per part. **€18,400 an hour** if the line stops, and the line
does not wait for the phone to be answered.

### The decision is worse than it looks
A buyer calls the two or three vendors they already know. Nobody weighs fifteen
suppliers against MOQ, Incoterms, freight, duty and carrying cost by hand.

### So it is more expensive
Least of all does anybody hand-compute a **split order** — and that is usually
where the money is.

<!--
Speaker: 0:45. This is the emotional centre of the pitch. Land the third bullet
hardest: the option that saves the money is the one no human has time to find.
-->

---

## The option nobody has time to find

```yaml
candidates:
  - skf_germany:    compliance: PASS
  - fag_italy:      compliance: PASS
  - ntn_china:      compliance: FAIL (blocked_origin)
  - generic_turkey: compliance: FAIL (missing_cert)

recommended:
  split:
    - air 20% from SKF   # covers the line stop
    - sea 80% from FAG   # unit economy
```

<span class="sub">Air the fifth that saves the line. Ship the rest.</span>

<!--
Speaker: part of the problem beat, ~15s. Two options everybody sees: all air, or
stop the line. The split is the third one, and it is arithmetic, not intuition.
-->

---

## One agent works the whole case

| | |
|---|---|
| **Reads** | the system of record — bin, take rate, the BOM line that stops, the incumbent, the slipped PO |
| **Screens** | every supplier against the company's own compliance rules, rejected by name and by the rule that failed |
| **Calls** | them through CALL-E — MOQ, Incoterms, lead time, price breaks |
| **Costs** | every single-source and split plan, landed, on-time-first-then-cheapest |
| **Ships** | the decision as a pull request |

<!--
Speaker: 0:30. Five verbs, one breath each. Do not explain the architecture —
that is a backup slide if the jury asks.
-->

---

<!-- _class: demo -->

## Watch it work

<!-- Replace with the recorded walkthrough. PPTX: embedded video. PDF: the
     still below, narrated over. Keep the recording under 90 seconds. -->

![w:840](../assets/demo.png)

<span class="note">…and the phone in the room is the same agent, live.</span>

<!--
Speaker: 1:45 total, the largest block in the pitch.

Recording (~90s), narrated live over muted audio:
  inventory → Source this part → shortage derived from the ERP → six suppliers
  screened → plans ranked on-time-first-then-cheapest → the pull request.

Then the live call, ~20s: dial SUP-KBY and let the room hear the agent open with
the disclosure that it is an AI, then ask the must-asks. Answer it as the
supplier, keep it short, and hang up. Do NOT wait for the re-price — CALL-E took
~18 minutes in rehearsal. The re-priced plan is already in the recording.
-->

---

## Where this goes

# One AI for the whole supply chain.

<span class="sub">End to end, inside the ERP the buyers already live in.</span>

Shortage firefighting is the first workflow — the one that earns the trust.
Then reorder points, supplier discovery, price negotiation, risk on the whole
bill of materials.

<!--
Speaker: 0:25. Say it as a product line, not a dream: same loop, more workflows.
-->

---

## How we get there

### Start narrow, and in person
A handful of Munich manufacturers. One part family at a time, in the plant,
with their own compliance rules.

### Then compound
Every case adds suppliers, quotes, call playbooks and rules that the next
customer inherits. The tenth plant is cheaper to serve than the first.

<span class="note">Being local is the strategy, not a limitation — we can stand
on the shop floor the day the line is at risk.</span>

<!--
Speaker: 0:30. The jury will want to hear why you and why now — "we can be in
the plant this afternoon" is a better answer than a market size.
-->

---

<!-- _class: lead -->

# Nothing is ordered.<br/>**A human merges the PR.**

<span class="sub">stockout · EHL Game Jam Munich · Cognition "Devin for X"</span>

<!--
Speaker: 0:25, the close. Say what you want from the room — a pilot plant, an
introduction to a buying desk, whatever the ask is. Fill this in before
submitting.
-->

---

<!-- _class: lead -->

<span class="sub">Backup slides — question round</span>

---

## Guardrails

- **Nothing is ordered.** The agent ranks and stops; a buyer picks.
- **Unknown stays unknown.** Every field a call did not establish reads
  `unknown` — it is never inferred.
- **Too late is too late.** A plan that misses the line stop is shown as too
  late however cheap it is.
- **Approve by merge.** The pull request is the human-in-the-loop gate.
- **The call discloses itself.** Every supplier is told they are speaking to an
  AI, before anything is asked.

---

## Under the hood

- Contracts first: one frozen set of models shared by every slice.
- The system of record sits behind one interface — mock YAML today, SQL today,
  a real ERP adapter tomorrow, same tool URLs.
- The cost model is pure functions with a passing test suite: landed cost,
  freight, duty, carrying cost, split orders.
- `cases/` is the datastore — one directory per case, append-only event log.
  The artifact *is* the record.
- 116 tests, and the cockpit runs offline on fixtures.

---

## What we do not claim

- No purchase is placed. No supplier is committed to anything.
- A live agent session takes tens of minutes; the sub-second run you saw is the
  deterministic backend, and the recording says which is which.
- The ERP is seeded, not a customer's production system.
- Web search, email RFQ and the automatic shortage detector are designed, not
  demonstrated.
