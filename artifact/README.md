# Signal — Claude.ai Artifact

A prompt-first journal. Zane asks; you answer. He doesn't always reply, and that's the point.

## How to use

1. Open https://claude.ai, start a new chat, ask Claude to create a React artifact, paste the contents of `signal.tsx` as the implementation.
2. The first screen introduces Zane. Tap **Begin**.
3. Answer the prompt at the top. A new one loads when you're done. Skip with "not this one".
4. Sometimes Zane will reply to your answer with one short observation. Sometimes he won't. Most of the time he stores it and waits.
5. When he names a feeling or motive ("you sound angry"), tap **correct** to push back. That correction becomes ground truth for future prompts.
6. Rare insight cards appear when patterns clear a hard bar. Mark **Wrong** or **Boring** to dismiss; **Save** to keep.

## The six layers

| Layer | What it does |
|---|---|
| **Voice** | Persona prompt + good/bad exemplars + anti-cleverness rules on every generation call |
| **Variance** | Seed library tagged SHARP / SPARSE / NEUTRAL / CURIOUS; prompt generator rotates densities |
| **Restraint** | OBSERVE / INTERPRET / STRIKE state engine. ~55% OBSERVE, ~33% INTERPRET, ~12% STRIKE. Cooldown forces 3 OBSERVEs after every STRIKE. |
| **Memory** | Resurfacing engine on prompt generation: theme/entity overlap between recent (≤3d) and dormant (≥7d) entries can trigger a callback prompt |
| **Correction** | Inline "no, actually —" edit on any receipt that names a feeling/motive. Stored as ground truth, injected into future prompts. |
| **Insights** | Hard gates: ≥3 evidence entries, ≥0.6 confidence, declarative voice, no hedging words, must cite a specific detail. |

## What was dropped vs the multi-service plan

- Postgres + pgvector → `localStorage` + theme/entity overlap for the resurfacing engine
- NestJS API + BullMQ → inline awaits
- Supabase Auth → single device
- Gemma 4 → `window.claude.complete`
- React Native + Expo → single web component

## What to iterate on

The prompts are the product. If insights feel generic, tune `maybeGenerateInsight`. If receipts feel performative, expand the bad-exemplars list. If Zane is too quiet, lower the OBSERVE share in `selectZaneState`. If he's too chatty, raise it.

## Caveats

- `window.claude.complete` only exists inside Claude.ai artifacts.
- Data lives in this browser tab's `localStorage`. Private browsing or site-data clears wipe it.
- Resurfacing uses lexical overlap (theme/entity names), not embeddings — works on overlap, misses paraphrase.
- One LLM call per submit (extraction) plus one per receipt plus one for the next prompt — so 2–3 calls per answer. Plus one more on STRIKE.
