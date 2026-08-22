# We do not build an Entire adapter for Devin during the jam

Entire captures agent work through per-agent-CLI hooks, and Devin is not one of its registered agents (`claude-code`, `codex`, `copilot-cli`, `cursor`, `factoryai-droid`, `gemini`, `opencode`, `pi`). We verified that `checkpoints.primary.type = "git-refs"` is only the checkpoint *storage* backend and does not reconstruct sessions from commits: a throwaway commit followed by `entire hooks git post-commit` produced no checkpoint, no ref and no commit trailer, and `entire session attach --agent devin` fails with `unknown agent: devin`.

## Considered options

Entire documents an external-agent plugin protocol — an `entire-agent-devin` executable registered with `entire agent add devin` — and Devin's own lifecycle hooks map onto Entire's event model closely enough that it would work. We estimated one to two engineering days for a minimal adapter, with transcript fidelity as the main unknown. That is a quarter of the team for the whole event, spent on tooling rather than on the thing being judged, so it goes on the post-event list instead.

## Consequences

Devin's reasoning is not captured as Entire checkpoints. The audit trail the panel actually reviews is therefore the Git history plus the Devin session URL carried in every pull request body, which is why the rules in `docs/PLAN.md` §7 — no direct pushes to `main`, no force-pushes, no squash merges, never strip the session link — stop being hygiene and become the mitigation.
