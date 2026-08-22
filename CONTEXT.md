# SupplyGuard

A factory is short a part and its production line will stop. SupplyGuard finds out what the market can actually supply — by phoning and messaging suppliers — and turns the answers into a costed, compliance-checked sourcing recommendation that a human approves.

This file is the glossary and nothing else. Scope, sequencing and decisions live in [`docs/PLAN.md`](docs/PLAN.md), [`docs/mvp-flow.md`](docs/mvp-flow.md) and [`docs/adr/`](docs/adr/).

## The shortage

**Incident**:
A specific occurrence of a part being short at a plant, with the date the line stops if nothing is done. The unit of work — everything else hangs off one Incident.
_Avoid_: Problem, ticket, alert, event (Event means something else here)

**Shortfall**:
Quantity required minus quantity on hand, floored at zero. Derived, never stored as an independent truth.
_Avoid_: Gap, deficit, need

**Line stop**:
The moment production halts for want of the part. The deadline every option is judged against.
_Avoid_: Deadline, due date

**Part**:
A single procurable item, identified by its own number and specification. Not a BOM, not an assembly.
_Avoid_: Item, component, SKU, material

**Part class**:
The family a Part belongs to (e.g. rolling bearing, fastener, electronic component). Selects which policy rules and cost parameters apply, so a new family is data rather than code.
_Avoid_: Category, type, group

**Case**:
Everything produced while resolving one Incident, kept together as one reviewable unit.
_Avoid_: Job, run, workflow

## Where information comes from

**System of record**:
The factory's own trusted data — what we stock, what we agreed to pay, who is approved. Answers two questions: what is this part, and who can supply it. Whether it is a real ERP or a mock is an implementation detail behind the same boundary.
_Avoid_: ERP, database, inventory, source of truth

**Supplier record**:
What *we* know about a supplier: approved or not, preferred or not, contract price, standard lead time, certification and its expiry. Trusted, because it is ours.
_Avoid_: Vendor, supplier data

**Candidate**:
A supplier we believe could supply this Part for this Incident, whether it came out of the system of record or off the open web. Being a Candidate implies nothing about willingness, price or eligibility.
_Avoid_: Lead, prospect, option, match

**Quote**:
The commercial half of what a supplier said: price, price breaks, MOQ, lead time, incoterm, expedite option. A Quote on its own does not say whether any of it was actually established.
_Avoid_: Offer, bid, response

**Claim**:
A Quote plus the Answer sheet — stock status, and whether price, part number and certification were *confirmed* or merely asserted, each with its evidence and a confidence score. Never a fact and never a decision: a Claim is only what a supplier said, and it may be wrong, stale or self-serving. The distinction from a Supplier record is the most important one in this glossary.
_Avoid_: Verified quote, answer, supplier data

**Stock status**:
Whether the goods are free, physically in stock but already committed to another customer, still to be made, or unavailable. "In stock" alone is not an answer, because stock committed elsewhere is not stock we can buy.
_Avoid_: Availability, in stock

**Unknown**:
The answer when a supplier did not say, was unclear, or the call broke down. A first-class value everywhere, never inferred and never guessed into a number.
_Avoid_: Null, missing, n/a

## Reaching suppliers

**Outreach task**:
The instruction to ask one Candidate the questions for one Incident, on one channel. Carries the negotiating room but never our contract price.
_Avoid_: Request, RFQ, job, call

**Channel**:
How a Candidate is reached — voice, email, marketplace. Chosen by what the supplier's geography supports, not by preference. Every channel yields the same Claim.
_Avoid_: Medium, method, transport

**Answer sheet**:
The fixed set of questions every outreach must come back with, expressed as the shape of a Claim. What makes results comparable across suppliers and channels.
_Avoid_: Questionnaire, form, template

**Disclosure**:
The statement, made before anything else, that the caller is an AI, who it acts for, and what it will not commit to. Not a step in a script — a precondition for the call existing.
_Avoid_: Intro, greeting, preamble

**Rehearsal**:
Producing a Claim from a saved or acted result, touching no network and dialling nobody. The default everywhere.
_Avoid_: Mock mode, test mode, dry run, simulation

**Live**:
Actually contacting a real supplier. Always a deliberate, explicit choice; never a fallback and never the consequence of an unset setting.
_Avoid_: Production, real mode

## Deciding

**Policy rule**:
One eligibility test a Candidate either passes or fails, applied by name so a rejection can be attributed to it. Concerns what we are *allowed* to buy, never what is cheap.
_Avoid_: Check, validation, filter, constraint

**Price break**:
A unit price that applies from a minimum quantity upwards. Buying more can genuinely cost less per unit — which is why quantity is a decision and not an input.
_Avoid_: Discount, tier, bulk price

**Landed cost**:
What one option truly costs us: goods, freight, duty, tooling, expedite surcharge and the cost of holding stock we bought early. The only figure options may be compared on.
_Avoid_: Total cost, price, cost

**Carrying cost**:
The cost of owning stock before we need it — capital tied up plus storage. What stops "buy more, it's cheaper" from being automatically true.
_Avoid_: Holding cost, storage cost

**Strategy**:
A complete way of covering the Shortfall: one or more order lines, each with a supplier, quantity and freight mode, with its total landed cost and the date coverage is achieved.
_Avoid_: Plan, scenario, proposal

**Split order**:
A Strategy that sources one Part from more than one supplier or freight mode at once — typically a fast expensive line to beat the line stop and a slow cheap line for the rest. Often beats every single-source option.
_Avoid_: Multi-sourcing, dual sourcing

**Decision**:
The recommended Strategy together with the runners-up and the reasoning, published for a human to approve. SupplyGuard recommends; approving is a human act.
_Avoid_: Choice, selection, purchase, order

**Event**:
One entry in a Case's append-only record of what happened and when. What makes a Case watchable while it runs and explainable afterwards.
_Avoid_: Log line, message, update, activity
