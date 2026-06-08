# AGAIN

A looping cross-examination. The subject tells their story; you ask them to tell
it **again**. The truth holds still. A lie cannot tell itself the same way twice
— so the details that flicker between tellings are the ones to pin.

Built in Phaser 3 + TypeScript + Vite. This is an **evolving** project: each
version may push the idea somewhere new. The mechanics stay honest — only one
real rule underneath, that lies don't repeat cleanly.

Every asset — art and sound — is generated at runtime in code. No image or audio
files: the grain, the lamp glow, the vignette, the room tone, and every SFX are
synthesized from scratch.

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

- Read the statements. Hit **AGAIN** to make the subject repeat.
- A line that **moves** between tellings has been caught (amber marker — your
  ledger remembers, even when theirs doesn't).
- Select a caught line and **PIN** it. Pin enough and the story breaks.
- Pin a line that never moved and you've accused the truth — that costs a strike.
- **PRESS** a line to make it slip harder next time — but watch the pressure
  bar; max it out and the subject steadies, undoing your work.

## Controls

Touch, gamepad, and keyboard are all supported.

| Action            | Touch            | Gamepad         | Keyboard      |
| ----------------- | ---------------- | --------------- | ------------- |
| Move selection    | tap a line       | D-pad / L-stick | ↑ / ↓         |
| Tell me again     | AGAIN            | A / cross       | Enter / Space |
| Press the line    | PRESS            | X / square      | P             |
| Pin the lie       | PIN              | Y / triangle    | K             |
| Continue (at end) | tap the button   | A / cross       | Enter         |

## Versions

- **v1** — the core loop: one case, tell-again, catch the flicker, pin, break.
- **v2** — **PRESS** a line to destabilize it (agency over the loop), a **pressure**
  track as composure gives way, a second case, and the **ledger**: at the break,
  the subject's own words are quoted back, contradiction by contradiction.
- **v3** — a title screen, a **recovery** mechanic (lean too hard and the subject
  steadies, resetting the instability you'd built — so timing matters), and a
  third case that starts bending toward the strange.
- **v4** — full **gamepad** support (and keyboard): navigate statements with the
  d-pad / stick, act with the face buttons, confirm endings without touching the
  screen.
- **v5** — **atmosphere + asset pass** (the every-fifth-version review): all art
  and audio generated in code — paper grain, an overhead interrogation-lamp glow,
  an edge vignette, a low room tone, and a woody knock under *again*/*pin*. The
  game now lives at the repo root.
