# Sourcing foundation behavior

This specification defines the behaviors every SupplyOS sourcing flow preserves.
The product and component boundaries are recorded in `../PLAN.md`.

## Trusted records and supplier claims

ERP records and supplier claims are different kinds of evidence:

- An ERP record is the factory's trusted baseline: stock, demand, approved
  suppliers, contract prices, lead times, certifications, and known allocations.
- A claim is what a supplier reported during one contact. It carries evidence
  and confidence and is never promoted to a trusted record automatically.

An incident is derived from ERP records. A decision compares records and claims,
applies policy, calculates landed recovery plans, and recommends options for a
human buyer. These types remain distinct in the shared contracts.

## System of record

The system-of-record interface must support the queries needed to:

1. list inventory and derive an incident for a selected part;
2. retrieve an existing incident;
3. retrieve approved supplier records for a part; and
4. retrieve the stock, purchase-order, price-history, BOM, and policy context
   used to explain the incident and evaluate recovery plans.

The YAML and SQLite implementations must return equivalent domain data. Missing
supplier results are an empty collection; a missing incident is an explicit
error. Supplier ordering is deterministic.

## Calls and claims

Every call script begins with a non-optional disclosure: the caller is an AI
assistant acting for the named buyer, gathers information only, makes no
commitment on price, quantity, or delivery, and stops when asked.

The call asks for quantity, readiness date, unit price and currency, exact part
confirmation, certification status, and whether stock is genuinely free or
already allocated. The result schema allows unknown values instead of forcing a
guess.

Normalizing a completed or malformed call always returns typed evidence. Missing
or invalid answers become unknown/zero as appropriate with confidence zero; one
bad call never aborts the wider sourcing case.

## Phone safety

Numbers are validated as E.164 on entry. Display, logs, events, fixtures,
exceptions, and artifacts contain masked numbers. A raw number may appear only
inside the literal provider request that places a call.

Demo fixtures use officially reserved fictional ranges. A live demo should set
`DEMO_CALL_DESTINATION` to a number controlled by the operator so no stored
supplier number is dialed.

## Rehearsal and live mode

Rehearsal is the default and performs no provider call. Live calling requires:

1. `FAKE_CALLS=0`;
2. `LIVE_CALLS=yes-place-real-calls`;
3. provider credentials; and
4. an explicit live request for the individual call.

An absent or malformed condition refuses the live request; it never silently
falls back or upgrades modes. Automated tests, setup, contract generation, and
ordinary demos remain offline.

## Money, policy, and decision

Money uses `Decimal` throughout and serializes as decimal strings. Candidate
screening records every rejecting policy rule. Costing includes the information
required to explain landed cost and timing, including split plans where useful.
Ranking prioritizes arrival before line stop, then landed cost; excluded or late
options remain visible with their reason.

SupplyOS stops at recommendation. Publishing creates review evidence, not an
order, and a buyer remains the approval boundary.

## Completion criteria

- Both record adapters pass the same behavioral tests.
- Generated contracts match the canonical Python models.
- Claim conversion is total over malformed provider results.
- API and frontend tests run without network access.
- Safety tests prove no API response exposes raw phone numbers.
- Rehearsal is reported by `/healthz` in a default environment.
