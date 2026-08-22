# Devin MCP

Use the authenticated Devin MCP for Devin's private-repository documentation and live platform state. The server can also manage Sessions, playbooks, Knowledge, schedules, and integrations.

Official reference: [Devin MCP](https://docs.devin.ai/work-with-devin/devin-mcp).

Create an organization-scoped service-user key in Devin under **Settings → Service users**. The key must start with `cog_`; legacy `apk_` keys do not work.

Export the key before starting a coding agent:

```bash
export DEVIN_API_KEY="cog_..."
```

Keep the value outside Git. The checked-in configurations read only the environment variable:

- Codex: `.codex/config.toml`
- Claude Code: `.mcp.json`
- Cursor: `.cursor/mcp.json`
- Gemini CLI: `.gemini/settings.json`

Restart the client after setting the key. Verify with `codex mcp list`, `claude mcp list`, `agent mcp list`, or Gemini's `/mcp list`.

## Source precedence

1. Use the checked-out code and configuration for current implementation truth.
2. Use specifications, ADRs, and design documents for intent and accepted decisions.
3. Use Devin Wiki as a map for unfamiliar or cross-repository code, then verify its claims against sources.

Generated Wiki content is an index, not durable truth. Confirm the repository and branch before relying on it.

## Use when

- The task spans repositories or asks about code missing from the current checkout.
- Broad architecture discovery would benefit from Wiki structure, citations, or cross-repository questions.
- The task asks for history or status from a Devin Session.
- The developer asks to create or manage Sessions, playbooks, Knowledge, schedules, or integrations.

Use local search first for ordinary work inside this checkout.

## Authorization

Repository and Wiki reads are normal research. Cross-check conclusions before changing code.

Creating Sessions can spend ACUs. Sending messages, terminating Sessions, and changing playbooks, Knowledge, schedules, or integrations mutate shared external state. Perform those actions only when the developer explicitly requests them.

Never print, log, or commit `DEVIN_API_KEY`.
