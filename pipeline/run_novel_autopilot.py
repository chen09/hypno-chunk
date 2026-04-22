import argparse
import csv
import json
import logging
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yt_dlp

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.downloader import YouTubeDownloader
from src.transcriber import AudioTranscriber


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("novel-autopilot")

BACKOFF_SECONDS = [2, 5, 10]
STAGES = [
    "download_done",
    "transcribe_done",
    "generate_done",
    "chunk_done",
    "metadata_done",
    "upload_done",
    "deploy_done",
]

SERVER_HOST = "ubuntu@133.125.45.147"
SERVER_AUDIO_DIR = "/var/www/hypnochunk/data/2_audio_output/"
SERVER_DEPLOY_CMD = "cd ~/hypnochunk && ./deploy.sh"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_video_id(url: str) -> str:
    pattern = r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})"
    match = re.search(pattern, url)
    if not match:
        raise ValueError(f"Could not parse YouTube video ID from URL: {url}")
    return match.group(1)


def run_subprocess(command: list[str], timeout_s: int, stage: str) -> str:
    logger.info("Running [%s]: %s", stage, " ".join(command))
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout_s,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"[{stage}] Command failed ({result.returncode}): {' '.join(command)}\n"
            f"stdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}"
        )
    return result.stdout.strip()


def with_retries(action_name: str, fn, retries: int = 3):
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except Exception as error:
            last_error = error
            logger.warning(
                "%s failed (attempt %d/%d): %s",
                action_name,
                attempt,
                retries,
                error,
            )
            if attempt < retries:
                sleep_s = BACKOFF_SECONDS[min(attempt - 1, len(BACKOFF_SECONDS) - 1)]
                logger.info("Retrying in %ss ...", sleep_s)
                time.sleep(sleep_s)
    raise RuntimeError(f"{action_name} failed after {retries} attempts: {last_error}")


class CheckpointStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = self._load()

    def _load(self) -> dict[str, Any]:
        if self.path.exists():
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "stages": {stage: False for stage in STAGES},
            "artifacts": {},
            "logs": [],
        }

    def save(self) -> None:
        self.data["updated_at"] = now_iso()
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)

    def is_done(self, stage: str) -> bool:
        return bool(self.data["stages"].get(stage, False))

    def mark_done(self, stage: str, note: str = "") -> None:
        self.data["stages"][stage] = True
        if note:
            self.data["logs"].append(f"{now_iso()} {stage}: {note}")
        self.save()

    def set_artifact(self, key: str, value: Any) -> None:
        self.data["artifacts"][key] = value
        self.save()

    def get_artifact(self, key: str, default: Any = None) -> Any:
        return self.data["artifacts"].get(key, default)


def get_video_info(url: str) -> dict[str, Any]:
    options = {"quiet": True, "no_warnings": True}
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)
    return {"id": info.get("id"), "title": info.get("title") or info.get("id")}


def ffprobe_duration_seconds(path: Path) -> float:
    out = run_subprocess(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        timeout_s=60,
        stage="ffprobe_duration",
    )
    return float(out.strip())


def split_audio_to_chunks(
    source_mp3: Path,
    output_dir: Path,
    video_id: str,
    max_chunk_minutes: int,
) -> list[Path]:
    max_chunk_seconds = max_chunk_minutes * 60
    duration_seconds = ffprobe_duration_seconds(source_mp3)
    estimated_chunks = max(1, int((duration_seconds + max_chunk_seconds - 1) // max_chunk_seconds))
    logger.info(
        "Audio duration %.2f seconds; target <= %d minutes/chunk; estimated chunks: %d",
        duration_seconds,
        max_chunk_minutes,
        estimated_chunks,
    )

    for old_file in sorted(output_dir.glob(f"{video_id}_part*_merged_final.mp3")):
        old_file.unlink(missing_ok=True)

    outputs: list[Path] = []
    start_sec = 0
    part_idx = 1
    while start_sec < duration_seconds or (duration_seconds <= max_chunk_seconds and part_idx == 1):
        part_name = f"{video_id}_part{part_idx:02d}_merged_final.mp3"
        output_path = output_dir / part_name

        remaining = max(0.0, duration_seconds - start_sec)
        chunk_len = min(max_chunk_seconds, remaining) if duration_seconds > max_chunk_seconds else duration_seconds
        if chunk_len <= 0:
            break

        command = [
            "ffmpeg",
            "-y",
            "-ss",
            str(int(start_sec)),
            "-i",
            str(source_mp3),
            "-t",
            str(int(chunk_len)),
            "-c",
            "copy",
            str(output_path),
        ]
        run_subprocess(
            command,
            timeout_s=max(600, int(chunk_len * 2)),
            stage=f"ffmpeg_chunk_part{part_idx:02d}",
        )
        outputs.append(output_path)
        start_sec += chunk_len
        part_idx += 1
        if duration_seconds <= max_chunk_seconds:
            break

    if not outputs:
        raise RuntimeError("No chunk output generated.")
    return outputs


def update_track_names(
    track_names_path: Path,
    output_files: list[str],
    display_name: str,
    category: str,
) -> list[dict[str, str]]:
    if track_names_path.exists():
        with open(track_names_path, "r", encoding="utf-8") as f:
            entries = json.load(f)
    else:
        entries = []

    if not isinstance(entries, list):
        raise ValueError("track_names.json must be an array.")

    existing_by_filename: dict[str, dict[str, str]] = {
        item["filename"]: item for item in entries if isinstance(item, dict) and "filename" in item
    }

    for idx, filename in enumerate(output_files, start=1):
        existing_by_filename[filename] = {
            "filename": filename,
            "displayName": f"{display_name} - 第{idx}部分",
            "category": category,
        }

    output_set = set(output_files)
    rebuilt_entries = [item for item in entries if isinstance(item, dict) and item.get("filename") not in output_set]
    rebuilt_entries.extend(existing_by_filename[name] for name in output_files)

    with open(track_names_path, "w", encoding="utf-8") as f:
        json.dump(rebuilt_entries, f, indent=2, ensure_ascii=False)

    return [existing_by_filename[name] for name in output_files]


def update_mapping_csv(
    csv_path: Path,
    output_files: list[str],
    display_entries: list[dict[str, str]],
    category: str,
    video_id: str,
    url: str,
    raw_mp3_exists: bool,
    raw_srt_exists: bool,
) -> list[dict[str, str]]:
    headers = [
        "output_filename",
        "display_name",
        "category",
        "input_id",
        "input_kind",
        "input_url",
        "raw_mp3_exists",
        "raw_srt_exists",
        "listed_in_web_playlist_urls",
        "playlist_progress_status",
        "playlist_progress_remark",
    ]

    rows: list[dict[str, str]] = []
    if csv_path.exists():
        with open(csv_path, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append({key: row.get(key, "") for key in headers})

    entry_by_filename = {row["output_filename"]: row for row in rows if row.get("output_filename")}
    for item in display_entries:
        filename = item["filename"]
        entry_by_filename[filename] = {
            "output_filename": filename,
            "display_name": item["displayName"],
            "category": category,
            "input_id": video_id,
            "input_kind": "youtube",
            "input_url": url,
            "raw_mp3_exists": "yes" if raw_mp3_exists else "no",
            "raw_srt_exists": "yes" if raw_srt_exists else "no",
            "listed_in_web_playlist_urls": "no",
            "playlist_progress_status": "完成",
            "playlist_progress_remark": "autopilot run",
        }

    output_set = set(output_files)
    rewritten = [row for row in rows if row.get("output_filename") not in output_set]
    rewritten.extend(entry_by_filename[name] for name in output_files)

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rewritten)

    return [entry_by_filename[name] for name in output_files]


def update_mapping_md(md_path: Path, csv_rows: list[dict[str, str]]) -> None:
    youtube_like = [r for r in csv_rows if re.fullmatch(r"[A-Za-z0-9_-]{11}", r.get("input_id", ""))]
    non_youtube = [r for r in csv_rows if r not in youtube_like]
    listed = [r for r in csv_rows if r.get("listed_in_web_playlist_urls") == "yes"]

    lines = [
        "# Output ↔ Input Source Mapping",
        "",
        "This file maps generated output audio files to their original input source IDs/URLs.",
        "",
        f"- Total outputs: **{len(csv_rows)}**",
        f"- YouTube-like IDs: **{len(youtube_like)}**",
        f"- Non-YouTube/local IDs: **{len(non_youtube)}**",
        f"- Included in `web/playlist_urls.txt`: **{len(listed)}**",
        "",
        "## Source files used for mapping",
        "",
        "- `data/2_audio_output/track_names.json`",
        "- `web/playlist_urls.txt`",
        "- `data/0_raw_videos/playlist_progress.md`",
        "",
        "## Notes",
        "",
        "- `input_url` is constructed as `https://www.youtube.com/watch?v=<input_id>` when `input_id` matches YouTube ID format.",
        "- Non-YouTube/local items (e.g., novel episodes) have empty `input_url`.",
        "- Detailed per-file mapping is in `output_input_mapping.csv`.",
        "",
        "## Preview (first 20 rows)",
        "",
        "| output_filename | display_name | input_id | input_kind | input_url |",
        "|---|---|---|---|---|",
    ]

    for row in csv_rows[:20]:
        lines.append(
            f"| {row['output_filename']} | {row['display_name']} | {row['input_id']} | {row['input_kind']} | {row['input_url']} |"
        )

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def upload_artifacts(output_files: list[Path], extra_files: list[Path]) -> None:
    upload_list = output_files + extra_files
    for file_path in upload_list:
        if not file_path.exists():
            raise FileNotFoundError(f"Cannot upload missing file: {file_path}")
        with_retries(
            action_name=f"rsync_{file_path.name}",
            fn=lambda p=file_path: run_subprocess(
                [
                    "rsync",
                    "-avz",
                    "--progress",
                    str(p),
                    f"{SERVER_HOST}:{SERVER_AUDIO_DIR}",
                ],
                timeout_s=1200,
                stage=f"upload_{p.name}",
            ),
        )


def deploy_server() -> None:
    with_retries(
        action_name="server_deploy",
        fn=lambda: run_subprocess(
            ["ssh", SERVER_HOST, SERVER_DEPLOY_CMD],
            timeout_s=1200,
            stage="deploy_server",
        ),
    )


def verify_production(expected_filenames: list[str]) -> dict[str, Any]:
    with_retries(
        action_name="verify_homepage",
        fn=lambda: run_subprocess(
            ["curl", "-fS", "--max-time", "15", "https://hypnochunk.com"],
            timeout_s=30,
            stage="verify_homepage",
        ),
    )

    api_output = with_retries(
        action_name="verify_api_files",
        fn=lambda: run_subprocess(
            ["curl", "-fS", "--max-time", "20", "https://hypnochunk.com/api/files"],
            timeout_s=40,
            stage="verify_api_files",
        ),
    )
    data = json.loads(api_output)
    names = {item.get("filename") for item in data.get("files", [])}
    missing = [name for name in expected_filenames if name not in names]
    if missing:
        raise RuntimeError(f"Production /api/files missing new outputs: {missing}")
    return {"files_count": len(data.get("files", [])), "verified": expected_filenames}


def run(args: argparse.Namespace) -> None:
    project_root = Path(__file__).resolve().parent.parent
    raw_dir = project_root / "data" / "0_raw_videos"
    output_dir = project_root / "data" / "2_audio_output"
    raw_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    video_info = with_retries("fetch_video_info", lambda: get_video_info(args.url))
    video_id = video_info["id"] or extract_video_id(args.url)
    resolved_display_name = (
        video_info["title"] if args.display_name.strip() in {"", "待定标题"} else args.display_name.strip()
    )
    checkpoint_file = project_root / "pipeline" / "checkpoints" / f"{video_id}.json"
    checkpoint = CheckpointStore(checkpoint_file)

    logger.info("Autopilot target video_id=%s title=%s", video_id, video_info["title"])
    logger.info("Checkpoint file: %s", checkpoint_file)

    downloader = YouTubeDownloader(output_dir=str(raw_dir))
    raw_mp3_path = raw_dir / f"{video_id}.mp3"
    raw_srt_path = raw_dir / f"{video_id}.srt"

    if args.force or not checkpoint.is_done("download_done"):
        with_retries("download_audio", lambda: downloader.download_audio(args.url))
        checkpoint.set_artifact("raw_mp3_path", str(raw_mp3_path))
        checkpoint.mark_done("download_done", "audio downloaded")
    else:
        logger.info("Skipping download_done (already completed)")

    if args.force or not checkpoint.is_done("transcribe_done"):
        transcribe_note = "subtitle/transcription unavailable; fallback direct-audio path"
        try:
            with_retries("download_subtitles", lambda: downloader.download_subtitles(args.url))
            transcribe_note = "subtitles downloaded"
        except Exception as subtitle_error:
            logger.warning("Subtitle download failed: %s", subtitle_error)
            if args.enable_whisper_fallback:
                try:
                    transcriber = AudioTranscriber(model_size=args.whisper_model)
                    with_retries(
                        "whisper_transcribe",
                        lambda: transcriber.transcribe_audio(str(raw_mp3_path)),
                    )
                    transcribe_note = f"whisper transcription done ({args.whisper_model})"
                except Exception as whisper_error:
                    logger.warning("Whisper transcription failed, continuing fallback path: %s", whisper_error)
            else:
                logger.info("Skipping Whisper fallback and continuing direct-audio path.")

        checkpoint.set_artifact("raw_srt_path", str(raw_srt_path))
        checkpoint.mark_done("transcribe_done", transcribe_note)
    else:
        logger.info("Skipping transcribe_done (already completed)")

    if args.force or not checkpoint.is_done("generate_done"):
        if not raw_mp3_path.exists():
            raise FileNotFoundError(f"Raw MP3 not found: {raw_mp3_path}")
        checkpoint.set_artifact("base_audio_path", str(raw_mp3_path))
        checkpoint.mark_done("generate_done", "direct-audio generation path selected")
    else:
        logger.info("Skipping generate_done (already completed)")

    output_files: list[Path]
    if args.force or not checkpoint.is_done("chunk_done"):
        output_files = split_audio_to_chunks(
            source_mp3=raw_mp3_path,
            output_dir=output_dir,
            video_id=video_id,
            max_chunk_minutes=args.max_chunk_minutes,
        )
        checkpoint.set_artifact("output_files", [str(p) for p in output_files])
        checkpoint.mark_done("chunk_done", f"generated {len(output_files)} chunks")
    else:
        output_files = [Path(p) for p in checkpoint.get_artifact("output_files", [])]
        logger.info("Skipping chunk_done (already completed)")
        if not output_files:
            output_files = sorted(output_dir.glob(f"{video_id}_part*_merged_final.mp3"))
            checkpoint.set_artifact("output_files", [str(p) for p in output_files])
        if not output_files:
            raise RuntimeError("No chunk files found after checkpoint resume.")

    output_filenames = [p.name for p in output_files]

    track_names_path = output_dir / "track_names.json"
    mapping_csv_path = output_dir / "output_input_mapping.csv"
    mapping_md_path = output_dir / "output_input_mapping.md"

    if args.force or not checkpoint.is_done("metadata_done"):
        display_entries = update_track_names(
            track_names_path=track_names_path,
            output_files=output_filenames,
            display_name=resolved_display_name,
            category=args.category,
        )
        csv_rows = update_mapping_csv(
            csv_path=mapping_csv_path,
            output_files=output_filenames,
            display_entries=display_entries,
            category=args.category,
            video_id=video_id,
            url=args.url,
            raw_mp3_exists=raw_mp3_path.exists(),
            raw_srt_exists=raw_srt_path.exists(),
        )
        all_rows: list[dict[str, str]] = []
        with open(mapping_csv_path, "r", encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                all_rows.append(row)
        update_mapping_md(mapping_md_path, all_rows)
        checkpoint.set_artifact("metadata_rows_updated", csv_rows)
        checkpoint.mark_done("metadata_done", "track_names and provenance updated")
    else:
        logger.info("Skipping metadata_done (already completed)")

    if args.force or not checkpoint.is_done("upload_done"):
        upload_artifacts(
            output_files=output_files,
            extra_files=[track_names_path, mapping_csv_path, mapping_md_path],
        )
        checkpoint.mark_done("upload_done", "files uploaded to server")
    else:
        logger.info("Skipping upload_done (already completed)")

    if args.force or not checkpoint.is_done("deploy_done"):
        deploy_server()
        checkpoint.mark_done("deploy_done", "server deploy completed")
    else:
        logger.info("Skipping deploy_done (already completed)")

    verification = verify_production(output_filenames)
    checkpoint.set_artifact("production_verification", verification)
    checkpoint.save()

    logger.info("Autopilot completed successfully.")
    logger.info("Generated outputs: %s", output_filenames)
    logger.info("Production verification: %s", verification)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run fully autonomous novel ingestion and publishing autopilot.")
    parser.add_argument("--url", required=True, help="YouTube video URL")
    parser.add_argument("--category", default="小说", help="Category in track_names.json")
    parser.add_argument("--display-name", default="待定标题", help="Track display name base")
    parser.add_argument("--max-chunk-minutes", type=int, default=90, help="Max minutes per output chunk")
    parser.add_argument("--whisper-model", default="base", help="Whisper model size for fallback transcription")
    parser.add_argument(
        "--enable-whisper-fallback",
        action="store_true",
        help="Enable Whisper transcription fallback when subtitle download fails",
    )
    parser.add_argument("--force", action="store_true", help="Force rerun all stages from scratch")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        run(args)
    except Exception as error:
        print("\n=== AUTOPILOT BLOCKER REPORT ===")
        print(f"Error: {error}")
        print("Local artifacts are preserved.")
        print("Resume command:")
        print(
            "python pipeline/run_novel_autopilot.py "
            f"--url \"{args.url}\" --category \"{args.category}\" --display-name \"{args.display_name}\""
        )
        raise


if __name__ == "__main__":
    main()
