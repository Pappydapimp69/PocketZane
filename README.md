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
- **v6** — **evidence**: lean hard enough on a line with a hard fact behind it and
  the proof surfaces, making that lie pinnable on the spot — a deterministic
  second route to the truth alongside catching the flicker.
- **v7** — **persistence + a room that reacts**: broken stories are remembered
  (the title tracks how many), and the overhead lamp breathes with the pressure —
  brightening, reddening, flickering when a pin lands.
- **v8** — a fourth case that breaks the frame: the thing across the table isn't a
  person. It claims it cannot contradict itself — and proving it can is the point.
- **v9** — the subject gets **presence**: varied, characterful "tells" replace
  fixed status text for every action, and the subject is named in the header.
- **v10** — **asset review pass** (every-fifth): film grain now drifts and breathes,
  dust motes turn over in the lamp's cone, and statement cards carry a soft
  top-lit gradient for depth. New generated `mote` texture; all still code-only.
- **v11** — **the change made legible**: when a line slips, a fading echo of what
  it said *a moment ago* rises off the card, so you can read the contradiction in
  the instant it happens instead of trusting your memory.
- **v12** — **a verdict**: each break is scored on tellings used and strikes taken,
  with a per-case best saved — an optimization layer for breaking a story clean
  and fast, not just breaking it.
- **v13** — a fifth and final case that turns the lamp around: the account on the
  table is *yours*, and it won't hold still either. The climax of the arc.
- **v14** — **an endless night**: a second mode that procedurally assembles cases
  from a pool of claims, ratcheting difficulty (more lies, fewer strikes) each
  night, until you accuse the truth one too many times. The title tracks how deep
  you got.
- **v15** — **asset review pass** (every-fifth): a crimson tension vignette closes
  in as pressure climbs, a single heartbeat thumps the moment the room tips into
  HIGH, and the title lamp breathes. New generated `heart` sound.
- **v16** — **multiplayer: Two Detectives** — local hot-seat versus. Players
  alternate turns on one shared subject; pins are credited to whoever lands them,
  and the most pins when the story breaks wins (accuse the truth and you may hand
  it to your rival).
- **v17** — **multiplayer: Partners (co-op)** — the second option: two heads
  against one deliberately hard procedural subject, breaking it together, sharing
  the win or the walk.
