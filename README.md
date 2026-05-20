# Signal

An iOS-first journaling app that returns specific, longitudinal insights from
short personal fragments. Thesis: users repeat-input only if the system
surfaces patterns they would not have noticed themselves.

This branch implements **Phases 1 + 2** of the V1 spec — capture, extraction,
embeddings, feed, insights, feedback. Map, timeline, voice, and image capture
are deferred.

## Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (managed), iOS first |
| API | NestJS (TypeScript) |
| DB | Supabase Postgres + pgvector |
| Auth | Supabase Auth (email + password) |
| Queue | Upstash Redis + BullMQ |
| LLM | Provider-abstracted; Gemma 4 (Google AI Studio) default |
| Embeddings | Google `text-embedding-004` |

## Layout

```
apps/
├── mobile/    Expo app
└── api/       NestJS API + queue workers (single process in V1)
packages/
└── shared/    zod schemas + TS types shared by mobile and api
supabase/
└── migrations/
```

## Setup

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env` and fill in Supabase + Google AI keys.
3. Apply migrations: `supabase db push` (or paste into Supabase SQL editor).
4. Run API: `pnpm dev:api`.
5. Run mobile: `pnpm dev:mobile` and open in iOS simulator.

## Dogfood checklist

The V1 thesis can only be validated by use, not unit tests. After this
branch ships, log fragments daily for ≥1 week and track:

- Did at least one insight per week feel *weirdly specific*?
- Did any insight feel generic / horoscope-style?
- Did the system surface a recurrence you would not have noticed?

Record results in this README so we can decide whether to invest in Phase 3
(graph/map) or iterate on extraction + generator prompts first.
