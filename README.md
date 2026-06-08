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
- **v18** — **sound control**: all audio now routes through a master bus with a
  persisted mute toggle on the title — quiet room, your call.
- **v19** — **colorblind-safe marks**: caught (▲) and pinned (✕) lines now carry a
  glyph alongside the amber/crimson, so state reads without relying on hue.
- **v20** — **tenth-mark history re-read + asset review**: re-read the source notes
  for fresh directions (banked: subject *temperaments*, a Ship-of-Theseus case);
  end-screen overlays now keep the room's grain and vignette with a dossier
  divider rule, and the selected line shows a pointer.
- **v21** — **subject temperaments**: every subject now has a personality
  (rattled, guarded, composed, ordinary) that tilts how readily lies slip, how
  much pressure helps, and how fast composure returns — shown as a first "read,"
  so different subjects want different approaches.
- **v22** — a sixth case, **The Same Man**: a Ship-of-Theseus interrogation where
  the lies are about identity itself — memory, promises, blame — and only the
  name and the body hold still. The new finale of the arc.
- **v23** — **fully navigable title menu** by gamepad and keyboard: a moving focus
  highlight with d-pad/arrows and select on A/Enter — no touch required to choose
  a mode.
- **v24** — **Case Files**: a revisit screen to replay any reached story case and
  chase a better best-telling count, with later cases sealed until you reach them.
- **v25** — **asset review pass** (every-fifth): soft camera fade-ins on every
  scene transition and a faint rule separating header from testimony — quieter,
  more composed motion between rooms.
- **v26** — **today's subject**: a seeded daily challenge — the same procedurally
  generated subject (and the same slips) for everyone until midnight, with a best
  saved per day. Backed by a small reproducible PRNG.
- **v27** — **share the daily**: a spoiler-free "copy result" on the daily end
  screen (date + tellings + strikes), so the shared puzzle is actually shareable.
- **v28** — **onboarding**: a "how it works" panel (again / press / pin, strikes,
  pressure) reachable from the title and shown once automatically on first launch.
- **v29** — **the ledger, browsable**: open an in-interrogation ledger (≡ / L /
  shoulder button) listing every line you've caught and the phrasings heard —
  the longitudinal record, on demand, for the heavier cases.
- **v30** — **tenth-mark history re-read + asset review**: re-read the source notes
  (banked: a "deflation" reaction to pressing the truth; a Babylon "instructions
  outlive authority" case). Asset/UX pass: buttons now warm on hover/focus.
- **v31** — **deflation**: lean on a true line more than once and the subject pushes
  back ("there's nothing there — you're hearing what you want"), nudging you off
  patterns you're projecting onto noise.
- **v32** — **deeper testimony pool**: the procedural generator gains a batch of new
  claims and truths (a note, a changed will, a safe, a fire, a moved car), so
  endless / daily / multiplayer subjects repeat themselves far less.
- **v33** — **detective rank**: a persistent rank (Rookie → Detective → Inspector →
  Closer → The Confessor) that climbs with every story you break, in any mode,
  shown on the title — long-term progression across sittings.
- **v34** — **endless boss nights**: every fifth night of the endless run is a
  harder, named "hard case," giving the survival grind a rhythm of escalating
  set-pieces instead of a flat ramp.
- **v35** — **asset review pass** (every-fifth): end screens now get a case-file
  stamp — a crimson **CLOSED** when you break it, a slate **WALKED** when they
  leave — slapped on at an angle with a little snap.
- **v36** — **reduce-motion option**: a persisted accessibility toggle that drops
  the screen shakes, flashes, flicker-shakes, and stamp snap (keeping the
  information, losing the jolt) for comfort and photosensitivity.
- **v37** — **named subjects**: procedural subjects now carry a name and a wider
  set of roles (bartender, landlord, the ex…), so the people across the table
  read as individuals instead of placeholders.
- **v38** — **press feedback**: a line you've leaned on shows small instability
  pips, so PRESS has a visible effect — you can see which lines are coming loose
  before you ask again.
- **v39** — **leave a case**: a "← leave" link (and Esc / Start) with a confirm,
  so you're no longer locked into an interrogation until it ends.
- **v40** — **tenth-mark history re-read + asset review**: re-read the notes
  (banked: a wry "confidence" readout). Added **narration** — an optional toggle
  that reads each resolution aloud via the browser's built-in speech synthesis
  (no files), nodding to the voice-as-instrument thread.
- **v41** — **the record**: a dossier screen collecting rank, total breaks, per-case
  bests, deepest endless night, and today's best — the optimizer's scoreboard in
  one place.
- **v42** — **difficulty**: a persisted Lenient / Standard / Relentless setting that
  shifts the strike allowance across every mode, for a gentler ride or a knife's
  edge.
- **v43** — **settings panel**: the scattered toggles (sound, motion, narration,
  difficulty) are consolidated behind one "settings ⚙" link, decluttering the
  title.
- **v44** — **clean breaks**: break a case with no strikes and at/under par and it's
  marked clean (✦ in Case Files, counted in the Record) — an aspirational target
  beyond simply closing it.
- **v45** — **asset review pass** (every-fifth): a soft "page" sound when panels
  open (ledger, settings, how-it-works) and a faint offset echo behind the title
  wordmark for depth.
- **v46** — **case intro card**: a brief, non-blocking title beat (case + subject)
  fades in as each subject sits down, giving every interrogation a small opening
  frame.
- **v47** — **deeper endless scaling**: past night six the generator leans toward
  harder temperaments (guarded / composed), so the late run keeps tightening
  instead of plateauing once the lie/pin counts cap.
- **v48** — **pin juice**: the line you pin gives a quick confirming pulse (paired
  with the existing lamp flicker and strike sound), so landing a contradiction
  lands physically too. Respects reduce-motion.
- **v49** — **gentle nudge**: if a telling holds while you're sitting on lines you've
  already caught but not pinned, the status quietly points it out — help without
  hand-holding.
- **v50** — **history re-read + asset review** (double milestone): banked the
  confidence-quirk idea and shipped it — a wry "confidence" line on each break
  ("airtight" on a clean one, "it stopped agreeing with itself" otherwise). Asset
  pass: the lamp glow now lights the Case Files and Record screens too.
- **v51** — **fix the black screen**: a circular-import temporal-dead-zone bug
  (`CaseScene` used `GAME_WIDTH` from `config` at module top-level, before it was
  initialized) crashed the game on load. Moved the dimensions to a leaf module;
  verified in a real headless browser. Added a browser test harness.
- **v52** — **desktop fixes**: stopped the canvas being centered twice (off to the
  right); added a **fullscreen** toggle (title link + F key) for readable
  projector/desktop play; made the controller dismiss the how-it-works and
  settings panels (A/B/Start, Enter/Esc) instead of poking the menu behind them.
- **v53** — **flowing testimony + trigger controls**: the statements are no longer
  separate cards — the account now reads as one continuous paragraph, with each
  clause individually selectable; a slip flickers and re-flows in place, a caught
  clause is underlined inline, a pinned one struck through. PRESS → left trigger,
  PIN → right trigger, AGAIN → A, labeled on the buttons.
- **v54** — **generative music**: replaced the static drone with an evolving noir
  bed — a slow minor progression (Am – F – C – E) that actually moves, a sparse
  wandering melody on the A-minor scale stepping by small intervals, and a soft
  feedback-delay room for space. Still synthesized in code; still under the mute.
- **v55** — **the deduction redesign (beta vertical slice)**: a new engine where a
  case has a hidden truth and the subject holds a cover story that *rewrites
  itself* — present established evidence against a claim and it constructs a
  coherent alternate explanation (or breaks when cornered); question a thread to
  pull new evidence into your file. One fully-authored case with a real brief
  (who/what/where/why) and resolution, the question→present→corner loop, and a
  `weirdness` dial baked in for the future generator. Reachable from the
  "THE NEW CASE (beta)" title link; the existing game is untouched.
