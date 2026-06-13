# Exaggerated-Japanese-accent system (ElevenLabs v3)

The reproducible ruleset for the accent comedy scripts in `accent-scripts/`.
The accent is **tag + spelling driven** (not baked into the voice), so it can be
turned on/off per line. Built and refined over many iterations — follow it exactly
for consistent results.

---

## 1. Phonetics (how to spell the accent)

### Epenthetic vowel (the trailing vowel)
Japanese can't end a syllable on most hard consonants, so a vowel is appended —
**only** when the English word ends in a hard consonant:

| Word ends in… | Add | Examples |
|---|---|---|
| `-t` / `-d` | **-o** | what-o, hand-o, cockpit-o, afraid-o, heard-o |
| `-k` / `-p` / `-s` / `-b` / `-m` | **-u** | across-u, strike-u, intercom-u, job-u |
| vowel, `-n`, `-r`, `-ing`, `-sh` | **nothing** | fry, sudden, smerr, hunting, finish |

- **`-a`** is ONLY a connector on little function words: `is-a`, `was-a`, `not-a`,
  `in-a`, `am-a`, `have-a`, `does-a`. **Never** on content words (no "make-a",
  "give-a", "become-a").
- Iconic `-le` words keep the `-oru` form: rittoru (little), peopuru (people),
  battoru (battle), terriboru (terrible), middoru (middle).

### "Go easy" mode (lighter suffixes — used in later/longer scripts)
Drop nearly all `-o/-u/-a` and let the accent ride on the swaps below + grammar,
keeping only the occasional `is-a` for flavor. Use this for long-form pieces so it
reads clean.

### Always-on sound swaps
- **L → R**, always — even when it makes a real word: rook (look), terr (tell),
  rie (lie), rong (long), carr (call), arr (all), rike (like), rove/rub (love).
  Keep the collisions; do not respell.
- **th → s / z**: da (the), dis, dat, wiss (with), sink (think), sree (three),
  fazzaa (father), dem (them), dere (there), sousand (thousand), norss/souss.
- **v → b**: berry (very), habe (have), ribe (live), eben (even), surbibe,
  inbent, borcano, unibers, abice (advice).

---

## 2. Grammar (broken-English layer)
- **Base-form verbs** regardless of tense: "he take", "dey come", "Rome farr".
- **Drop plural -s**; carry number with a numeral or "many": "many year",
  "two half", "sebenty hat", "too many emperor".
- **`da` = the**, and most articles drop (topic-first phrasing).
- **`is-a`** as the all-purpose copula filler.

---

## 3. Tags
- **One tag per bracket. No commas inside a bracket.** Write `[exhales] [laughing]`,
  never `[exhales, laughing]`. Write `[thick exaggerated Japanese accent]` (no comma).
- **Re-declare `[thick exaggerated Japanese accent]` at the top of every paragraph**
  on long/solo pieces — it drifts otherwise.
- **`[normal voice]`** snaps a speaker out of the accent mid-line (use after an
  in-character accent bit so they revert).
- **Dead tags (get read aloud or ignored — do NOT use):** `[dryly]`, `[building]`,
  `[proudly]`. Replace with `[deadpan]`/`[flat]`, `[excited]`, `[matter-of-fact]`.
- **Working tags:** emotional *states* perform well — [serious] [grave] [flat]
  [deadpan] [excited] [tense] [whispers] [ominous] [defeated] [confused] [nervous]
  [menacing] [smug] [hopeful] [warm], plus vocals [laughs] [chuckles] [sighs]
  [exhales] [inhales] [breathes] [scoffs] [gasps] [snorts] [wheezing]
  [clears throat] and the structural [pause].
- New tags should be tested on a single line before relying on them.

---

## 4. Generation (ElevenLabs v3)
- Model: **Eleven v3**. Stability: **Creative** (Natural/Robust flatten the
  performance and ignore tags).
- **~3,000-char limit per render** — split long scripts on paragraph breaks; each
  paragraph re-declares the accent tag so chunks stand alone.
- **Two-handers: strip the speaker names** (ElevenLabs reads "Zane" aloud). Use
  **strict A/B alternation** and assign voices per turn in Studio Dialogue mode:
  **Voice 1 = Zane**, **Voice 2 = Shane**.
- Inline `(voice_id)` after a name does NOT work in the Studio paste box — per-line
  voice binding only exists in the Text-to-Dialogue **API** JSON (`inputs:[{text,
  voice_id}]`), which requires v3 API access.

## 5. Voices (this session)
- **Shane** = `QEbcuZBRYsFsyfw9rHq3`
- **Zane** = `ONYZZkijU95tbm0jlDBZ`  (accent-work voice adopted this session)
- Tags are **probabilistic** — always do a listen-pass and re-roll bad lines.
