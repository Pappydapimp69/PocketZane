# Superseded

This file described the original multi-service architecture (NestJS API + Postgres + pgvector + BullMQ + React Native + Expo + Supabase Auth + Gemma 4). That track was abandoned in favor of a single-file claude.ai artifact.

The current plan lives at:

```
/root/.claude/plans/v1-app-signal-primary-prancy-fox.md  (v3.2-kernel)
```

The current implementation lives at:

```
artifact/signal.tsx       — bundled output (paste into claude.ai)
artifact/src/             — fragment sources
artifact/build.mjs        — concatenation build script
artifact/README.md        — architecture + workflow
```

For why the architecture changed, see the v3.2-kernel plan's `Context` and `ZaneGPT's verdict` sections.
