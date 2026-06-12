#!/usr/bin/env python3
"""Pull caption transcripts for every video on the Notorious Peepop channel.

Strategy:
  1. Enumerate all video IDs on the channel with yt-dlp (flat playlist, no download).
  2. For each video, fetch the caption transcript with youtube-transcript-api,
     preferring a manually-uploaded English track and falling back to the
     auto-generated one.
  3. Write two artifacts per video into the output directory:
       <date>_<id>_<slug>.txt    human-readable plain text (one cleaned line)
       <date>_<id>_<slug>.json   segments with start/duration for later passes
     plus an index.jsonl manifest and a failures.jsonl log.

The run is resumable: videos whose .json already exists are skipped, so you can
stop and re-run without re-fetching. Speaker separation is intentionally NOT
done here — YouTube captions carry no speaker labels. A future diarization pass
can consume the per-video .json files to produce per-speaker output.

Network note: this environment's egress gateway must allow the YouTube hosts
(youtube.com, youtubei.googleapis.com, *.googlevideo.com) or every request will
fail with `403 host_not_allowed`. See scripts/README.md.

Usage:
  python scripts/pull_transcripts.py
  python scripts/pull_transcripts.py --limit 25 --out data/transcripts/notorious-peepop
  python scripts/pull_transcripts.py --channel https://www.youtube.com/@SomeChannel/videos
"""
from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import (
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
    )
except ImportError:
    sys.exit(
        "Missing dependency. Install with:\n"
        "  pip install -r scripts/requirements.txt"
    )

DEFAULT_CHANNEL = "https://www.youtube.com/channel/UCZdrcbdgne0QefkwtobZEVg/videos"
DEFAULT_OUT = "data/transcripts/notorious-peepop"
PREFERRED_LANGS = ["en", "en-US", "en-GB"]


@dataclass
class VideoMeta:
    id: str
    title: str
    upload_date: str  # YYYYMMDD or "" if unknown from flat listing


def slugify(text: str, max_len: int = 60) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:max_len].strip("-") or "untitled"


def list_channel_videos(channel_url: str, limit: int | None) -> list[VideoMeta]:
    """Enumerate channel videos via yt-dlp flat playlist (metadata only)."""
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--ignore-errors",
        "--print",
        "%(id)s\t%(title)s\t%(upload_date)s",
        channel_url,
    ]
    if limit:
        cmd[1:1] = ["--playlist-end", str(limit)]
    print(f"[*] Enumerating videos: {channel_url}", file=sys.stderr)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 and not proc.stdout.strip():
        sys.exit(f"yt-dlp failed to list channel:\n{proc.stderr.strip()}")
    videos: list[VideoMeta] = []
    for line in proc.stdout.splitlines():
        parts = line.split("\t")
        if not parts or not parts[0]:
            continue
        vid = parts[0]
        title = parts[1] if len(parts) > 1 else vid
        date = parts[2] if len(parts) > 2 and parts[2] != "NA" else ""
        videos.append(VideoMeta(id=vid, title=title, upload_date=date))
    print(f"[*] Found {len(videos)} videos", file=sys.stderr)
    return videos


def fetch_transcript(video_id: str) -> tuple[list[dict], str]:
    """Return (segments, language_code). Raises on no transcript."""
    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)
    # Prefer a manually-created English track, then any English, then generated.
    try:
        tr = transcript_list.find_manually_created_transcript(PREFERRED_LANGS)
    except NoTranscriptFound:
        try:
            tr = transcript_list.find_transcript(PREFERRED_LANGS)
        except NoTranscriptFound:
            tr = transcript_list.find_generated_transcript(PREFERRED_LANGS)
    fetched = tr.fetch()
    segments = [
        {"start": round(s.start, 3), "duration": round(s.duration, 3), "text": s.text}
        for s in fetched.snippets
    ]
    return segments, tr.language_code


def to_plaintext(segments: list[dict]) -> str:
    text = " ".join(s["text"].replace("\n", " ") for s in segments)
    return re.sub(r"\s+", " ", text).strip()


def write_outputs(out_dir: Path, meta: VideoMeta, segments: list[dict], lang: str) -> Path:
    date = meta.upload_date or "00000000"
    base = f"{date}_{meta.id}_{slugify(meta.title)}"
    json_path = out_dir / f"{base}.json"
    txt_path = out_dir / f"{base}.txt"
    payload = {
        "video_id": meta.id,
        "title": meta.title,
        "upload_date": meta.upload_date,
        "url": f"https://www.youtube.com/watch?v={meta.id}",
        "language": lang,
        "segment_count": len(segments),
        "segments": segments,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    txt_path.write_text(to_plaintext(segments) + "\n")
    return json_path


def already_done(out_dir: Path, video_id: str) -> bool:
    return any(out_dir.glob(f"*_{video_id}_*.json"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--channel", default=DEFAULT_CHANNEL, help="Channel /videos URL")
    ap.add_argument("--out", default=DEFAULT_OUT, help="Output directory")
    ap.add_argument("--limit", type=int, default=None, help="Only the most recent N videos")
    ap.add_argument("--sample", type=int, default=None,
                    help="Randomly sample N videos from the full channel (after enumeration)")
    ap.add_argument("--seed", type=int, default=None, help="Random seed for --sample")
    ap.add_argument("--delay", type=float, default=1.0, help="Seconds between videos")
    ap.add_argument("--retries", type=int, default=3, help="Retries per video on transient errors")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / "index.jsonl"
    fail_path = out_dir / "failures.jsonl"

    # --sample needs the full list to draw from; --limit caps at enumeration time.
    enum_limit = None if args.sample else args.limit
    videos = list_channel_videos(args.channel, enum_limit)
    if not videos:
        print("[!] No videos found — check the channel URL and egress policy.", file=sys.stderr)
        return 1
    if args.sample:
        rng = random.Random(args.seed)
        videos = rng.sample(videos, min(args.sample, len(videos)))
        print(f"[*] Randomly sampled {len(videos)} videos", file=sys.stderr)

    ok = skipped = failed = 0
    with index_path.open("a") as index_f, fail_path.open("a") as fail_f:
        for i, meta in enumerate(videos, 1):
            prefix = f"[{i}/{len(videos)}] {meta.id}"
            if already_done(out_dir, meta.id):
                skipped += 1
                print(f"{prefix} skip (exists)", file=sys.stderr)
                continue

            last_err = ""
            for attempt in range(1, args.retries + 1):
                try:
                    segments, lang = fetch_transcript(meta.id)
                    path = write_outputs(out_dir, meta, segments, lang)
                    index_f.write(json.dumps({**asdict(meta), "lang": lang,
                                              "segments": len(segments),
                                              "file": path.name}) + "\n")
                    index_f.flush()
                    ok += 1
                    print(f"{prefix} ok ({len(segments)} segs, {lang}) -> {path.name}", file=sys.stderr)
                    break
                except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
                    last_err = f"{type(e).__name__}"
                    break  # permanent — don't retry
                except Exception as e:  # transient (network/rate limit)
                    last_err = f"{type(e).__name__}: {e}"
                    if attempt < args.retries:
                        backoff = 2 ** attempt
                        print(f"{prefix} retry {attempt} in {backoff}s ({last_err[:80]})", file=sys.stderr)
                        time.sleep(backoff)
            else:
                pass
            if not already_done(out_dir, meta.id) and last_err:
                failed += 1
                fail_f.write(json.dumps({**asdict(meta), "error": last_err}) + "\n")
                fail_f.flush()
                print(f"{prefix} FAIL ({last_err[:80]})", file=sys.stderr)

            time.sleep(args.delay)

    print(f"\nDone. ok={ok} skipped={skipped} failed={failed}", file=sys.stderr)
    print(f"Transcripts: {out_dir}/  |  failures: {fail_path}", file=sys.stderr)
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
