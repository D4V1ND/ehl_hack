# Devin API and tool-call streaming

Research date: 2026-08-23. Sources are official Devin documentation and the authenticated official Devin MCP schema.

## Conclusion

If **retail API** means a normal customer-accessible API, yes. Devin API v3 is a documented REST API for product backends. Teams and standard non-Enterprise organizations can create service users and launch Devin Sessions. Enterprise is not required for single-organization Session orchestration. [API overview](https://docs.devin.ai/api-reference/overview) [Teams quick start](https://docs.devin.ai/api-reference/getting-started/teams-quickstart)

If **real-time API** was intended, the answer is narrower:

- Devin does not document a supported REST, SSE, WebSocket, or outbound-webhook feed that pushes every cloud Session tool call to a product backend.
- The REST API provides Session lifecycle data, messages, attachments, and final structured output. Devin's documented monitoring flow uses polling. [Common flows](https://docs.devin.ai/api-reference/common-flows)
- The official Devin MCP is the closest match. Its `devin_session_events` tool can list the full event timeline, fetch event details, and search event contents. It is a query interface, not a documented live subscription. [Advanced capabilities](https://docs.devin.ai/work-with-devin/advanced-capabilities) [Devin MCP](https://docs.devin.ai/work-with-devin/devin-mcp)

SupplyOS can use Devin from its backend now. It should stream its own product events to the Cockpit and treat Devin's event timeline as optional progress enrichment.

## Interface comparison

| Surface | What it exposes | Delivery and granularity | Access |
| --- | --- | --- | --- |
| Organization REST API v3 | Create, list, get, message, terminate, and archive Sessions. It also exposes attachments, tags, insights, ACU use, PRs, status, and final structured output. [Current API index](https://docs.devin.ai/llms.txt) | `GET .../sessions/{devin_id}` gives coarse lifecycle state. It is not an action stream. [Get Session](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session) | Teams, standard organizations, and Enterprise. Use an organization-scoped service user for one SupplyOS organization. [Teams quick start](https://docs.devin.ai/api-reference/getting-started/teams-quickstart) |
| Session messages REST API | Chronological records containing `created_at`, `event_id`, `message`, and `source`. [List Session messages](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-messages) | Cursor-paginated polling. The documented schema has no typed shell, browser, file, or MCP call object. [Common flows](https://docs.devin.ai/api-reference/common-flows) | Requires `ViewOrgSessions`. [List Session messages](https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-messages) |
| Devin MCP | `devin_session_events` lists summaries, fetches full details, and searches event contents. Devin calls this the Session's "full event timeline." [Advanced capabilities](https://docs.devin.ai/work-with-devin/advanced-capabilities) | Pull-based tool calls over MCP. Devin documents no event-subscription action, push latency, replay guarantee, or stable event payload version. | Requires a Devin account and a `cog_` credential. Enterprise service users and PATs also send `X-Org-Id`; organization service users resolve it automatically. [Devin MCP](https://docs.devin.ai/work-with-devin/devin-mcp) |
| Enterprise REST API | Cross-organization Sessions, analytics, billing, audit logs, members, and infrastructure. [API overview](https://docs.devin.ai/api-reference/overview) | Cursor-paginated requests. It does not add a live internal Session-event stream. | Enterprise only, with endpoint-specific RBAC. [Enterprise quick start](https://docs.devin.ai/api-reference/getting-started/enterprise-quickstart) |
| Audit logs | Administrative actions such as `create_session`, `send_message`, `sleep_session`, `terminate_session`, and platform configuration changes. [Enterprise audit logs](https://docs.devin.ai/api-reference/v3/audit-logs/enterprise-audit-logs) | Control-plane history, not the shell, browser, file-edit, or MCP timeline. | Enterprise service user with `ManageEnterpriseSettings`. [Enterprise audit logs](https://docs.devin.ai/api-reference/v3/audit-logs/enterprise-audit-logs) |
| Automations and webhooks | Incoming webhook requests can start or message a Session. Automations can send email success or failure notifications. [Automations](https://docs.devin.ai/product-guides/automations) | These are inbound triggers and coarse notifications. They are not an outbound Session-event webhook. | Organization feature. This does not provide a tool-call feed. |

## Can MCP retrieve Devin's tool actions?

Probably, with an important contract caveat.

The official docs say MCP can inspect a Session's full event timeline and fetch detailed event contents. The official MCP server currently advertises filters for event categories including `shell`, `file`, `search`, `browser`, `mcp`, `git`, `message`, and `status`. This schema was verified directly against the authenticated [Devin MCP endpoint](https://mcp.devin.ai/mcp) on the research date.

This makes MCP suitable for a proof of concept that reconstructs visible Devin activity. The public documentation does not promise that each event maps one-to-one to an internal model tool call. It also does not freeze argument, result, ordering, retention, latency, or redaction semantics. SupplyOS should validate these properties with a real rehearsal Session before depending on them.

"Streamable HTTP" does not change that conclusion. It is the current MCP transport. Devin deprecated the legacy MCP SSE endpoint and recommends `/mcp`; the docs do not describe this transport as a subscription to ongoing Session events. [Devin MCP wire protocols](https://docs.devin.ai/work-with-devin/devin-mcp#wire-protocols)

## The ACP live WebSocket caveat

Devin now mentions an **ACP live WebSocket** in its PAT documentation. PATs can authenticate to real-time endpoints used by clients such as Devin CLI and Devin Desktop. However, Cognition does not publish that WebSocket's URL, message schema, lifecycle, service-user support, or backend integration guide in the current API index. [Personal Access Tokens](https://docs.devin.ai/api-reference/personal-access-tokens) [Current API index](https://docs.devin.ai/llms.txt)

The documented ACP integration is for local editor clients. `devin acp` runs as a subprocess and speaks JSON-RPC over standard input and output. ACP can carry `tool_call` and `tool_call_update` notifications, but these docs concern Devin CLI or custom local agents, not attaching to a REST-created cloud Devin Session. [Devin CLI in Zed](https://docs.devin.ai/cli/acp/zed) [Building a custom ACP agent](https://docs.devin.ai/desktop/acp-custom)

Therefore, the ACP mention proves that Cognition has real-time client infrastructure. It does not establish a supported product-backend API for streaming an existing cloud Session. SupplyOS should not build on it without written confirmation from Cognition.

## Authentication and plan gates

- Use a service user with a `cog_` key for a production backend. Devin recommends service users for shared automation. [Authentication](https://docs.devin.ai/api-reference/authentication)
- Creating a Session needs `UseDevinSessions`. Reading Sessions and messages needs `ViewOrgSessions`. Sending messages, terminating, or archiving needs `ManageOrgSessions`. [Permissions and RBAC](https://docs.devin.ai/api-reference/v3/overview)
- MCP advanced capabilities need `UseDevinExpert`. Default organization Member and Admin roles include it. [Advanced capabilities](https://docs.devin.ai/work-with-devin/advanced-capabilities)
- Teams exposes API setup and Member or Admin service-user roles. Custom fine-grained RBAC and cross-organization administration are Enterprise features. [Teams quick start](https://docs.devin.ai/api-reference/getting-started/teams-quickstart) [Enterprise quick start](https://docs.devin.ai/api-reference/getting-started/enterprise-quickstart)
- REST endpoints can return `429`. Devin publishes no universal safe polling interval. Clients must back off and deduplicate cursor results. [API overview](https://docs.devin.ai/api-reference/overview) [Pagination](https://docs.devin.ai/api-reference/concepts/pagination)
- Legacy v1 and v2 remain available during deprecation but receive no new features. New work should use v3 and `cog_` credentials. [Migration guide](https://docs.devin.ai/api-reference/getting-started/migration-guide)

The workspace's configured Devin MCP credential authenticated during this research, but Session search returned `403` for missing `org.sessions.view`. Grant the service user Session-view access before testing real event payloads. No Session was created or changed.

## Recommended SupplyOS design

1. Launch the Session with `POST /v3/organizations/{org_id}/sessions`.
2. Request strict final structured output using SupplyOS's JSON Schema. [Create Session](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)
3. Log every SupplyOS `/tools/*` request and result as the canonical progress trail.
4. Push those owned events to the Cockpit through SupplyOS SSE or WebSockets.
5. Poll REST lifecycle and messages. Optionally poll MCP events for extra visual context.

This split preserves the domain boundary. SupplyOS owns the application-relevant evidence and audit trail. Devin messages and internal activity explain progress, but they do not become trusted Supplier Records or Claims by themselves.

After the Session finishes, read `structured_output`, validate it again against SupplyOS contracts, then persist Candidate and Claim evidence. Devin can require a final `provide_structured_output` call and validate it against a self-contained JSON Schema. [Create Session](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)

## Questions for Cognition before using MCP as a product feed

1. Is `devin_session_events` supported for customer-facing product backends?
2. Are event types and payload schemas versioned and backward compatible?
3. What are event retention, ordering, redaction, and pagination guarantees?
4. What polling frequency and rate limits are supported per active Session?
5. Is the ACP live WebSocket available to service users for cloud Sessions?

## Repository implications

`docs/PLAN.md` still references `POST /v1/sessions` and says to "stream status." Before implementing Slice D, change that plan to v3 and define polling unless Cognition confirms a supported live feed. `docs/agents/devin-mcp.md` already matches the current `cog_` service-user authentication model.
