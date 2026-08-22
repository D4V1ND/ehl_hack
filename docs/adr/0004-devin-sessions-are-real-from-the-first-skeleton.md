---
status: proposed
---

# Devin sessions are real from the first skeleton; everything else starts mocked

In the walking skeleton the system of record, the outreach channel and the supplier answers are all mocked, but the Devin session is created through the real Devin API from the very first commit. Autonomous orchestration is the riskiest integration we have and the one thing being graded, so mocking it would hide exactly the failure we cannot afford to discover late.

## Consequences

Every developer needs a working Devin API key on day one, and the skeleton costs ACUs to run. In exchange, "an agent did this without a human" is proven in hour three rather than asserted in hour twenty, and the mocked layers can be replaced one at a time behind stable endpoints without the orchestration loop ever being re-tested from scratch.
