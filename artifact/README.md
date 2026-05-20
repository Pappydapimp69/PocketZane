# Signal — Claude.ai Artifact

Single-file React component. Drop the contents of `signal.tsx` into a
Claude.ai artifact (React) and it runs.

## How to use

1. Open a new chat at https://claude.ai
2. Ask Claude to create a React artifact and paste the contents of
   `signal.tsx` as the implementation.
3. Tap the **+** button to capture a thought. The extraction call uses
   `window.claude.complete`, which the artifact runtime injects.
4. After at least 3 entries, every new capture may trigger an insight if
   Claude finds a specific, non-generic pattern across your history.

## What's in scope

- Capture: text + optional mood
- Per-entry LLM extraction (summary, entities, emotions, themes, behaviors)
- Insight generation across the last 20 entries with hard rules against
  generic platitudes
- Feedback per insight (accurate / partial / wrong / important / boring /
  save). Wrong + Boring auto-dismiss from feed.
- Local-only persistence via `localStorage`
- Export to JSON, delete-all

## What was dropped vs the multi-service plan

The full Phases 1+2 plan (`docs/PLAN.md`) targeted iOS + NestJS +
Supabase + Upstash + pgvector. None of that runs inside an artifact, so
this version trades:

- Postgres + pgvector → `localStorage`
- NestJS API + BullMQ queue → inline `await` calls
- Supabase Auth → no auth, single device
- Gemma 4 via Google AI Studio → `window.claude.complete`
- Pgvector similarity for memory retrieval → just feeds the last 20
  entries to the insight prompt as context
- React Native + Expo → web React component

Insight quality now rests entirely on the prompt in `maybeGenerateInsight`
— that's the file to iterate on if insights feel generic.

## Caveats

- `window.claude.complete` only exists inside Claude.ai artifacts. Running
  this in any other environment will throw on capture.
- All data lives in the browser tab's `localStorage`. Clearing site data
  or using private browsing wipes it.
- No retries on rate-limit errors — the artifact runtime handles that
  layer for us.
