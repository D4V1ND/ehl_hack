# Suppliers are reached by whatever channel their geography supports

An Outreach task is routed to voice, email or marketplace by where the supplier is, not by preference. CALL-E — our voice provider — supports Germany but not China, so the China leg of a sourcing case cannot be a phone call and goes out as an email RFQ or marketplace message instead.

## Consequences

Channel becomes a first-class part of the model rather than an implementation detail, and every channel is required to yield the same `Claim` so that options stay comparable no matter how the answer arrived. This is a constraint imposed by the provider, not a design preference: a future voice provider with China coverage would be a routing-table change.
