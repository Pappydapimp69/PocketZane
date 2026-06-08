# AGAIN

A looping cross-examination. The subject tells their story; you ask them to tell
it **again**. The truth holds still. A lie cannot tell itself the same way twice
— so the details that flicker between tellings are the ones to pin.

Built in Phaser 3 + TypeScript + Vite. This is an **evolving** project: each
version may push the idea somewhere new. The mechanics stay honest — only one
real rule underneath, that lies don't repeat cleanly.

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npx tsx scripts/test-engine.ts   # every case winnable; the truth is never pinnable
npm run build                    # type-check + production build
```

## How it plays

- Read the statements. Tap **TELL ME AGAIN** to make the subject repeat.
- A line that **moves** between tellings has been caught (amber marker — your
  ledger remembers, even when theirs doesn't).
- Select a caught line and **PIN THE LIE**. Pin enough and the story breaks.
- Pin a line that never moved and you've accused the truth — that costs a strike.

## Versions

- **v1** — the core loop: one case, tell-again, catch the flicker, pin, break.
- **v2** — **PRESS** a line to destabilize it (agency over the loop), a **pressure**
  track as composure gives way, a second case, and the **ledger**: at the break,
  the subject's own words are quoted back, contradiction by contradiction.
- **v3** — a title screen, a **recovery** mechanic (lean too hard and the subject
  steadies, resetting the instability you'd built — so timing matters), and a
  third case that starts bending toward the strange.
