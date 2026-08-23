# SupplyOS UI design

How the approved Cockpit looks and behaves. Product name on every surface is **SupplyOS**. Planning documents may still say SupplyGuard.

**Scenario:** SupplyOS supports a German automotive manufacturer resolving a bearing shortage across its Munich and Stuttgart plants. ERP owns the live stock picture. SupplyOS owns one sourcing run at `/chat`.

## Settled (do not reopen unless Lorenz says so)

1. The product has one Cockpit route: `/chat`. The landing stays at `/` and opens the Cockpit directly. There is no `/dashboard` route or Dashboard navigation.
2. `/chat` has the main conversation and one closable **Candidate** panel. It has no file tree and no **Files | Results** tabs.
3. Candidate rows in the fixed panel show the Candidate name, one short Supplier Record description, and one status pebble. Rows expand independently for detail.
4. Outreach Tasks run in parallel. Call details open as a large modal through `?call=<id>`. `?mock=true` opens the first fixture call directly for UI review.
5. One fixed conversation header holds Incident context, Replay, and the Candidate-panel restore control. A fixed bottom dock holds the expandable **Decision** bar and composer. Only the conversation between them scrolls.
6. The agent recommends. A human marks the Decision approved in SupplyOS. **Approved** is the final state. There is no PR card or merge approval.
7. Rehearsal is the default. Phone numbers are masked. Claims remain distinct from trusted Supplier Records.
8. SQLite is the intended operational datastore. This implementation remains fixture-driven. Supabase is explicitly ignored.
9. Colours come only from `apps/web/app/globals.css`. Dark mode is the app default. Build in Next.js; do not use Paper and do not add a route.
10. Use Tabler icons through `apps/web/components/icons.tsx`. Product and primitive components do not import an icon library directly.
11. `apps/web/components/logo.tsx` owns the SupplyOS wordmark and current-colour icon. The Cockpit sidebar shows the icon at 20 × 20 pixels.

## Approved screen structure

Chrome: `CockpitShell` — a full-height shadcn sidebar beside the Cockpit. `apps/erp` opens SupplyOS in a new tab with `/chat?case=<case_id>` into an existing Session. `/chat` has no empty start screen or Incident picker. The navigation sidebar lists fixture Sessions; every Session currently renders the same CASE-001 rehearsal.

Both sidebars use the muted surface; the conversation and its fixed top header use the background surface. The left Session sidebar resizes between 10% and 20% of the viewport. Its logo header and separator align with the conversation top header. The Candidate sidebar resizes between 20% and 50% of the viewport. Its header has an X Button instead of a count. Closing it reveals a Tabler sidebar-open Button at the right end of the conversation header. Toggling the Candidate panel keeps the conversation mounted and preserves its scroll position. Candidate rows use a compact two-line trigger with the Candidate name, a short Supplier Record description, and one status pebble with a size-2 state-coloured dot on a 30%-opacity state background. The trigger contains no other Candidate data. Rows expand independently for Claim, Supplier Record, evidence, and Landed Cost detail. The single conversation header expands Incident properties in place, reveals its chevron on hover or keyboard focus, and places the secondary Replay Button at the top-right. Its compact state shows only the CASE identifier and line-stop timing; the part number stays in the expanded context. The linked Incident is a compact light-neutral mention with foreground text and one accent pebble inside the first user message. Its background is lighter than the surrounding message card. Only the top header spans the conversation width. Thread text, compact Task cards, borderless Tool calls, the Decision card, and the composer share one consistent horizontal gutter inside a centred `w-full` column capped at 50% of the viewport. Completed deterministic runs condense their messages and borderless Tool calls into one count-labelled disclosure with muted Tool icons. Opening it preserves the current scroll position, and its right-facing chevron rotates down with the Decision card timing. One deterministic recommendation message remains visible below the disclosure. Only the conversation content scrolls, using a right-edge muted thumb on a transparent track. The fixed bottom dock has no separating rules. Its Decision card uses the recommended total cost as its title, has no subtitle or duplicate trailing cost, expands upward above its compact row, and the darker composer keeps an outline matching the quiet structural separators elsewhere.

Responsive adaptation is not an MVP priority. Keep the Candidate sidebar visible on tablet and desktop widths. Hide it only below the `md` phone breakpoint.

| Route | File | What you see |
|---|---|---|
| `/` | `apps/web/app/page.tsx` | Marketing landing for the German automotive bearing scenario. A white SupplyOS logo and `Open chat` CTA link to `/chat`; no email field is shown |
| `/chat` | `apps/web/components/cockpit/cockpit-chat.tsx` | Mock Session list, one CASE-001 rehearsal thread, and one closable Candidate panel |

The target `/chat` composition is:

- **Sessions** — compact mock Session links use the part label as their sole title and have no icon. Selected Sessions use a muted background and foreground text. Unselected Sessions use muted text. Completed Sessions use bold foreground text. Every selection opens the same fixture thread.
- **Main conversation** — one full-width fixed top bar above a centred `w-full max-w-[50vw]` content column with concise agent turns, parallel Outreach Tasks, Tool calls, and checks. The header keeps Replay and Candidate restore available without occupying the thread.
- **Messaging** — the linked Incident is an inline light-neutral mention with foreground text and one accent pebble in the first user message. Its background is lighter than the message card. The fixed bottom composer uses a foreground-colour send Button, a spinner while a message submits, and a square stop control while the agent streams. The current rehearsal appends local messages after 1.5 seconds.
- **Incident header** — compact case context by default; expands to show plant, part, shortfall, line-stop, cost, and inventory properties with Tabler icons.
- **Candidate panel** — one closable panel with compact, independently expandable Candidate rows. Each trigger contains only the Candidate name, one short Supplier Record description, one status pebble, and its disclosure chevron. An icon at the right end of the conversation header restores it. It does not become a file browser or general result switcher.
- **Call modal** — a near-full-screen, three-panel call view addressed by `?call=<id>`. History, voice state, and Transcript use equal resizable widths by default. Both sidebars use the shared transparent `call-sidebar` class with muted foreground. History is a connected, timestamped activity timeline for the Outreach Task, call start, call completion, and filed Claim. The Claim confidence badge sits beside its title, and the Claim expands with Evidence inside it. The first transcript item is a plain System prompt combining the Outreach Task and mandatory disclosure. Its label matches other speaker labels without a separator. Agent turns remain plain text without an avatar. Candidate turns use message bubbles and show the Candidate name. The Transcript header does not repeat the phone number. The compact header toggles History and Transcript around the centred Candidate name. Below `lg`, one panel appears at a time and the header toggles return to the call stage. `?mock=true` opens the first fixture call without waiting for the rehearsal. Closing it returns to the same thread state.
- **Decision bar** — borderless and fixed above the composer, with the recommended total cost as its compact title. Details expand upward for Strategy, Landed Cost, policy checks, runner-ups, and rationale. Human approval happens here; approved is final.

Rehearsal data is scripted CASE-001. Tool waits vary, and assistant summaries stream incrementally. No backend is required for this implementation. SQLite remains the intended operational datastore when persistence is added. See [`deterministic-rehearsal.md`](deterministic-rehearsal.md) for the exact temporary logic and its live Devin deletion map.

## Demo beats that must stay visible

1. The Incident connects the Munich and Stuttgart plants to the 6204-2RS bearing shortage.
2. Shenzhen is rejected by `blocked_origin_country`.
3. Munich Motion reports `in_stock_allocated`: in stock is not ours.
4. The cheapest unit price is not the Decision. The winning Strategy splits 20% SKF air and 80% FAG sea.
5. Policy and landed-cost checks pass before a human approves the Decision in SupplyOS.

The completed-flow disclosure keeps the Claim-versus-record messages available without crowding the default view. Call details keep Claim evidence available for audit.

## Design references (structure only)

Use the repository's Emil Kowalski design and animation skills for interaction polish and motion.

- [Devin](https://mobbin.com/screens/1bee4b82-38f1-42a0-b500-aaf06efd2ea4): dense conversation beside a stable working panel; do not copy PR or file chrome.
- [Linear](https://mobbin.com/screens/610d34b6-6ad8-45ab-80fb-2107b31ed01e) and [Plane](https://mobbin.com/screens/75e250ae-a106-4a28-999e-6e51e9ed20e5): compact stable rows with trailing status.
- [Lindy](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5), [Grok Voice](https://mobbin.com/screens/8769afdd-9771-4073-a33e-69acf3019f0b), and [Vapi](https://mobbin.com/screens/3cafda24-5720-467a-a94a-bfeeba0a6ed3): focused transcript, masked call state, and structured Claim progress.
- [ElevenLabs](https://mobbin.com/screens/33f4e3f1-47f4-4b5c-acea-ffe84e663017) and [Hume AI](https://mobbin.com/screens/71393937-6a06-4b94-acb6-9ba9d7a68208): separate call selection from a focused detail view.
- [Cursor](https://mobbin.com/screens/d744068a-1835-4c35-afa2-e560ccbe565d): compact visible checks; do not copy IDE or repository UI.

**Rejected:** Microsoft Copilot empty-chat, incident.io as the primary surface, dashboards, file trees, Files/Results tabs, PR cards, merge approval, and Paper.

## Open questions

None. Visual tuning must preserve the approved hierarchy and domain boundaries above.

## Pointers

- `docs/PLAN.md` Slice A — approved Cockpit behavior.
- `docs/specs/supplyguard-plan-1-foundation-spec.md` — Claim versus record, `stock_status`, and safety.
- `apps/web/app/globals.css` — colour tokens.
- `docs/agents/domain.md` — glossary guidance.
