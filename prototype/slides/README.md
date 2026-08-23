# Pitch slides

Challenge 2 · room palo · Sunday 12:30. **5 minutes pitch + demo, 3 minutes jury
questions.** Rules: keep it short and simple, and only slides submitted on
ehl.gg may be used on stage.

That last rule is the one that shapes the deck: there is no alt-tabbing to a
laptop. The demo has to live inside the slides — a recorded walkthrough, with
still screenshots on the same slide as a fallback if the platform strips media.
The one thing that legitimately happens off-slides is the phone: it rings in the
room while a slide holds the frame.

## Versions

One directory per version. Each is a self-contained, submittable deck.

| | |
|---|---|
| [`v1-problem-first/`](v1-problem-first/) | The one we are pitching. Problem → solution → demo → vision → market → ask. |

Shared images live in [`assets/`](assets/). Backup slides for the question round
are at the end of each deck, after the closing slide, and are not counted
against the five minutes.

## Building

The decks are [Marp](https://marp.app) Markdown. The exported PDF is committed
next to the source, so reviewing a deck needs nothing installed:

```bash
npx --yes @marp-team/marp-cli@4 prototype/slides/v1-problem-first/deck.md \
  --allow-local-files -o prototype/slides/v1-problem-first/deck.pdf
```

Swap `-o …pdf` for `--pptx` if ehl.gg turns out to want PowerPoint — PDF cannot
play an embedded video, PPTX can, and which one we submit decides whether slide
4 is a video or an animated still. Check the upload page before exporting.

`--preview` or `-s` (server mode) renders the deck in a browser while editing.

## Timing

Five minutes is the whole budget, including the demo. Rehearse against a clock;
the recorded walkthrough is the only fixed-length piece, everything else
compresses.

| Slide | Target | Cumulative |
|---|---|---|
| 1 Hook | 0:30 | 0:30 |
| 2 Problem | 0:45 | 1:15 |
| 3 Solution | 0:30 | 1:45 |
| 4 Demo + live call | 1:45 | 3:30 |
| 5 Vision | 0:25 | 3:55 |
| 6 Market | 0:30 | 4:25 |
| 7 Ask | 0:25 | 4:50 |

## The live call

Per [`docs/demo-run-sheet.md`](../../docs/demo-run-sheet.md), CALL-E took **~18
minutes** to return a result in rehearsal. So the live moment is the ring and
the first seconds of the conversation — the disclosure and the must-asks — and
nothing downstream of it is on the critical path. The re-priced plan the call
produces is in the recording, already rendered.

Numbers to fix before submitting: the line-stop cost per hour and the day count.
They appear on slide 1, slide 2 and inside the recording, and they have to be
the same number in all three.
