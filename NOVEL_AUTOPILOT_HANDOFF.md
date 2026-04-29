# Novel Audio Autopilot Handoff

This document is for handing off a fully automated novel-audio workflow to a new agent.

## Goal

Given one YouTube URL, the next agent should finish all steps end-to-end without manual intervention:

1. Fetch source audio and subtitles/transcript inputs.
2. Produce playable novel audio assets under `data/2_audio_output/`.
3. If the output MP3 is very long (for example ~11 hours), split it into multiple playable chunks.
4. Update playlist metadata and source traceability files.
5. Upload outputs to production server.
6. Verify production health and availability on `https://hypnochunk.com`.

## Current Repository Facts (Important)

- Web API currently lists audio files ending with `_merged_final.mp3` in `data/2_audio_output`.
- Track order/name/category depends on `data/2_audio_output/track_names.json`.
- Data provenance is mandatory:
  - `data/2_audio_output/output_input_mapping.csv`
  - `data/2_audio_output/output_input_mapping.md`
- Production guardrails:
  - Keep app bound to `127.0.0.1:3000` only.
  - Do not weaken Docker hardening/log-rotation settings.

## Copy-Paste Prompt for the Next Agent

Use the prompt below directly with the next agent:

```text
You are working in the HypnoChunk repo at /Volumes/WDC2T/HypnoChunk.

Mission:
Build and execute a zero-manual-intervention pipeline for one novel source URL:
https://www.youtube.com/watch?v=3eRcox-QkKM

Business requirement:
- End-to-end automation only (no manual copy/paste to LLM, no manual upload/deploy).
- Produce final playable audio tracks in the web app.
- If generated or source-derived MP3 is too long (e.g., ~11h), split into chunks automatically (target each chunk <= 90 minutes, keep sequence order in display names).
- Upload to production and verify online availability.
- Full autonomy mode: do not pause for user confirmation during normal execution.

Authorization:
- You are explicitly authorized to execute Git/GitHub release operations autonomously:
  - create/update branch as needed
  - commit
  - push
  - open/merge PR (or direct merge to target branch if repo policy allows)
  - run deployment commands
- Do not wait for human approval between these steps unless a hard blocker occurs (missing credentials, permission denied, or irreversible high-risk action outside normal release flow).

Mandatory constraints:
1) Read and follow AGENTS.md first (SSOT), especially security/deployment guardrails.
2) Do not expose app port publicly; keep loopback-only binding.
3) Keep/update provenance files:
   - data/2_audio_output/output_input_mapping.csv
   - data/2_audio_output/output_input_mapping.md
4) Do not stop at planning. Implement, run, validate, and report final results.

Implementation requirements:
1) Add/extend scripts so the full workflow can run with one command, e.g.:
   python pipeline/run_novel_autopilot.py --url "https://www.youtube.com/watch?v=3eRcox-QkKM" --category "小说" --display-name "待定标题"
2) The automation must include:
   - download/transcribe/split processing
   - JSON generation or direct novel-audio handling (choose robust path based on existing code)
   - final mp3 generation
   - long-mp3 chunking (<=90 min/chunk, deterministic names)
   - track_names.json append/update with ordered chunk entries
   - provenance mapping append/update
   - upload outputs to server path /var/www/hypnochunk/data/2_audio_output/
   - production deployment step if needed
   - post-deploy verification (`/api/files`, homepage reachable, new tracks visible)
3) Ensure idempotency:
   - Safe re-run should not duplicate metadata rows/entries.
4) Add concise docs for how to rerun this autopilot command.

Execution and validation:
- Run lint/build/tests required by touched components.
- Run the autopilot command for the provided URL.
- Show concrete artifacts:
  - output filenames
  - updated track_names entries
  - updated mapping rows
  - upload/deploy command outputs (key lines)
  - health check results

Deliverables:
- Code changes committed in repo.
- Code merged to the release branch (`main`) and pushed to remote.
- A short “operator runbook” section in docs.
- Final summary with risks and next improvements.
```

## Failure Recovery Policy (Required)

The next agent should follow these recovery rules to avoid hanging:

1. Retry strategy:
   - Network/download/API actions: retry up to 3 times with exponential backoff (2s, 5s, 10s).
   - Deployment health checks: retry for up to 5 minutes with short polling.
2. Checkpointing:
   - Persist each major stage result and do not redo completed stages unless `--force` is set.
   - Recommended stage markers:
     - `download_done`
     - `transcribe_done`
     - `generate_done`
     - `chunk_done`
     - `metadata_done`
     - `upload_done`
     - `deploy_done`
3. Idempotent updates:
   - Metadata writes (`track_names.json`, mapping files) must deduplicate by output filename.
   - Re-runs must update existing entries instead of appending duplicates.
4. Timeout and fallback:
   - Long-running single command should use explicit timeout and resume-safe behavior.
   - If Whisper/LLM path fails repeatedly, switch to a direct-audio chunking fallback path and continue publishing.
5. Safe failure boundary:
   - If publish/deploy cannot complete due to hard blockers (credentials/permissions), stop only after:
     - saving all local artifacts
     - printing exact next command for resume
     - emitting a concise blocker report
6. Verification gate:
   - Success is only valid if all are true:
     - expected output files exist
     - metadata/provenance files updated
     - server upload confirmed
     - production `/api/files` includes new entries

## Operator Notes

- If the target content is already a long-form novel MP3 and no language-learning extraction is needed, it is acceptable to keep a direct-audio path as long as output naming and metadata remain compatible with current web listing rules.
- Prefer deterministic chunk naming, for example:
  - `<VIDEO_ID>_part01_merged_final.mp3`
  - `<VIDEO_ID>_part02_merged_final.mp3`
- Keep display names user-friendly, for example:
  - `小说名 - 第1部分`
  - `小说名 - 第2部分`

