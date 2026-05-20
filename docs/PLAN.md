# Signal V1 — Phases 1 + 2 (MVP Core)

## Context

The repo (`PocketZane`, branch `claude/signal-mvp-core-DX5T5`) is empty — no
commits yet. We're bootstrapping **Signal**, an iOS-first journaling app whose
thesis is that users will repeatedly log personal fragments only if the system
returns *specific, non-generic longitudinal insights*.

This plan covers **Phases 1 + 2** of the spec:

- Phase 1 (core loop): auth, text capture, entry storage, LLM extraction,
  embeddings.
- Phase 2 (insight loop): feed, insight generation, user feedback.

Deferred to later branches: map/graph (Phase 3), timeline/epochs (Phase 4),
voice + image capture (Phase 5). Schemas for those (`nodes`, `edges`, `epochs`)
are **not** created in this MVP; insight generation operates directly on the
`extractions` JSONB + entry embeddings so we can prove the "weirdly specific
insight" hypothesis before investing in a graph layer.

The "critical V1 test" the design optimizes for: produce ≥1 insight per week
per user that feels *weirdly specific*.

## Locked decisions

| Concern | Choice |
|---|---|
| Mobile | React Native + **Expo** (managed workflow), iOS-first |
| Backend | **NestJS** (TypeScript) |
| Database | **Supabase Postgres + pgvector** |
| Auth | **Supabase Auth**, email + password |
| Storage | Supabase Storage (deferred until Phase 5; bucket configured early) |
| Queue | **Upstash Redis** + BullMQ |
| LLM extraction | Provider-abstracted; **Gemma 4** (Google AI Studio) default |
| Embeddings | Google `text-embedding-004` via same abstraction |
| Repo layout | pnpm workspaces monorepo |

## Repo layout

```
/
├── apps/
│   ├── mobile/                  # Expo / React Native iOS-first
│   └── api/                     # NestJS API + workers (same process for V1)
├── packages/
│   └── shared/                  # zod schemas + TS types shared by mobile+api
├── supabase/
│   ├── migrations/              # SQL migrations
│   └── config.toml
├── .env.example
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Single process for API + BullMQ workers in V1 (NestJS app boots both HTTP and
queue consumers). Splitting into separate worker process is a 30-min change
later; not worth the deploy complexity now.

## Database (Supabase migrations)

Migrations to create in `supabase/migrations/`:

- `0001_extensions.sql` — `create extension vector;` + `pgcrypto`.
- `0002_users_settings.sql` — `users` mirror table keyed by `auth.users.id`
  (Supabase manages auth tables; this holds app-level columns: `timezone`,
  `settings_json`, `onboarding_complete`).
- `0003_entries.sql` — `entries`, `entry_embeddings` (vector(768) — matches
  `text-embedding-004` dim), `extractions`.
- `0004_insights.sql` — `insights`, `insight_feedback`.
- `0005_indexes.sql` — `ivfflat` index on `entry_embeddings.embedding`
  (cosine), btree on `entries(user_id, created_at desc)`, GIN on
  `extractions.entities`/`emotions`/`themes`.
- `0006_rls.sql` — Row Level Security: every table policy is
  `user_id = auth.uid()`. Service-role key bypasses RLS for worker jobs.

Schema follows the spec exactly. `nodes`, `edges`, `epochs` are **omitted**
from Phase 1+2 — we'll add them in Phase 3.

`extractions` shape (jsonb columns): `entities`, `emotions`, `topics`,
`behaviors`, `symptoms`, `temporal_refs`, `contradictions`, plus scalar
`summary` and `confidence`.

## Backend — `apps/api`

NestJS module layout:

```
src/
├── main.ts
├── app.module.ts
├── config/                      # @nestjs/config, zod-validated env
├── common/
│   ├── guards/supabase-auth.guard.ts   # validates Supabase JWT, attaches user
│   └── decorators/user.decorator.ts    # @CurrentUser()
├── supabase/                    # SupabaseService — service-role client
├── llm/
│   ├── llm.module.ts
│   ├── llm.service.ts           # router; picks provider by config
│   └── providers/
│       ├── provider.interface.ts        # extract(), embed(), generate()
│       ├── gemma.provider.ts            # Gemma 4 via Google AI Studio
│       ├── gemini-embeddings.provider.ts
│       └── stubs/                       # anthropic.stub.ts, openai.stub.ts (throw not-implemented)
├── queue/                       # BullMQ module wired to Upstash REST
├── entries/
│   ├── entries.controller.ts    # POST /entries, GET /entries, GET /entries/:id
│   ├── entries.service.ts
│   └── dto/
├── extraction/
│   ├── extraction.processor.ts  # BullMQ worker: entry → LLM → extractions row
│   ├── prompts/extraction.prompt.ts
│   └── schemas/extraction.schema.ts     # zod schema for LLM structured output
├── embeddings/
│   └── embeddings.processor.ts  # entry → vector → entry_embeddings row
├── memory/
│   └── memory.service.ts        # similar-entries lookup (pgvector cosine + filters)
├── insights/
│   ├── insights.controller.ts   # GET /insights, GET /insights/:id, POST /insights/:id/feedback
│   ├── insights.service.ts
│   ├── insights.processor.ts    # generation job
│   └── generators/
│       ├── recurrence.generator.ts
│       ├── contradiction.generator.ts
│       ├── temporal-pattern.generator.ts
│       ├── emotional-shift.generator.ts
│       └── resurfaced-theme.generator.ts
├── feedback/
│   └── feedback.service.ts      # updates user weighting profile
└── feed/
    ├── feed.controller.ts       # GET /feed
    └── feed.service.ts          # mixes entries + insights, ranks
```

### Processing pipeline

`POST /entries` flow:

1. `EntriesService.create()` — RLS-scoped insert of `entries` row,
   `processing_status='queued'`.
2. Return entry to client immediately.
3. Enqueue **`extract-entry`** job (entry_id).
4. `ExtractionProcessor` calls `LlmService.extract()` → upserts `extractions`
   row → enqueues **`embed-entry`** and **`maybe-generate-insight`**.
5. `EmbeddingsProcessor` calls `LlmService.embed()` → upserts
   `entry_embeddings`.
6. `InsightsProcessor` runs each `generator` against the new entry + user
   history; if any returns a candidate above confidence threshold, insert
   `insights` row with `status='active'`.
7. Mobile polls or refetches feed; SSE/websocket is **not** in V1 (poll on
   capture-return + manual pull-to-refresh is fine).

### Insight generators (V1, no graph)

Each generator is a pure function `(entry, userHistory, extractions) → Candidate | null`.

- **recurrence**: theme/entity appears in ≥3 entries within a configurable
  window with no insight covering it yet.
- **temporal_pattern**: simple time-of-day / day-of-week / lag-after-event
  patterns from `entries.created_at` joined with `extractions.themes`.
- **emotional_shift**: average emotion intensity for a theme moves
  ≥1.0 across windows.
- **resurfaced_theme**: theme dormant ≥30d reappears.
- **contradiction**: new `extractions.contradictions[*]` semantically matches
  (pgvector) a prior entry's claim.

All generators must satisfy spec rules: ≥3 supporting entries, user-specific,
evidence_entry_ids populated, confidence ≥ threshold (start at 0.6 — tune
later from feedback), wording includes uncertainty hedges enforced by the
generation prompt.

### LLM provider abstraction

```ts
interface LlmProvider {
  extract(text: string): Promise<ExtractionResult>;
  embed(text: string): Promise<number[]>;
  generate(prompt: string, opts?): Promise<string>;
}
```

Gemma 4 adapter uses Google AI Studio REST with `responseSchema` for
structured JSON. Validate with zod after; on parse failure, retry once with a
"strict JSON" reminder, then mark `processing_status='extraction_failed'` and
move on.

Rate-limit handling: BullMQ rate limiter at the worker level (start: 12 RPM
for Gemma free tier, 1500 RPM for embeddings) + exponential backoff on 429.

## Frontend — `apps/mobile`

Expo SDK, React Navigation, React Query, Zustand for auth/session,
`@supabase/supabase-js` for auth only (REST client hits NestJS, not Supabase
directly — keeps RLS + service logic on the server).

Screens shipping in Phases 1+2:

- `AuthScreen` — sign in / sign up (Supabase Auth email+password)
- `FeedScreen` — mixed feed (entries + insights), pull-to-refresh
- `CaptureScreen` — single textarea, optional mood, submit
- `EntryDetailScreen` — raw text, extracted entities/emotions/themes,
  related entries, correction controls (corrections POST to extraction
  override endpoint — stored as a sibling `extraction_overrides` field on
  the row; defer if tight, but cheap)
- `InsightDetailScreen` — insight body, confidence, evidence entries,
  feedback buttons (accurate / partially / wrong / important / uncomfortable
  / boring / save / expand)
- `SettingsScreen` — sign out, export all data (calls `GET /me/export`),
  delete all data (calls `DELETE /me`), "not therapy/medical advice"
  disclaimer

**Deferred screens:** Map, Timeline. Bottom tab bar in V1 = Feed only +
Capture FAB + Settings icon. Tab slots for Map/Timeline added in Phase 3/4.

### Feed item rendering

`FeedItem` discriminates on `type` (`ENTRY` | `INSIGHT`) and dispatches to
`EntryCard` or `InsightCard`. Spec also lists `QUESTION`,
`RECURRING_THEME`, `CONTRADICTION`, `EPOCH_UPDATE` — in Phases 1+2 we
emit only `ENTRY` and `INSIGHT` (which subsumes recurring_theme and
contradiction via `insight.insight_type`). Question/epoch deferred.

## Shared package — `packages/shared`

Zod schemas live here so both mobile and api validate against the same
source of truth: `CreateEntryInput`, `Entry`, `Extraction`, `Insight`,
`InsightFeedback`, `FeedItem`. Types are inferred via `z.infer<>`.

## Critical files

- `pnpm-workspace.yaml`, root `package.json` (workspaces)
- `supabase/migrations/0001…0006*.sql`
- `apps/api/src/main.ts`, `app.module.ts`
- `apps/api/src/llm/providers/gemma.provider.ts` — the only adapter that
  must work end-to-end in V1
- `apps/api/src/extraction/prompts/extraction.prompt.ts` — the prompt is
  the product; iterate here
- `apps/api/src/insights/generators/*.ts` — likewise
- `apps/api/src/common/guards/supabase-auth.guard.ts`
- `apps/mobile/App.tsx`, `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/screens/CaptureScreen.tsx`,
  `apps/mobile/src/screens/FeedScreen.tsx`,
  `apps/mobile/src/screens/InsightDetailScreen.tsx`
- `packages/shared/src/types/*.ts`
- `.env.example` documenting every required key

## Privacy / safety (V1 mandatory)

- `DELETE /me` cascade-deletes user rows; RLS keeps blast radius to that user.
- `GET /me/export` streams JSON (entries + extractions + insights + feedback).
- `entries.privacy_level = 'LOCKED'` → excluded from generator queries
  (enforce in SQL `where` clauses, not application-side).
- Onboarding shows the "not therapy, not medical advice" copy and persists
  `users.onboarding_complete = true`.

## Build order within this branch

1. Workspace + tooling + `.env.example` + Supabase project pointers.
2. Migrations 0001–0006 + Supabase CLI wired.
3. NestJS bootstrap, Supabase auth guard, `/entries` CRUD with RLS verified
   via two test users.
4. LLM provider interface + Gemma adapter + embeddings adapter, both
   exercised by a `pnpm tsx scripts/smoke-llm.ts`.
5. BullMQ + Upstash + extraction processor + embeddings processor end-to-end
   (capture → extractions+embedding rows visible in Supabase).
6. Memory service (pgvector cosine search, top-k similar entries) + unit test.
7. Insight generators (start with `recurrence`, then `temporal_pattern`,
   then the rest) + `POST /insights/:id/feedback`.
8. Feed ranking (`score = recency*α + significance*β + interest*γ`) +
   `GET /feed`.
9. Expo bootstrap, auth, capture, feed, entry detail, insight detail,
   settings.
10. Privacy endpoints (`DELETE /me`, `GET /me/export`).

Commit per step. Don't batch.

## Verification

End-to-end smoke (manual, before opening PR):

1. `pnpm --filter api dev` + Expo running on an iOS simulator.
2. Sign up new user → onboarding screen → land on Feed (empty state).
3. Capture 10 short entries about, e.g., a recurring person and recurring
   mood-after-event pattern. Submit each.
4. Watch BullMQ logs: each entry should produce extraction + embedding rows
   within ~5s.
5. After ~3rd entry on a recurring theme, an insight row should appear; pull
   feed → insight card visible above older entries.
6. Open insight detail, mark "accurate" — confirm `insight_feedback` row +
   user weighting profile update.
7. Mark another insight "wrong" — confirm next generation cycle suppresses
   that pattern.
8. Settings → Export → JSON downloads. Settings → Delete → all rows gone in
   Supabase (verify with SQL editor under service role).

Automated:

- `apps/api`: Jest unit tests for each generator (table-driven: fixture
  history → expected candidate or `null`), `SupabaseAuthGuard`, LLM provider
  with mocked HTTP.
- `apps/api`: Pact-style contract tests for `/entries`, `/feed`,
  `/insights/:id/feedback` against the zod schemas in `packages/shared`.
- `apps/mobile`: React Native Testing Library smoke tests for `CaptureScreen`
  submit flow and `FeedScreen` render.
- CI runs `pnpm -r typecheck && pnpm -r test`.

The "critical V1 test" can't be unit-tested — it needs a real user logging
for ≥1 week. Document a dogfood checklist in `README.md` so we evaluate the
hypothesis quickly after this branch ships.

## Out of scope (explicit)

- Map screen, `nodes`/`edges` tables, graph rendering
- Timeline screen, `epochs` table
- Voice transcription, image upload, OCR
- Social, streaks, gamification, "AI friend" framing
- Push notifications
- Multi-device sync conflict resolution (Supabase realtime handles
  read-side later)
- Splitting API from worker processes
