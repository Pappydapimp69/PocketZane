# Transcript pulling

`pull_transcripts.py` pulls caption transcripts for **every video** on a YouTube
channel — by default the [Notorious Peepop](https://www.youtube.com/channel/UCZdrcbdgne0QefkwtobZEVg)
channel (Matt and Shane's Secret Podcast reposts).

## What it does

1. Enumerates all video IDs on the channel with `yt-dlp` (metadata only, no media).
2. Fetches each video's caption track with `youtube-transcript-api`, preferring a
   manually-uploaded English track and falling back to the auto-generated one.
3. Writes, per video, into `data/transcripts/notorious-peepop/`:
   - `<date>_<id>_<slug>.txt` — clean plain text
   - `<date>_<id>_<slug>.json` — segments with `start`/`duration`/`text`
   - appends to `index.jsonl` (manifest) and `failures.jsonl` (errors)

The run is **resumable**: videos whose `.json` already exists are skipped.

## Speaker separation

YouTube captions contain **no speaker labels**, so this script does not split
output per speaker. The per-video `.json` (with timestamps) is the input a future
diarization pass (e.g. WhisperX + pyannote over the downloaded audio) would use to
produce per-speaker files. That pass needs a GPU, a HuggingFace token, and far
more bandwidth/storage, so it's kept separate.

## Run

```bash
pip install -r scripts/requirements.txt

# entire channel
python scripts/pull_transcripts.py

# most recent 10 videos
python scripts/pull_transcripts.py --limit 10

# 10 RANDOM videos from across the whole channel (reproducible with --seed)
python scripts/pull_transcripts.py --sample 10 --seed 42
```

## Network requirement (important)

Claude Code on the web runs behind a default-deny egress gateway. With the
default policy, every YouTube request returns `403 host_not_allowed` and nothing
is fetched. To run this **inside a web session**, the environment must be
(re)created with a network policy that allows the YouTube hosts:

- `www.youtube.com`, `youtube.com`
- `youtubei.googleapis.com`
- `*.googlevideo.com`

See https://code.claude.com/docs/en/claude-code-on-the-web for how network
policies are configured. The script also runs unchanged on any machine with
normal internet access.

## Fallback when YouTube is blocked: `pull_transcripts_gemini.py`

If you can't relax the egress policy, `pull_transcripts_gemini.py` reaches the
same goal using only Google API hosts that the default policy *does* allow
(`www.googleapis.com` for enumeration, `generativelanguage.googleapis.com` for
Gemini). Google fetches each video server-side, so our container never touches
`youtube.com`. It needs a free Google AI Studio key (`GOOGLE_AI_API_KEY`) with
the *YouTube Data API v3* enabled on its project.

Trade-off: these are **Gemini ASR transcripts, not YouTube's official caption
tracks** — generally high quality but not identical, with approximate timing.

```bash
export GOOGLE_AI_API_KEY=...
python scripts/pull_transcripts_gemini.py --limit 5   # smoke test
```
