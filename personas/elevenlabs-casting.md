# ElevenLabs casting — PocketZane

Final voice picks for the Shane × Zane podcast. Both are ElevenLabs default
library voices (no cloning needed). Use with `shane-zane-ep1-elevenlabs.txt`.

| Role | Voice | Why | Stability | Similarity | Style | Speaker Boost |
|------|-------|-----|-----------|-----------|-------|---------------|
| **Shane** | **Chris** | Casual, conversational American male — natural "guy riffing" energy that can be pushed animated | **30–35%** | 80% | **~50%** | On |
| **Zane** | **Brian** | Deep, calm American narrator — lands deadpan and lets the silences do the work | **75–80%** | 75% | **0–10%** | On |

## The key dial: Stability

The whole dynamic lives in the stability split.
- **Shane low (~30%)** = volatile, bouncy, escalates — he rides the energy up.
- **Zane high (~78%)** = flat, steady, unbothered — he never gives Shane the reaction.

If Shane sounds too calm, drop his stability further (toward 25%) and nudge Style up.
If Zane sounds too emotive, push his stability up and Style to 0.

## Backups (if you want to A/B)
- Shane: **Sam** (raspier, younger) or **Will** (chiller).
- Zane: **Daniel** (British, authoritative — even drier) or **George** (warm British).

## Quick setup
1. ElevenLabs **Studio → Create new → from text**, paste `shane-zane-ep1-elevenlabs.txt`.
2. Add **Chris** and **Brian** to the project.
3. **Assign voices to speakers** — the `Shane:` / `Zane:` labels group the two
   speakers and get stripped from the audio.
4. Apply the settings above per voice. Generate.
