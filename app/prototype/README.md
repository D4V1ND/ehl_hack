# Throwaway prototypes

This folder is **not** the product. These screens answer design questions before production work begins.

## How to open

Start the app, then open the beta website prototype:

```sh
npm run dev
```

`http://localhost:3000/prototype/website?variant=A`

Use the floating arrows or the left and right arrow keys to compare variants A–E.

The question: which single-screen beta layout best fits Stockout?

- A and B use `public/website/background-1.png`.
- C and D use `public/website/background-2.jpeg`.
- E uses `public/website/background-4.png` and develops B as the selected direction.
- All descriptions contain at most 16 words.
- The email fields are visual mocks and do not send data.

## Cockpit screen frames

Open the HTML file directly. No build step.

`app/prototype/cockpit-screens.html`

## Screens

1. **Opened from ERP** — right: empty file list (“No artifacts yet”).
2. **Agent working** — right: files filling in + stage checklist.
3. **Live call (Lindy + Grok)** — right: SKF transcript, status bar, Claim strip.
4. **Second call / allocated stock** — right: Munich Motion transcript (`in_stock_allocated`).
5. **Claim vs record** — right: Claim | Supplier Record + Landed Cost.
6. **Decision + files** — right: artifacts + PR card. No Approve button.

IA: ERP owns Incident. Stockout owns the sourcing run.
