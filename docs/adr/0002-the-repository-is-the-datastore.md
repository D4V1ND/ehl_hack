# Case artifacts live in Git, not a database

A Case is written as files under `cases/<case_id>/` and committed, and the cockpit reads that directory rather than a database. We considered Postgres and rejected it: the deliverable of this product is an auditable artifact, so storing state anywhere other than the artifact would mean maintaining the same information twice and giving reviewers a view that is not the real one.

## Consequences

There is no schema migration story and no ORM, and a reviewer sees exactly what the system knows. The cost is that case data inherits Git's characteristics — no queries across cases, no concurrent writers to one Case, and history that grows with every run. This is the right trade for a demo and for early production, and it is deliberately not the right trade at scale: see the post-MVP note in `docs/PLAN.md` about splitting generated cases out of the code repository.
