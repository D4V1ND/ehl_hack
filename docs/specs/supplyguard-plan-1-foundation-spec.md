# SupplyGuard — Plan 1 (Foundation) — Plain-Language Spec

This document describes what the foundation layer of SupplyGuard does — no code, just behavior: what goes in, what comes out, what rules are enforced, and why. It is meant to be read by anyone, technical or not, who wants to understand the system before looking at a single line of implementation.

## What SupplyGuard Is, In One Paragraph

A factory is short on a part it needs. SupplyGuard phones the factory's approved suppliers, asks each one specific questions about that part, and writes down what they say as a structured record — never as a decision. Separately, SupplyGuard already knows what the factory's own paperwork says about each supplier (contract price, agreed lead time, certification status, and how much stock is already promised to other customers). The foundation layer built in this plan does not yet compare the two. It just makes sure both sides — "what the supplier said" and "what our records say" — exist as clean, trustworthy, separately-typed information. Comparing them and making a decision is a later phase.

## The Guiding Idea

There are two kinds of facts in this system, and they must never be confused with each other:

- **What our own records say about a supplier.** This comes from the factory's own systems (its ERP, its supplier database). It's the trusted baseline — contract price, lead time, certification expiry, how many units are already spoken for.
- **What a supplier says on the phone.** This is a claim, not a fact. A person or a supplier's own system might exaggerate, misspeak, or simply not know. It has to be captured faithfully, but it must never be treated as automatically true.

Keeping these as two separate kinds of information — rather than merging them into one blob — is the entire point of the product. Everything downstream (checking a claim against the record, and deciding whether to trust it) depends on this separation already existing at the data level.

## The Five Building Blocks

Picture five pieces stacked on top of each other, each one only relying on the pieces below it:

1. **Phone number safety** — the foundation. Every phone number that enters the system is checked to make sure it's a real, correctly-formatted number, and every phone number that gets displayed, logged, or printed anywhere is partially hidden so the full number is never exposed by accident.
2. **The shared vocabulary** — the common language every other piece speaks: what a "shortage" looks like, what a "supplier record" looks like, what a "claim from a phone call" looks like. This layer uses the phone number safety piece to make sure any phone number stored in it is already validated and can always be safely displayed in masked form.
3. **The system of record** — what the factory's own files say about each supplier: their contract price, their agreed delivery time, their certification, and how many units they've already promised elsewhere. This is the trusted baseline that a supplier's phone claim will eventually be checked against. It's built so that a company can plug in their own real system (their ERP) later, by implementing just two simple lookups, without changing anything else.
4. **The call script and its answer sheet** — what the calling agent will actually say out loud on the phone, and, equally important, an exact list of the questions it must get answered and in what form. This is what turns a rambling phone conversation into clean, structured data instead of a vague summary.
5. **Turning a finished call into a claim** — the last step: taking whatever came back from a phone call (or, in rehearsal mode, a saved recording of what a call would have returned) and turning it into one of the "claim" records defined in the shared vocabulary. This piece also owns the single on/off switch between "just pretend a call happened" and "actually dial the phone."

Nothing in this foundation layer makes a judgment call about whether a supplier's answer is good, bad, suspicious, or acceptable. It only makes sure the information exists, is well-formed, and is safe to handle. Deciding what the information *means* is explicitly left for a later phase.

---

## Building Block 1: Phone Number Safety

**Purpose:** Be the single gatekeeper for every phone number in the system, so no other part of the code has to think about phone number formatting or leakage.

**What goes in:** A phone number as plain text, exactly as it appears wherever it came from (a spreadsheet, a form, a database row).

**What comes out, depending on which operation is used:**

- *Checking a number is valid:* either the same number handed back unchanged (meaning "this is acceptable"), or a clear rejection if the number isn't in the correct international format (must start with a plus sign, have a sensible country code, and contain only digits — no dashes, spaces, or other punctuation, and not too short or too long to be real).
- *Masking a number for display:* a version of the number where only the very first digit and the very last four digits are visible, and everything in between is replaced with stars. A number too short to safely show any middle portion has almost everything starred out.

**The rule that matters most:** a raw, full phone number is only ever allowed to exist in one place in the whole system — inside the actual request sent to make a phone call. Anywhere else it might show up (a printed message, a saved log, a report, a test example file) it must already be in its masked form. This is a hard rule, not a suggestion.

---

## Building Block 2: The Shared Vocabulary

**Purpose:** Define the handful of record types that every other part of the system passes around, so there's one agreed shape for "a shortage," "a supplier we know," and "a thing a supplier told us."

### The Shortage (an "Incident")

Represents one specific part running low. Describes:

- Which part is short, and its identifying part number.
- How many units are needed in total, and how many are currently on hand.
- The exact date and time production will be forced to stop if the shortage isn't resolved.
- How much it costs, per hour, if the production line actually stops.
- An optional extra cost for rushing an order (an "expedite" fee), and which currency all the money figures are in.

From this, the system can always work out **how many units are actually still missing** — the required amount minus what's already on hand. This number is never allowed to show as negative; if there's enough on hand already, the shortfall is simply zero.

### What Our Records Say (a "Supplier Record")

Represents everything the factory's own paperwork/database knows about one approved supplier for one specific part. Describes:

- Which supplier this is (an identifier and a display name), their phone number, and their country/region and language, so a call can be placed correctly and in the right language.
- Which part number this record applies to.
- Whether the supplier is currently approved to sell this part at all, and whether they're a "preferred" supplier (meaning they should generally be tried before others).
- The contractually agreed price per unit, and the standard number of days it normally takes them to deliver.
- Which quality certification they're supposed to hold, and when that certification is due to expire.
- How many units of this part are already promised to *other* customers right now ("known allocations") — this is the number that later catches the difference between a supplier saying "yes we have stock" and that stock actually being available to *this* factory.
- The largest quantity this supplier has ever been able to fill in one go historically, useful context for judging how big an ask is reasonable.

A supplier record can always produce a masked version of its own phone number for safe display — the raw number is never handed out directly from this record.

Any phone number stored in a supplier record is checked for validity the moment the record is created; a record with a malformed phone number is rejected outright rather than being allowed to exist.

### What A Supplier Said (a "Claim")

Represents the structured outcome of a single phone call, before anyone has judged whether to believe it. Describes:

- Which supplier this came from, which round of calling it was (a factory might call more than once), and which specific call it refers to.
- How many units the supplier says they can supply.
- The earliest they say the units could be ready, in their own words.
- Whether they gave a specific price at all, what that price is, and in what currency (each of these can also come back as "unknown," never forced into a false yes or no).
- Whether they confirmed their quality certification is currently valid — again with "unknown" as a legitimate answer if it wasn't discussed.
- Whether they confirmed the exact part number being asked about.
- **The single most important field:** whether the units they mentioned are sitting in stock and genuinely free, or sitting in stock but already promised to someone else, or not even made yet, or simply not available, or unclear. This is the distinction that catches suppliers who say "yes we have some" while meaning "yes, but they're not actually yours."
- A confidence score describing how sure the system is that the call actually produced a clean, trustworthy answer.
- A short list of direct quotes or paraphrased evidence backing up what was recorded, so a human reviewing the claim later can see *why* the system concluded what it did.

There are three fixed vocabularies used throughout claims and records so that answers are always one of a known set of options rather than free-form text: a **yes/no/unknown** vocabulary for questions a supplier might dodge, a **stock status** vocabulary covering "free and in stock," "in stock but reserved for someone else," "still being made," "not available," or "unclear," and a **currency** vocabulary for the handful of currencies the system deals in (plus "unknown" if none was given).

---

## Building Block 3: The System Of Record (and the plug-in point for a real ERP)

**Purpose:** Hold the factory's own trusted facts about its suppliers, and be the "second source" that a phone claim eventually gets checked against. Also define, in the smallest possible terms, how a real company would connect their actual inventory/ERP system in place of the demo data.

**What goes in:**

- A one-time load of supplier information (from a data file, in the demo's case) — one entry per approved supplier per part, containing everything described in the "Supplier Record" shape above.
- A one-time load of the current shortage/incident information (again from a data file in the demo).
- Afterward, everyday lookups: "give me every approved supplier for this part number" and "give me the details of this specific shortage."

**What comes out:**

- For a part-number lookup: a list of every approved supplier for that part, already validated and shaped as proper supplier records, ordered with preferred suppliers first and, among equally-preferred suppliers, cheapest contract price first. This ordering is deliberate and fixed — which supplier gets called first is never left to guesswork.
- Asking about a part number nobody supplies simply returns an empty list, not an error.
- For a shortage lookup by its identifier: the full shortage details, ready to use. Asking for a shortage identifier that doesn't exist is treated as a real error, not silently returned as an empty or fake result — a missing incident should never be confused with an incident that has no shortfall.
- Loading the same supplier data twice in a row does not create duplicate entries — the second load simply replaces the first.

**The plug-in point, explained simply:** the "system of record" is described as a contract with exactly two capabilities — "look up approved suppliers for a part" and "look up an incident by id." Anything that can answer those two questions correctly counts as a valid system of record, whether it's backed by a small local database (as the demo is) or by a company's real inventory system, or even by something as simple as a JSON export with no database behind it at all. This is intentionally *not* a plugin marketplace with configuration files and auto-discovery — it's a minimal, two-question contract that a company implements once, against whatever system they already run, and the rest of SupplyGuard doesn't need to know or care which one is behind it.

**The demo data** seeds four fictional suppliers across four countries, three of them approved for the same part number (used to prove that ordering and filtering both work correctly) and one on a different part number entirely (used to prove that a supplier for the wrong part is correctly excluded). The demo shortage describes needing twelve units of a part while only four are on hand — a shortfall of eight, which becomes the number every later phase of SupplyGuard is trying to close.

**A safety rule that applies here too:** every phone number used anywhere in the demo data is deliberately drawn from number ranges that each country has officially set aside for fiction and testing — never a number that could ring a real person. This matters because later phases of the system are capable of actually dialing whatever number is stored here.

---

## Building Block 4: The Call Script And Its Answer Sheet

**Purpose:** Define exactly what gets said out loud on a call, and exactly what shape the answer must come back in, so a phone conversation turns into clean structured data rather than a paragraph of prose that has to be interpreted later.

**What goes in:** The shortage being worked, the specific supplier being called, and the name of the buying company placing the call.

**What comes out:** Two things, produced together for every call:

1. **The spoken instructions for the call**, always beginning with a mandatory, non-optional disclosure that the caller is an AI assistant calling on behalf of the named buying company, that it will not agree to any price, quantity, or delivery commitment on the call (it is only gathering information — a human always makes the actual decision), and that if the person on the other end asks for a human or asks the call to stop, it will end the call politely rather than pushing on. This disclosure is baked into how the call script gets built — nothing that calls this piece can produce a version of the script without it. After the disclosure, the script asks the supplier: how many units they can supply, the earliest they could be ready, the price per unit, and — the most important question — to confirm explicitly whether any units they mention are truly free, or already promised to somebody else. It also asks them to confirm the exact part number and whether their certification for this part is currently valid. The factory's own contract price is deliberately never mentioned to the supplier — the point is to hear their number, not anchor them to ours. The supplier's raw phone number is also never present anywhere in the spoken script text — it only ever travels separately as part of placing the call itself.

2. **The answer sheet** — an exact specification of every field the call must report back, with no extra, unexpected fields allowed. Every field that requires a judgment call (was a price actually quoted, is certification current, was the part number confirmed, what's the stock status) explicitly allows "unknown" as a legitimate answer, so the calling agent is never forced to guess just to fill in a field. The stock-status field in particular is able to distinguish "in stock and free" from "in stock but already spoken for" — which is the single most important distinction the whole product is designed around, since a plain yes/no question about availability would never catch it.

---

## Building Block 5: Turning A Finished Call Into A Claim

**Purpose:** Take whatever a phone call actually produced — or, most of the time, a saved recording of what a call would have produced — and turn it into one clean, typed "Claim" record as defined in the shared vocabulary. Also owns the single switch that decides whether a real phone call happens at all.

**The two modes:**

- **Rehearsal mode (the default, always safe):** instead of placing any call, this reads a previously saved result for that supplier — as if the call had already happened and been recorded — and turns it into a claim. No phone ever rings in this mode. Every test, every demo, and every rehearsal of the system runs this way unless someone deliberately switches modes.
- **Live mode (an explicit, opt-in choice):** actually places a real phone call to the supplier and waits for it to finish, then turns the real result into a claim the same way rehearsal mode does. This can never happen by accident — it requires the caller to explicitly ask for it, and it requires a real access key to be available; without one, live mode refuses outright rather than silently failing or falling back to rehearsal data.

**What goes in:** A supplier record, the shortage it relates to, which round of calling this is, and which mode to use (rehearsal by default).

**What comes out:** One claim, always — even when something goes wrong.

**The rule that matters most here:** this piece is never allowed to crash or blow up the run, no matter how garbled or incomplete the call result is. If a call comes back with missing information, a field that doesn't match any of the allowed options, or no usable result at all, the output is still a valid claim — just one where every field defaults to "unknown" (or the equivalent, like zero units or "not stated"), and the confidence score is set to the lowest possible value, zero. This isn't a shortcut or a hack — it's intentional, because a later phase of the system is designed to automatically distrust any claim below a certain confidence threshold. A broken or unusable call result is meant to flow naturally into "we couldn't verify this one," not to halt the whole shortage-resolution process partway through.

**A related safety feature for live mode:** there is a rehearsal override — a way to redirect every real outbound call to one chosen number (for example, the operator's own phone) instead of the actual supplier's number, so a person can rehearse the live-calling path by playing the supplier themselves. When this override is active, it is announced loudly and visibly (never silently), and the number used must itself pass the same validity check as any other number — a broken override number is refused rather than dialed. This exists specifically so nobody ever has to put a real supplier's number at risk just to test that live calling works, and so the repository itself never needs to contain a real phone number — the operator's own number lives only in their own local environment, never committed to the code.

---

## Rules That Apply Across The Whole Foundation

These are non-negotiable, and every building block above respects them:

- **No test, demo, or rehearsal run is ever allowed to touch the network or place a real call.** Rehearsal mode is the default everywhere; live calling is always a deliberate, explicit choice, never something that happens because a setting was left unset.
- **Every phone number is checked for correctness the moment it enters the system, and masked every time it's shown, logged, or printed.** The only exception, ever, is the literal request used to place a call.
- **The AI disclosure at the start of every call cannot be skipped, forgotten, or passed as an optional setting** — it's simply always there.
- **All money figures are handled with exact decimal precision**, never the kind of approximate arithmetic that can quietly drift a price by a fraction of a cent.
- **No real secrets, access keys, or real phone numbers live in the project itself.** Access keys come from the operator's own environment; every phone number used anywhere in examples or demo data is deliberately fictional and drawn from a range officially reserved for that purpose.

## What This Foundation Deliberately Does Not Do Yet

To be clear about scope, so nothing below is mistaken for an oversight:

- It does not compare a supplier's claim against the factory's own records, or flag disagreements between them. That comparison — the actual "does this claim check out" logic — is the next phase, and it's the real product.
- It does not decide which supplier to trust, does not build a recovery plan, does not challenge a supplier with a follow-up call, does not score or rank outcomes, and has no user-facing screen. All of that comes later.
- It does not involve any language model or AI reasoning yet — this layer is purely about safely capturing and structuring data, not interpreting or judging it.
- It does not build a general-purpose plug-in marketplace for connecting different companies' inventory systems — only the minimal two-question contract a company would implement once, plus the one working example used for the demo.

## Definition Of Done For This Foundation

- Every phone number anywhere in the project can be traced back to a number range a country has officially set aside for fiction — never a real, reachable number.
- No real access key, real phone number, or other secret exists anywhere in the project.
- A previously saved call result can be turned into a fully-formed, typed claim in a single step.
- Something as simple as a plain data file with no database behind it can still satisfy the "system of record" contract, proving the plug-in point is real and not just decorative.
- The entire foundation can be exercised — data loaded, suppliers looked up, a shortage described, a call script generated, a saved call turned into a claim — without a single real phone call being placed or a single byte going out over the network.
