# Pitch slides

SupplyOS. Challenge 2, room palo, Sunday 12:30. **5 minutes pitch and demo, 3
minutes jury questions.** The rules: keep it short and simple, and only slides
submitted on ehl.gg may be used on stage.

That last rule shapes the deck. There is no alt-tabbing to a laptop, so the demo
has to live inside the slides as a recorded walkthrough, with a still on the same
slide in case the platform strips media. The phone is the one thing that happens
off the slides: it rings in the room while a slide holds the frame.

## Versions

One directory per version, each a self-contained submittable deck.

| | |
|---|---|
| [`v1-problem-first/`](v1-problem-first/) | The one we are pitching. Problem, solution, demo, vision, market, close. |

Shared images live in [`assets/`](assets/).

## Building

The decks are [Marp](https://marp.app) Markdown. The exported PDF is committed
next to the source, so reviewing a deck needs nothing installed:

```bash
npx --yes @marp-team/marp-cli@4 prototype/slides/v1-problem-first/deck.md \
  --allow-local-files -o prototype/slides/v1-problem-first/deck.pdf
```

Swap `-o …pdf` for `--pptx` if ehl.gg wants PowerPoint. PDF cannot play an
embedded video and PPTX can, so the upload page decides whether slide 5 holds a
video or a still frame. Check it before exporting.

`--preview` opens the deck in a window while editing, `-s` serves it in a
browser. Speaker notes are the HTML comments in the Markdown, and Marp's
presenter view shows them.

## Assets

`assets/hero.png` is the SupplyOS landing page from `apps/web`, screenshotted at
1600x1000 and cropped to hide the Next dev indicator:

```bash
cd apps/web && npx next dev -p 3100
google-chrome --headless=new --hide-scrollbars --window-size=1600,1000 \
  --screenshot=hero.png http://localhost:3100
```

`assets/demo.png` is a placeholder for the demo slide and still comes from the
old `ui/` cockpit. Replace it with a frame from the recording of `apps/web`.

## Timing

| Slide | Target | Cumulative |
|---|---|---|
| 1 Hook | 0:30 | 0:30 |
| 2 What a shortage costs | 0:45 | 1:15 |
| 3 The plan nobody computes | 0:15 | 1:30 |
| 4 What the agent does | 0:30 | 2:00 |
| 5 Demo and live call | 1:45 | 3:45 |
| 6 Vision | 0:25 | 4:10 |
| 7 How we get there | 0:30 | 4:40 |
| 8 Close | 0:20 | 5:00 |

## The live call

Per [`docs/demo-run-sheet.md`](../../docs/demo-run-sheet.md), CALL-E took about
18 minutes to return a result in rehearsal. The live moment is therefore the ring
and the first seconds of the conversation, the disclosure and the questions, with
nothing downstream of it on the critical path. The re-priced plan the call
produces is already rendered in the recording.

## Before submitting

- Fix the numbers. €18,400 an hour and 12 days appear on slides 1 and 2 and
  inside the recording, and they have to match.
- Write the ask on the closing slide.
- Replace `assets/demo.png` with the recording, or a frame from it.

## Writing style

Copy in these decks follows two references, both worth reading before editing
the Markdown:

- [`.agents/skills/voice-dna/SKILL.md`](../../.agents/skills/voice-dna/SKILL.md)
- [ai-writing-forbidden-patterns](https://github.com/sheryldeakin/write-like-me/blob/main/reference/ai-writing-forbidden-patterns.md)

No em dashes anywhere.
