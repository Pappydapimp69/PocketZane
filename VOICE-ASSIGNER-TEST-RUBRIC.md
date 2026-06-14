# Voice Assigner — self-grading rubric

The script runs as a **sequential pipeline**. A failure at stage N usually
starves every stage after it, so grading is: **find the first stage that isn't a
clean Pass — that's the real fault; everything downstream is collateral.**

Each run, the popup's **Debug tab** holds a structured `report` + log. After a
run: **Verify now → Copy debug → paste it back.** The fields named below live in
that report, so we grade from evidence, not vibes.

Scoring per stage: **Pass (1) / Partial (0.5) / Fail (0)**. Overall isn't a sum —
it's "lowest failing stage" + what that teaches.

---

## Stages

### S1 — Launcher present
- **Pass:** "🎙 Voices" button shows on `/app/studio/*`; popup opens.
- **Signal:** visual.
- **Fail teaches:** `@match`/injection/SPA-timing issue → revisit `injectLauncher` interval or match glob.

### S2 — Parse
- **Pass:** `report.parse.roles` = # header lines; `report.parse.paragraphs` = # body paragraphs; `report.resolve` lists every role with the intended voice.
- **Fail modes → lever:**
  - wrong paragraph count → `CONFIG.paragraphSplit` (`line` vs `blank`) or the label regex in `stripLeadingLabel`.
  - role/voice split wrong → header grammar / first-comma split.

### S3 — Insert + node creation  *(new-project stressor)*
- **Pass:** `report.insert.nodesAfter` ≈ `planLength`; `countsMatch:true`; labels + header gone from the editor.
- **Fail modes → lever:**
  - `nodesAfter === nodesBefore` (nothing inserted) → synthetic-paste path; check `report.insert.nodesBefore`, try the `execCommand` fallback, or the editor needs a real focus/caret first (likely in an **empty new project**).
  - `nodesAfter !== planLength` (off-by-N) → paste-split boundary mismatch; align join char + `paragraphSplit`.

### S4 — Voice discovery  *(new-project stressor)*
- **Pass:** `report.voices.seed` lists the project's voices; if needed, `report.voices.scraped` lists picker voices.
- **Fail modes → lever:**
  - `seed: []` on a fresh project (no nodes had voices yet) — expected; we must rely on scrape.
  - `scraped: []` → the picker selectors (`CONFIG.pickerContainerSelectors` / `pickerRowSelectors`) don't match → **use "Snapshot picker DOM"**, send me the markup, I fix selectors.
  - voices aren't in the project at all → the picker is probably a **searchable library** ("explore" submenu); we may need to type into a search box and/or click an "Add/Use" affordance, not just click a row. This is the #1 thing the new-project test will teach us.

### S5 — Resolution (name → real voice)
- **Pass:** every `report.resolve[*].resolvedTo` is non-null (or intentionally null for a no-voice role headed to fixup).
- **Fail modes → lever:**
  - `needsFix:true, reason none` → name typo or voice simply absent → fixup or add-to-project.
  - `ambiguous` → tighten matching / fuller names.

### S6 — Fixup prompt (roles w/o voice, e.g. `narrator`)
- **Pass:** one prompt **per title** (grouped), dropdown populated from discovered voices; choosing fills `report.labelVoice`.
- **Fail teaches:** dropdown empty ⇐ S4 failed (no voices to offer).

### S7 — Multi-select
- **Pass:** `report.verify.perGroup[*].uniform === true` (all nodes in a group ended on one voice → they were selected together).
- **Fail modes → lever:**
  - group split across voices / only first node changed → synthetic ctrl/cmd-click isn't registering as additive select → adjust the event sequence/target in `realClick`, or the app keys off a different element.

### S8 — Picker opens during assign
- **Pass:** no `"picker did not open"` in the log; assign proceeds.
- **Fail → lever:** `voiceIndicatorSelector` wrong, or opening needs a different trigger (e.g. the "Select voice…" button) → snapshot + fix.

### S9 — Row match + click
- **Pass:** no `"could not find picker row for …"`; the clicked row matched the intended voice.
- **Fail → lever:** `scrapePickerRows` name extraction or `pickerRowSelectors` → snapshot fixes it; or row needs a different click target.

### S10 — Assignment correctness (the headline grade)
- **Pass:** `report.verify.score === "N/N"`, `distinctAcrossGroups:true`, no group `stillDefault:true`.
- **Partial:** some groups OK, others `stillDefault` or non-uniform → trace to S7/S8/S9.
- **Signal:** `report.verify.perGroup` (per voice: `uniform`, `voiceId`, `expectedId`, `matchesId`, `stillDefault`, `ok`).

### S11 — Persistence
- **Pass:** voices survive save/reload (manual check — not in report).
- **Fail teaches:** we drove a transient UI state, not the real control → the assign path isn't the one Studio persists.

---

## How to report a run
1. Debug tab → **Verify now** → **Copy debug** → paste here.
2. If anything past S3 looks off, also click **Snapshot picker DOM** first (so the
   picker markup is in the blob).
3. Tell me your one-line verdict (pass/fail + where) — the report fills in the why.

## Known new-project unknowns to watch (hypotheses to confirm/kill)
- **H1:** synthetic paste into an *empty* editor may need a prior click/caret. (S3)
- **H2:** the picker for unused/library voices is a **search box**, so click-by-name
  won't find a row until we type the query. (S4/S9)
- **H3:** using a never-used voice may require an explicit **Add/Use** step before it
  attaches to nodes. (S9/S10)
