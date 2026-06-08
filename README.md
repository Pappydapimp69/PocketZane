# AGAIN

A noir cross-examination. A suspect sits across the desk and tells you his
story. The truth holds still — but **a lie cannot tell itself the same way
twice**. Make him tell it again; pin what moves; then take his alibi apart at
the confrontation, where one lie is always holding up another.

Built in **Phaser 3 + TypeScript + Vite**. Every asset — the suspect's face, the
crime-scene photo, the room tone, the rain, every sound — is **generated at
runtime from a seed**. There are no image or audio files in this repo.

## Run

```bash
npm install
npm run dev
```

## How it plays

It runs in two acts.

**The questioning.** He gives his account a point at a time. **QUESTION** a line
to make him say it again — a lie shifts, the truth doesn't move. **PIN** a line
you've caught shifting and it becomes a *lead*. Pin the truth and that's a
strike against your patience; run out and he closes that point — but you keep
the leads you have, and a failed point is still recoverable.

**The confrontation.** He gives you the whole alibi at once. **PRESS** him with a
lead. A head-on hit only *deflects*: the lie hides behind a supporting lie, so
you have to break the prop first, then the lie above it — bottom-up. And some
cases hide a **keystone**: a bluff with no floor of its own that everything else
leans on. Find its seam and the whole story caves at once.

Every break is scored against the solver's **par**, so a case is worth running
again to break it tighter.

## What's generated

From a single seed, deterministically:

- **The case** — premise, place, victim, the suspect's name, role, and
  temperament; his alibi, every supporting lie, the motive, and the generative
  phrasing for his claims, his shifting tellings, and the excuses he deflects
  with (a lie never deflects the same way twice).
- **The suspect** — a procedural noir portrait that reacts: it averts its eyes
  when it deflects, sweats under pressure, and slumps when the story breaks.
- **The scene** — the rain-soaked stairwell where he was found, drawn for the file.
- **The sound** — an evolving minor-key ambience, the SFX, and a seeded vocal
  "tell" so each suspect mutters a little like himself.

Every generated case is run through a **solvability verifier** before you ever
see it; unsolvable rewrites are reseeded, so a case is always winnable.

## Modes

- **today's subject** — a daily case from a calendar seed; the same for everyone.
- **sit down** — a fresh, randomly seeded case every time.
- **an endless night** — cases that deepen night over night (wider webs, then
  propped supports, then keystone-prone). You carry three marks of standing:
  break a case at or under par and you keep it, break it sloppily and you lose
  one. Run out and the night beats you — how deep you reached is the score.
- **two detectives — versus** — hot-seat: both play the *same* case; fewer moves
  takes it.
- **partners — co-op** — one shared case, control passing back and forth.
- **cold files** — six curated fixed cases to chase a personal best.
- **the record** — rank, breaks, deepest night, and your bests.

Settings cover **difficulty** (his patience), **weirdness** (how strange the
nights run, and how often a case hides a keystone bluff), **narration**,
**reduce motion**, and **sound**.

## Verify

The engine is covered by headless tests — the web, the merged loop, the
solvability verifier, the generator, the keystone cascade, the difficulty
ladder, and the generative phrasing/content:

```bash
npx tsx scripts/test-web.ts
npx tsx scripts/test-merged.ts
npx tsx scripts/test-verify.ts
npx tsx scripts/test-generate.ts
npx tsx scripts/test-keystone.ts
npx tsx scripts/test-merged-gen.ts
npx tsx scripts/test-ladder.ts
npx tsx scripts/test-content.ts
npx tsx scripts/test-phrasing.ts
npm run build            # type-check + production build
```

## Controls

Touch, gamepad, and keyboard throughout. In a case: **A / Enter** question or
press, **X** pin or open the file, **Y** the file, arrows to choose a line.
