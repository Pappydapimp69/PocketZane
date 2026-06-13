# Voice reference — PocketZane (ElevenLabs v3)

Designed voices for the Shane × Zane podcast. Accents are **baked into the voice**
(no per-line accent tags). Fill in each `voice_id` after creating the voice in
ElevenLabs → **Voice Design** → generate previews → Save to My Voices → ⋮ →
**Copy Voice ID**.

> Note: Voice Design prompts describe *qualities*, not real people — naming a real
> person is filtered and would be a cloning concern. For an actual person's voice,
> use a **clone** from source audio instead.

---

## Shane — designed voice (Mechanicsburg, south-central PA)

- **voice_id:** `QEbcuZBRYsFsyfw9rHq3`
- Voice Design prompt:

```
A regular guy from Mechanicsburg, Pennsylvania, late 30s, bullshitting with a buddy on a podcast.
Deep, gravelly, chesty voice — relaxed and unpolished, never nasal or stagey.
Plain flat American accent, lazy casual cadence; shape tone and pronunciation only.
```

## Zane — designed voice (Allentown, eastern PA)

- **voice_id:** `RJwtYukAuPwrUokQAElu`
- Voice Design prompt:

```
A guy from Allentown, eastern Pennsylvania, around 40, the dry deadpan co-host needling his buddy on a podcast.
Low, clear, full baritone — sarcastic and unbothered, never breathy or airy.
Subtle flat Mid-Atlantic accent, measured wry cadence; shape tone and pronunciation only.
```

---

## Premade fallbacks (public IDs — accent NOT bakeable)

| Role | Voice | voice_id |
|------|-------|----------|
| Shane fallback | Chris | `iP95p4xoKVk53GoZ742B` |
| Zane fallback  | Brian | `nPczCjzI2devNBz1zQrb` |

> Verify any ID in your account (My Voices → ⋮ → Copy Voice ID) before a real run.

---

## Accent-comedy voice (session update)

For the tag-driven exaggerated-accent scripts in `accent-scripts/`, Zane was
switched to a different voice during the session:

- **Zane (accent work):** `ONYZZkijU95tbm0jlDBZ`
- **Shane (unchanged):** `QEbcuZBRYsFsyfw9rHq3`

Unlike the designed voices above, these scripts drive the accent **per line via
tags** (`[thick exaggerated Japanese accent]` / `[normal voice]`), not baked-in.
See `ACCENT_RULES.md` for the full phonetic + grammar + tag system.
