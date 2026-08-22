# A supplier's answer is a Claim, never a fact

What a supplier tells us on the phone and what our own system of record says are two different kinds of data, and we model them as two types — `Claim` and `SupplierRecord` — that are never merged into one "quote" object. A supplier may be wrong, out of date, or talking up their own book; treating their word as fact would silently destroy the thing that makes this product worth building, which is the comparison between the two.

## Consequences

Every downstream consumer has to say which one it is using, and the interesting logic lives in the difference: claimed price against contract price, claimed lead time against standard lead time, claimed quantity against known allocations, claimed certification against its recorded expiry. `Claim` carries a confidence score so a half-understood call degrades rather than lies, and every field admits "unknown" so nothing is ever guessed into a number.
