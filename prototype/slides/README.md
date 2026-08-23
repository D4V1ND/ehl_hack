# Pitch decks

Plain HTML decks. No build step, no CDN, no framework — a deck has to open from a
laptop in a room with bad wifi, and it has to print to a PDF because
**only slides submitted on ehl.gg may be used on stage**.

```
prototype/slides/
  index.html            version chooser + the hackathon's pitch rules
  shared/deck.css       one stylesheet; tokens are DESIGN.md's, so slides and cockpit match
  shared/deck.js        nav, speaker notes, slide grid, time budget, print layout
  assets/               screen recordings and screenshots (gitignored if large)
  v1-challenge-5min/    Sunday 12:30 — 5 min pitch + 3 min jury questions
  v2-finals-short/      Sunday 14:15 — finals cut, demo first
```

## The structure, and why it is that order

The hackathon scores *solution → demo → proof*, so that spine is fixed in every version;
pitch framing wraps around it and nothing between the demo and the proof is allowed to
compete with the live call.

| # | v1 slide | s |
|---|---|---|
| 1 | Title — the one-liner. **The live call is already dialling** | 12 |
| 2 | Problem — a shortage as the ERP sees it | 30 |
| 3 | Solution — the decision is code | 35 |
| 4 | How it works — detect · screen · call · cost · publish | 28 |
| 5 | Demo, recorded — shortage to pull request | 55 |
| 6 | Demo, live — the supplier we left uncalled | 55 |
| 7 | Proof — tests, adapters, sub-second run, zero orders | 30 |
| 8 | Vision + who buys it | 30 |
| 9 | How we continue + the ask | 20 |
| 10 | Close | 5 |
| | **total** | **300** |
| 11–14 | appendix: real vs seeded · safety rails · market + pricing · real ERP | 0 |

Rules the order encodes:

- **Dial before slide 1.** CALL-E took ~18 minutes to return a structured result in rehearsal,
  so the phone rings through problem and solution and the re-price is never the finale.
- **No slide spoils the demo.** The live-call slide says what to watch, never which plan wins.
- **Nothing undefendable on stage.** Q&A is 3 of the 8 minutes; sizing and anything else we
  cannot source sits in the appendix, at `data-seconds="0"`, marked *backup* in the grid.

Open `prototype/slides/index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8080 --directory prototype/slides   # → http://localhost:8080
```

## Driving a deck

| key | |
|---|---|
| `→` `←` `space` | navigate |
| `n` | speaker notes (what to say, and the traps) |
| `o` | slide grid |
| `t` / `r` | start-stop / reset the clock, measured against the deck's `data-budget` |
| `f` | fullscreen |
| `p` | print → PDF |
| digits + `enter` | jump to a slide |

The presenter bar and the notes panel live outside the 1280×720 slide frame, so they
are never in the PDF and never on the projector.

## Exporting for ehl.gg

`p` → *Save as PDF* · landscape · margins **none** · background graphics **on**.
Each slide is exactly 1280×720 and gets its own page.

## Adding a version

Copy a version directory, edit the slides. The contract the engine expects:

```html
<div class="deck" data-deck="v3 · investor · 10 min" data-budget="600">
  <section class="slide" data-title="Problem" data-seconds="40" data-bg="soft">
    …
    <aside class="note">what to say out loud</aside>
  </section>
</div>
```

- `data-budget` — seconds; the clock turns amber at 80% and red past it.
- `data-seconds` — per-slide plan, shown in the grid. Keep the sum under the budget.
- `data-bg` — `soft` or `dark`; omit for the default canvas.
- `data-chrome="off"` — hides the slide footer, for title and closing slides.
- `data-appendix` — backup slide for Q&A: dashed in the grid, footer reads *appendix*, and it is
  planned at `data-seconds="0"` so it never eats the budget.
- `.note` — never rendered on the slide; it is the speaker-notes panel.

Then add the version to `index.html`.

Layout helpers live in `shared/deck.css`: `.cols-2 .cols-3 .cols-4 .cols-2-1 .cols-1-2`,
`.card`, `.card.accent`, `.pipeline` + `.step[data-stage=detect|read|call|cost|decide]`,
`.timeline`, `.term`, `.shot`, `.tag`, `.big` + `.metric-label`, `tr.win`.

## Content rules for this deck

- The judging criteria are **solution → demo → proof** ("building a convincing winning pitch"
  in the kick-off deck). Every version keeps that order.
- Numbers on the proof slide come from the repo (`python run.py test`, the two ERP adapters
  behind one suite, the sub-second flow run). If a number stops being true, change the slide.
- Sizing is an appendix slide with an explicit `TODO`, never a stage slide. Source it or delete
  it — do not put a TAM on stage that we cannot defend in the 3 minutes of jury questions.
- The demo slot is a recorded walkthrough plus one live call, because a real Devin session
  takes tens of minutes and CALL-E has taken ~18 minutes to return a structured result in
  rehearsal. The live re-price is never the finale; see `docs/demo-run-sheet.md`.

## Assets

Drop the walkthrough recording at `assets/walkthrough.mp4` and replace the placeholder
`.shot` block on the demo slide with:

```html
<div class="shot"><video src="../assets/walkthrough.mp4" controls muted playsinline></video></div>
```
