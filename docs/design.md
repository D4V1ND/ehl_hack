# SupplyOS UI design

How the approved Cockpit looks and behaves. Product name on every surface is **SupplyOS**. Planning documents may still say SupplyGuard.

**Scenario:** SupplyOS supports a German automotive manufacturer resolving a bearing shortage across its Munich and Stuttgart plants. ERP owns the live stock picture. SupplyOS owns one sourcing run at `/chat`.

## Settled (do not reopen unless Lorenz says so)

1. The product has one Cockpit route: `/chat`. The landing stays at `/` and opens the Cockpit directly. There is no `/dashboard` route or Dashboard navigation.
2. `/chat` has the main conversation and one fixed **Candidate** panel. It has no file tree and no **Files | Results** tabs.
3. Candidate rows in the fixed panel are compact and stable. More than one row can stay expanded.
4. Outreach Tasks run in parallel. Call details open as a large modal through `?call=<id>`.
5. The status rail lives in the main conversation. A compact expandable **Decision** bar appears at the thread end.
6. The agent recommends. A human marks the Decision approved in SupplyOS. **Approved** is the final state. There is no PR card or merge approval.
7. Rehearsal is the default. Phone numbers are masked. Claims remain distinct from trusted Supplier Records.
8. SQLite is the intended operational datastore. This implementation remains fixture-driven. Supabase is explicitly ignored.
9. Colours come only from `app/globals.css`. Dark mode is the app default. Build in Next.js; do not use Paper and do not add a route.
10. Use Tabler icons through `components/icons.tsx`. Product and primitive components do not import an icon library directly.
11. `components/logo.tsx` owns the SupplyOS wordmark and current-colour icon. The Cockpit sidebar shows the icon at 20 × 20 pixels.

## Approved screen structure

Chrome: `CockpitShell` — a full-height shadcn sidebar beside the Cockpit. SupplyOS opens from an external ERP link into an existing Session. `/chat` has no empty start screen or Incident picker. The navigation sidebar lists fixture Sessions; every Session renders the same CASE-001 rehearsal.

Both sidebars use the muted surface; the conversation and its light top header use the background surface. The left Session sidebar resizes between 5% and 15% of the viewport. Its logo header and separator align with the conversation top header. The Candidate sidebar resizes between 10% and 50% of the viewport. The header spans only the conversation column, expands Incident properties in place, and reveals its chevron on hover or keyboard focus. Replay controls sit directly below it, above the conversation. The linked Incident is a compact primary-colour mention inside the first user message. A darker composer with a stronger input outline stays at the bottom. Separators remain quiet but visible.

| Route | File | What you see |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing for the German automotive bearing scenario. A white SupplyOS logo and `Open chat` CTA link to `/chat`; no email field is shown |
| `/chat` | `components/cockpit/cockpit-chat.tsx` | Mock Session list, one CASE-001 rehearsal thread, and one fixed Candidate panel |

The target `/chat` composition is:

- **Sessions** — compact two-line mock Session links have no icon; the selected Session uses the accent background. Every selection opens the same fixture thread.
- **Main conversation** — top replay controls, status rail, concise agent turns, parallel Outreach Tasks, checks, and the final Decision bar.
- **Messaging** — the linked Incident is an inline primary-colour mention in the first user message; a bottom composer appends local prototype messages.
- **Incident header** — compact case context by default; expands to show plant, part, shortfall, line-stop, cost, and inventory properties with Tabler icons.
- **Candidate panel** — one fixed panel with stable multi-expand Candidate rows, Claim versus Supplier Record fields, evidence, and Landed Cost. It does not become a file browser or general result switcher.
- **Call modal** — a large transcript and Claim view addressed by `?call=<id>`. Closing it returns to the same thread state.
- **Decision bar** — compact at the thread end and expandable for Strategy, Landed Cost, policy checks, runner-ups, and rationale. Human approval happens here; approved is final.

Rehearsal data is scripted CASE-001. No backend is required for this implementation. SQLite remains the intended operational datastore when persistence is added.

## Demo beats that must stay visible

1. The Incident connects the Munich and Stuttgart plants to the 6204-2RS bearing shortage.
2. Shenzhen is rejected by `blocked_origin_country`.
3. Munich Motion reports `in_stock_allocated`: in stock is not ours.
4. The cheapest unit price is not the Decision. The winning Strategy splits 20% SKF air and 80% FAG sea.
5. Policy and landed-cost checks pass before a human approves the Decision in SupplyOS.

## Design references (structure only)

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
- `app/globals.css` — colour tokens.
- `docs/agents/domain.md` — glossary guidance.
