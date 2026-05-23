# Signal — Claude.ai Artifact (v3.2-kernel)

A prompt-first journal. Zane asks; you answer. He doesn't always reply, and that's the point. Sometimes he questions himself out loud — testing whether a pattern is real or whether he planted it.

## How to use

1. Open https://claude.ai, start a new chat, ask Claude to create a React artifact, paste the contents of `signal.tsx` as the implementation.
2. The first screen introduces Zane. Tap **Begin**.
3. Answer the prompt at the top. A new one loads when you're done. Skip with "not this one".
4. Sometimes Zane will reply to your answer with one short observation. Sometimes he won't. Most of the time he stores it and waits.
5. When he names a feeling or motive ("you sound angry"), tap **correct** to push back. That correction becomes ground truth and also lowers confidence on observations from that entry.
6. Rare insight cards appear when patterns clear a hard bar. Mark **Wrong** or **Boring** to dismiss; **Save** to keep; **Accurate** or **Important** to endorse (which lifts supporting observations toward `integrated`).
7. Occasionally Zane will surface a different card: a **provenance challenge** — "I may have led this. Retire until you bring it up unprompted?" Retire or Keep. He'll do this at most once per session.

## Architecture — the v3.2-kernel layers

Three layers between input and output, plus a thin disclosure cross-cut:

| Layer | What it does |
|---|---|
| **Extraction** | Structured fields from each entry: themes, entities, emotions, behaviors, verbatim phrases (unchanged from v2) |
| **Provenance** | EvidenceLineageLog tracks every observation with `patternConfidence`, `attributionConfidence`, `inductionRisk`, `independenceScore`, and a `confidenceState` from `induced` → `convergence-validated` → `provenance-cleared` → `integrated` (or `retired`) |
| **Inference** | Composition rule routes insight candidates by `(patternConfidence × inductionRisk)`: standard insight, insight with provenance line, DEFLATIONARY queue, or suppress |
| **Disclosure** | Silent by default. Rare provenance lines on insights. Rate-limited challenges. ≤1 per 4 insights gets a line; "I may have helped shape this" ≤1 per 7 days |

### Prompt intent classes (six)

`OPEN`, `POINTED`, `PIVOT`, `CALLBACK`, `DEFLATIONARY`, `SYNTHESIS`. Density (`SHARP | SPARSE | NEUTRAL | CURIOUS`) is a separate voice axis. `sourceMode` (`free | prompt | callback`) is recorded on each observation, not the prompt.

`DEFLATIONARY` rate: floor ≥1 per 20 prompts, ceiling ≤1 per 4. `SYNTHESIS` fires after 3 consecutive `DEFLATIONARY` in any 10-prompt window, or after high-friction correction loops.

### Over-analysis protection (hard invariants)

- Provenance lines on insights: ≤1 per 4 insights
- DEFLATIONARY prompts: floor ≥1 per 20, ceiling ≤1 per 4
- "I may have helped shape this" copy: ≤1 per 7-day window
- Provenance challenges: ≤1 surfaced per session
- After 3 consecutive DEFLATIONARY in a 10-prompt window: next prompt is forced SYNTHESIS

The asymmetry principle: the user should feel observed by something thoughtful, not processed by an instrumentation engine. The machinery disappears behind the persona.

## Multi-file dev workflow

The canonical artifact for paste is `signal.tsx`. It is **generated** from fragments under `src/` by `build.mjs`.

```
artifact/
  src/
    01-core.tsx        storage, utilities, callClaude
    02-voice.tsx       anti-cleverness, exemplars, intent classes, seed prompts
    03-lineage.tsx     EvidenceLineageLog operations
    04-provenance.tsx  confidence scoring + state machine + event deflation
    05-disclosure.tsx  composition rule + disclosure policy + state engine
    06-llm.tsx         all generation functions including DEFLATIONARY + SYNTHESIS
    07-ui.tsx          React components (Pill through SettingsScreen)
    08-app.tsx         SignalApp, handlers, ErrorBoundary, default export
  build.mjs            concatenates fragments → signal.tsx
  signal.tsx           generated bundle (paste this into claude.ai)
  README.md            this file
```

Edit any fragment, then run:

```sh
node artifact/build.mjs
```

Fragment rules: no top-level imports or exports (except the `export default` in `08-app.tsx`). Imports for React and lucide-react live only in `build.mjs`'s header.

## What was dropped vs the multi-service plan

- Postgres + pgvector → `localStorage` + theme/entity overlap for the resurfacing engine
- NestJS API + BullMQ → inline awaits
- Supabase Auth → single device
- Gemma 4 → `window.claude.complete`
- React Native + Expo → single web component

## Deferred to v3.3

- Full convergence primitives (currently using a lighter `convergenceRisk` via `inductionRisk` + intent-class diversity)
- `RelationshipState` as a maintained object
- 3-state asymmetry detection
- Continuous statistical decay by observation kind
- `usefulnessScore` (user-derived signals only when shipped)
- `semanticOwnershipScore` (cheap proxy first)
- Scaffold vocab baseline-rarity weighting

## Verification

Per the v3.2-kernel plan (`/root/.claude/plans/v1-app-signal-primary-prancy-fox.md`):

1. Artifact loads with no console errors, renders prompt-first home.
2. State engine fires at expected rates across ≥30 entries: OBSERVE ~55%, INTERPRET ~33%, STRIKE ~12%.
3. Inducing convergence (answer 5+ POINTED prompts on one theme) produces an intent-monoculture flag, a provenance challenge on the next insight referencing that theme, and an elevated DEFLATIONARY rate.
4. Free-write contradicting a prior inferred pattern drops its confidence.
5. UX invariants hold: ≤1 in 4 insights surfaces a disclosure; "I may have helped shape this" ≤1 per 7 days; DEFLATIONARY ≤1 in 4.
6. Export → Import round trip preserves the evidence log, confidence fields, and `confidenceState`.
7. Dogfood test after 7 days — primary signal: "Did this feel like being understood, or like being processed?"

## Caveats

- `window.claude.complete` only exists inside Claude.ai artifacts.
- Data lives in this browser tab's `localStorage`. Private browsing or site-data clears wipe it. Import/Export is the durable path.
- Lineage uses lexical normalization (lower-case, trimmed) not embeddings — "the gym" and "gym" merge, but "the gym" and "fitness" don't.
- A typical answer triggers ~3 LLM calls (extract + receipt + next prompt); STRIKE adds one more for insight; DEFLATIONARY and SYNTHESIS each add one when fired.
