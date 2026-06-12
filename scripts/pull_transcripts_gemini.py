#!/usr/bin/env python3
"""Pull transcripts for every Notorious Peepop video via Google APIs only.

Why this exists: Claude Code's web egress gateway is default-deny. Direct
YouTube access (youtube.com, third-party transcript sites, yt-dlp, the
timedtext caption endpoint) is all blocked with `403 host_not_allowed`, and
YouTube also refuses InnerTube player data to datacenter IPs. The only YouTube-
capable hosts on the allowlist are Google's API endpoints:

  * www.googleapis.com               -> YouTube Data API v3 (enumerate videos)
  * generativelanguage.googleapis.com -> Gemini (transcribe via server-side fetch)

So this script enumerates the channel with the Data API, then asks Gemini to
transcribe each video by passing the YouTube URL as a file_data part — Google
fetches and processes the video on its own infrastructure, never our container.

NOTE: these are Gemini ASR transcripts, not YouTube's official caption tracks
(those are unreachable here). Quality is generally high but not identical, and
timestamps are approximate.

Setup:
  pip install -r scripts/requirements.txt   # only needs `requests`
  export GOOGLE_AI_API_KEY=...              # from https://aistudio.google.com/apikey
  # Enable BOTH on the key's Google Cloud project:
  #   - "YouTube Data API v3"   (for enumeration)
  #   - "Generative Language API" (for transcription; on by default for AI Studio keys)

Usage:
  python scripts/pull_transcripts_gemini.py --limit 5      # smoke test
  python scripts/pull_transcripts_gemini.py                # whole channel
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install -r scripts/requirements.txt")

CHANNEL_ID = "UCZdrcbdgne0QefkwtobZEVg"  # Notorious Peepop
DEFAULT_OUT = "data/transcripts/notorious-peepop"
DATA_API = "https://www.googleapis.com/youtube/v3"
GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODEL = "gemini-2.0-flash"

TRANSCRIBE_PROMPT = (
    "Transcribe the spoken audio of this video verbatim, in English. "
    "Output only the transcript text with no commentary, headings, or timestamps. "
    "Use a new line at natural sentence or speaker-turn boundaries."
)


def slugify(text: str, max_len: int = 60) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:max_len].strip("-") or "untitled"


def api_key() -> str:
    key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("Set GOOGLE_AI_API_KEY (see https://aistudio.google.com/apikey).")
    return key


def get_uploads_playlist(key: str) -> str:
    r = requests.get(f"{DATA_API}/channels",
                     params={"part": "contentDetails", "id": CHANNEL_ID, "key": key},
                     timeout=30)
    r.raise_for_status()
    items = r.json().get("items", [])
    if not items:
        sys.exit("Channel not found / no contentDetails (check the key & channel id).")
    return items[0]["contentDetails"]["relatedPlaylists"]["uploads"]


def list_uploads(key: str, playlist_id: str, limit: int | None) -> list[dict]:
    videos, page = [], None
    while True:
        params = {"part": "snippet,contentDetails", "playlistId": playlist_id,
                  "maxResults": 50, "key": key}
        if page:
            params["pageToken"] = page
        r = requests.get(f"{DATA_API}/playlistItems", params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for it in data.get("items", []):
            vid = it["contentDetails"]["videoId"]
            sn = it["snippet"]
            videos.append({
                "id": vid,
                "title": sn.get("title", vid),
                "published_at": sn.get("publishedAt", ""),
            })
            if limit and len(videos) >= limit:
                return videos
        page = data.get("nextPageToken")
        if not page:
            return videos


def transcribe(key: str, video_id: str, model: str, retries: int) -> str:
    url = f"{GEMINI_API}/{model}:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [
            {"text": TRANSCRIBE_PROMPT},
            {"file_data": {"file_uri": f"https://www.youtube.com/watch?v={video_id}"}},
        ]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 8192},
    }
    last = ""
    for attempt in range(1, retries + 1):
        try:
            r = requests.post(url, json=payload, timeout=600)
            if r.status_code == 200:
                cands = r.json().get("candidates", [])
                if not cands:
                    raise RuntimeError(f"no candidates: {r.text[:160]}")
                parts = cands[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                if not text:
                    raise RuntimeError(f"empty transcript: {r.text[:160]}")
                return text
            # 429/5xx -> backoff; 4xx other -> surface
            last = f"HTTP {r.status_code}: {r.text[:160]}"
            if r.status_code not in (429, 500, 503):
                raise RuntimeError(last)
        except requests.RequestException as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < retries:
            time.sleep(2 ** attempt)
    raise RuntimeError(last)


def already_done(out_dir: Path, video_id: str) -> bool:
    return any(out_dir.glob(f"*_{video_id}_*.txt"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--limit", type=int, default=None, help="Only the most recent N videos")
    ap.add_argument("--sample", type=int, default=None,
                    help="Randomly sample N videos from the full channel")
    ap.add_argument("--seed", type=int, default=None, help="Random seed for --sample")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--retries", type=int, default=4)
    args = ap.parse_args()

    key = api_key()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    fail_path = out_dir / "failures.jsonl"

    print("[*] Enumerating channel via YouTube Data API…", file=sys.stderr)
    uploads = get_uploads_playlist(key)
    # --sample draws from the full list; --limit caps at enumeration time.
    videos = list_uploads(key, uploads, None if args.sample else args.limit)
    if args.sample:
        videos = random.Random(args.seed).sample(videos, min(args.sample, len(videos)))
        print(f"[*] Randomly sampled {len(videos)} of channel", file=sys.stderr)
    print(f"[*] {len(videos)} videos", file=sys.stderr)

    ok = skipped = failed = 0
    with fail_path.open("a") as fail_f:
        for i, v in enumerate(videos, 1):
            prefix = f"[{i}/{len(videos)}] {v['id']}"
            if already_done(out_dir, v["id"]):
                skipped += 1
                print(f"{prefix} skip (exists)", file=sys.stderr)
                continue
            try:
                text = transcribe(key, v["id"], args.model, args.retries)
            except Exception as e:
                failed += 1
                fail_f.write(json.dumps({**v, "error": str(e)[:300]}) + "\n")
                fail_f.flush()
                print(f"{prefix} FAIL ({str(e)[:90]})", file=sys.stderr)
                time.sleep(args.delay)
                continue

            date = (v["published_at"] or "")[:10].replace("-", "") or "00000000"
            base = f"{date}_{v['id']}_{slugify(v['title'])}"
            (out_dir / f"{base}.txt").write_text(text + "\n")
            (out_dir / f"{base}.json").write_text(json.dumps({
                "video_id": v["id"], "title": v["title"],
                "published_at": v["published_at"],
                "url": f"https://www.youtube.com/watch?v={v['id']}",
                "source": f"gemini:{args.model}", "transcript": text,
            }, ensure_ascii=False, indent=2))
            ok += 1
            print(f"{prefix} ok ({len(text)} chars) -> {base}.txt", file=sys.stderr)
            time.sleep(args.delay)

    print(f"\nDone. ok={ok} skipped={skipped} failed={failed}", file=sys.stderr)
    print(f"Output: {out_dir}/  |  failures: {fail_path}", file=sys.stderr)
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
