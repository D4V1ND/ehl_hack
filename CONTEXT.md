# Stockout

A factory shortage launches an agent that gathers supplier Claims, checks them against trusted records, and ships a purchase recommendation as a pull request.

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
The ranked Strategies plus the recommended purchase, with links to the policy report, cost report, and pull request.
_Avoid_: recommendation blob, verdict

**Cockpit**:
One chat screen. The user launches a sourcing run and watches tool calls, Claims, and the Decision in that transcript.
_Avoid_: console (as the product surface), control room, multi-page dashboard, marketing landing

**Event**:
One append-only log line for the case: actor, stage, message, payload.
_Avoid_: log entry, notification, websocket message

**stock_status**:
Whether the units in a Claim are free in stock, in stock but allocated, still to be made, unavailable, or unclear.
_Avoid_: on_hand_unallocated, on_hand_allocated, in_production, not_available, unknown (as a stock_status value)
