# Stockout UI design

How the approved Cockpit looks and behaves. Product name on this surface is **Stockout**. Planning documents may still say SupplyGuard.

**Scenario:** Stockout supports a German automotive manufacturer resolving a bearing shortage across its Munich and Stuttgart plants. ERP owns the live stock picture. Stockout owns one sourcing run at `/chat`.

## Settled (do not reopen unless Lorenz says so)

1. The product has one Cockpit route: `/chat`. The landing CTA opens it directly. There is no `/dashboard` route or Dashboard navigation.
2. `/chat` has the main conversation and one fixed **Candidate** panel. It has no file tree and no **Files | Results** tabs.
3. Candidate cards in the conversation are compact and stable. More than one card can stay expanded.
4. Outreach Tasks run in parallel. Call details open as a large modal through `?call=<id>`.
5. The status rail lives in the main conversation. A compact expandable **Decision** bar appears at the thread end.
6. The agent recommends. A human marks the Decision approved in Stockout. **Approved** is the final state. There is no PR card or merge approval.
7. Rehearsal is the default. Phone numbers are masked. Claims remain distinct from trusted Supplier Records.
8. SQLite is the intended operational datastore. This implementation remains fixture-driven. Supabase is explicitly ignored.
9. Colours come only from `app/globals.css`. Dark mode is the app default. Build in Next.js; do not use Paper and do not add a route.

## Approved screen structure

Chrome: `CockpitShell` — Stockout, Sourcing run, rehearsal, Munich + Stuttgart plants, bearings. No Dashboard link.

| Route | File | What you see |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing for the German automotive bearing scenario. CTA goes to `/chat` |
| `/chat` | `components/cockpit/cockpit-chat.tsx` | One CASE-001 rehearsal thread and one fixed Candidate panel |

The target `/chat` composition is:

- **Main conversation** — Incident context, status rail, agent turns, stable multi-expand Candidate cards, parallel Outreach Tasks, Claims, checks, and the final Decision bar.
- **Candidate panel** — one fixed panel for the selected Candidate. It does not become a file browser or general result switcher.
- **Call modal** — a large transcript and Claim view addressed by `?call=<id>`. Closing it returns to the same thread state.
- **Decision bar** — compact at the thread end and expandable for Strategy, Landed Cost, policy checks, runner-ups, and rationale. Human approval happens here; approved is final.

Rehearsal data is scripted CASE-001. No backend is required for this implementation. SQLite remains the intended operational datastore when persistence is added.

## Demo beats that must stay visible

1. The Incident connects the Munich and Stuttgart plants to the 6204-2RS bearing shortage.
2. Shenzhen is rejected by `blocked_origin_country`.
3. Munich Motion reports `in_stock_allocated`: in stock is not ours.
4. The cheapest unit price is not the Decision. The winning Strategy splits 20% SKF air and 80% FAG sea.
5. Policy and landed-cost checks pass before a human approves the Decision in Stockout.

## Design references (structure only)

- Devin and WRITER: dense conversation plus a stable working panel; do not copy PR or file chrome.
- Lindy and Grok Voice: large call transcript, connected state, masked number, and structured Claim progress.
- Cursor: compact visible checks; do not copy IDE or repository UI.

Mobbin references:

- [Devin](https://mobbin.com/screens/1bee4b82-38f1-42a0-b500-aaf06efd2ea4)
- [WRITER](https://mobbin.com/flows/05b3c653-52ee-4323-8170-2cb7e314c0da)
- [Manus](https://mobbin.com/screens/a6af52d3-15ee-4bb1-88e9-3059b9614c21)
- [Lindy](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5)
- [Grok Voice](https://mobbin.com/screens/8769afdd-9771-4073-a33e-69acf3019f0b)
- [Vapi](https://mobbin.com/screens/3cafda24-5720-467a-a94a-bfeeba0a6ed3)
- [Cursor](https://mobbin.com/screens/d744068a-1835-4c35-afa2-e560ccbe565d)

**Rejected:** Microsoft Copilot empty-chat, incident.io as the primary surface, dashboards, file trees, Files/Results tabs, PR cards, merge approval, and Paper.

## Open questions

The route, panel model, card expansion, parallel outreach, call modal, status rail, Decision bar, and approval state are settled. Open questions are limited to visual tuning:

1. How dense should the Candidate panel be at narrow desktop widths?
2. Which Candidate fields stay visible when a card is collapsed?
3. How much transcript context should the call modal show before scrolling?
4. Which Decision summary fields stay visible while its bar is collapsed?

## Pointers

- `docs/PLAN.md` Slice A — approved Cockpit behavior.
- `docs/specs/supplyguard-plan-1-foundation-spec.md` — Claim versus record, `stock_status`, and safety.
- `app/globals.css` — colour tokens.
- `docs/agents/domain.md` — glossary guidance.
