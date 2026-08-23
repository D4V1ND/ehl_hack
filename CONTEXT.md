# SupplyOS

A bearing shortage at a German automotive manufacturer launches an agent that gathers supplier Claims, checks them against trusted records, and prepares Candidates for a human Decision in SupplyOS.

## Language

**Incident**:
The trusted factory shortage for one part: quantity required, quantity on hand, and the line-stop clock.
_Avoid_: ticket, alert, shortage record (as a type name)

**Supplier Record**:
The factory's trusted supplier facts, including contract price, certifications, and known allocations.
_Avoid_: supplier profile, vendor master as a type name

**Claim**:
What a supplier said on a call or other channel. Never treated as a fact.
_Avoid_: quote, answer, result, fact

**Candidate**:
A supplier matched to this Incident, with channel and compliance outcome.
_Avoid_: lead, option, match

**Outreach Task**:
The brief for contacting one Candidate on one channel.
_Avoid_: call job, dial request

**Landed Cost**:
The full cost of covering a quantity from one supplier, including goods, freight, duty, and carrying cost.
_Avoid_: quote total, price

**Strategy**:
One way to cover the shortfall: one or more order lines, possibly a split across suppliers.
_Avoid_: plan, scenario, option pack

**Decision**:
The Candidate chosen by a human after policy and Landed Cost checks. A recorded Decision is final and does not place an order.
_Avoid_: recommendation blob, verdict, pull request, merge approval

**Cockpit**:
One `/chat` screen for a bearing shortage across the Munich and Stuttgart plants. The main conversation contains concise Claim progress and the Decision handoff. A fixed Candidate panel shows independently expandable Candidate rows, staggered calling-agent cards, and terminal sourcing states. `?call=<id>` opens the large call modal. A compact Decision bar prompts and records the human choice.
_Avoid_: console (as the product surface), control room, multi-page dashboard, file tree, Files/Results tabs

**Event**:
One append-only log line for the case: actor, stage, message, payload.
_Avoid_: log entry, notification, websocket message

**stock_status**:
Whether the units in a Claim are free in stock, in stock but allocated, still to be made, unavailable, or unclear.
_Avoid_: on_hand_unallocated, on_hand_allocated, in_production, not_available, unknown (as a stock_status value)
