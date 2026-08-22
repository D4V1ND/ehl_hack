# Stockout UI design

How the Cockpit looks, why, and what is still open. Use this as the baseline for `/grill-with-docs`. Product name on this surface is **Stockout**. Planning docs may still say SupplyGuard.

**IA:** ERP owns the live stock picture. Stockout owns the sourcing run. `/dashboard` is a case picker for the demo, not a second ERP incident console.

## Settled (do not reopen unless Lorenz says so)

1. Two routes: `/dashboard` (Incident list) and `/chat` (one case).
2. `/chat` is a split: conversation left, working object right.
3. Right pane tabs: **Files | Results**. Files = case artifacts. Results = call, Claim vs record, or PR.
4. Human approval is merging a GitHub PR. No in-app Approve button.
5. Skip Microsoft Copilot empty-chat. Skip incident.io as the primary surface.
6. Rehearsal by default. Phone numbers masked. Domain words only: Incident, Supplier Record, Claim, Candidate, Outreach Task, Landed Cost, Strategy, Decision.
7. Colours only from `app/globals.css`. Dark mode is the app default.
8. Build in the Next.js app. Do not design in Paper.

## Design references (Mobbin)

Steal structure, not chrome. All links are web.

| Steal | App | Use for | Skip |
|---|---|---|---|
| Split + PR as the finish | [Devin](https://mobbin.com/screens/1bee4b82-38f1-42a0-b500-aaf06efd2ea4) | Right pane as the working object. Decision = PR card, checks green, merge is approval | Todo-list product UI |
| Chat + deliverables | [WRITER](https://mobbin.com/flows/05b3c653-52ee-4323-8170-2cb7e314c0da) | Same split as Devin. Devin wins on visual density | Copilot empty greeting |
| Files in this task | [Manus](https://mobbin.com/screens/a6af52d3-15ee-4bb1-88e9-3059b9614c21) | Files tab: `sourcing_case.yaml`, `claims/*.json`, reports, `po_draft.md` | Browser/computer pane |
| Call transcript | [Lindy](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5) | Results while calling. AI disclosure first. Live checklist of asked fields | Agent-builder flow editor |
| Call status bar | [Grok Voice](https://mobbin.com/screens/8769afdd-9771-4073-a33e-69acf3019f0b) | Connected, timer, masked number, End | Empty call canvas |
| Claim strip | [Vapi](https://mobbin.com/screens/3cafda24-5720-467a-a94a-bfeeba0a6ed3) | Tiny strip only: price, stock_status, cert filling in | Full latency dashboard |
| Checklist + tests | [Cursor](https://mobbin.com/screens/d744068a-1835-4c35-afa2-e560ccbe565d) | Stage checklist on Files. pytest green on the PR card | IDE clone |

**Rejected:** Microsoft Copilot Deep Research (empty-chat spine). incident.io (ERP already shows the shortage). SaaS pricing tables (not Claim vs record).

## Current structure in the app

Chrome: `CockpitShell` — Stockout, Dashboard / Chat, rehearsal, Munich plant.

| Route | File | What you see |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing. CTA goes to `/dashboard` |
| `/dashboard` | `app/dashboard/page.tsx` | Incident list. CASE-001 opens `/chat`. Other rows are fixtures |
| `/chat` | `components/cockpit/cockpit-chat.tsx` | CASE-001 strip. Split is a CSS grid (`~1.15fr` chat / `1fr` working pane) so both columns share the window width. Left: ERP Incident chip + Devin turns. Right: `WorkingPane` |

Right pane (`components/cockpit/working-pane.tsx`):

- **Files** — artifacts appear as the script reaches them (`lib/case-001.ts` `CASE_FILES`). Stage checklist: part, stock, candidates, calls, decision.
- **Results** — empty → live call (SKF, then Munich Motion) → Claim vs record + Landed Cost → PR card (merge is approval).
- Tabs follow the run until the user pins one.

Rehearsal data: `lib/case-001.ts`. Scripted CASE-001. No backend required.

Throwaway wireframes (not a product route): `app/prototype/cockpit-screens.html`.

## Screen map (prototype → app)

From `app/prototype/cockpit-screens.html`, plus `/dashboard` which Lorenz added after that inventory.

| # | Screen | Right pane | Status |
|---|---|---|---|
| 0 | `/dashboard` Incident list | n/a | In app. CASE-001 is the only live row |
| 1 | Opened from ERP / launch | Files empty | Left done: compact Incident chip from ERP, Launch in composer. Right still empty Files |
| 2 | Agent working | Files filling + stage checklist | In app. Files fill. Checklist: part / stock / candidates / calls / decision |
| 3 | Live call SKF | Lindy transcript + Grok bar + Claim strip | In app. Outreach → SKF. Disclosure in SKF turns |
| 4 | Second call / allocated stock | Munich Motion, `in_stock_allocated` | In app. Claims → Munich Motion. Badge destructive on allocated |
| 5 | Claim vs record | Claim \| Supplier Record + Landed Cost | In app. Deltas, Landed Cost lines, recommended split highlighted |
| 6 | Decision + files | Artifacts + PR card, no Approve | In app. Branch, both suites pass, Open PR. Merge is approval |

## Demo beats that must stay visible

1. Shenzhen rejected by `blocked_origin_country`.
2. Munich Motion `in_stock_allocated` — in stock is not ours.
3. Cheapest unit price is not the Decision. Winning Strategy is split 20% SKF air + 80% FAG sea.
4. Both pytest suites green, then PR. Merge is approval.

## Open for `/grill-with-docs`

Do not treat these as settled.

1. How dense is Results vs the left thread? Claim vs record table stays on the right. The thread now uses one-sentence beats (allocated stock, split Strategy) instead of “see the Results tab”.
2. Does Files stay a list, or does clicking a file preview it?
3. Is `/dashboard` in the product after the jam, or demo-only?
4. Call UI: one live call at a time, or a stack of completed transcripts?
5. Visual finish: stay on current shadcn density, or push closer to Devin’s three-pane PR view?

## Pointers

- `docs/PLAN.md` Slice A — routes and A0–A6.
- `docs/specs/supplyguard-plan-1-foundation-spec.md` — Claim vs record, `stock_status`, safety.
- `app/globals.css` — colour tokens.
- `docs/agents/domain.md` — how to consume glossary files.
