# Novel Autopilot Runbook

## One-command execution

```bash
python pipeline/run_novel_autopilot.py \
  --url "https://www.youtube.com/watch?v=3eRcox-QkKM" \
  --category "小说" \
  --display-name "待定标题"
```

## Behavior

- Uses checkpoints in `pipeline/checkpoints/<VIDEO_ID>.json`
- Retries network operations with backoff `2s`, `5s`, `10s`
- Falls back to direct-audio publish path if subtitle/transcription path fails
- Splits long audio into `<= 90` minute chunks named `<VIDEO_ID>_partXX_merged_final.mp3`
- Updates:
  - `data/2_audio_output/track_names.json`
  - `data/2_audio_output/output_input_mapping.csv`
  - `data/2_audio_output/output_input_mapping.md`
- Uploads to `/var/www/hypnochunk/data/2_audio_output/`
- Runs server deploy and verifies:
  - `https://hypnochunk.com`
  - `https://hypnochunk.com/api/files`

## Resume and force

- Resume: rerun the same command (completed stages are skipped)
- Force full rerun:

```bash
python pipeline/run_novel_autopilot.py \
  --url "https://www.youtube.com/watch?v=3eRcox-QkKM" \
  --category "小说" \
  --display-name "待定标题" \
  --force
```

## Troubleshooting from production run

- **Subtitle stage fails repeatedly**
  - Symptom: "Subtitle file not found for video ID ..."
  - Action: continue direct-audio fallback path (default), do not block publishing.

- **Deploy fails with container name conflict**
  - Symptom: `The container name "/hypnochunk-web" is already in use ...`
  - Recovery:

```bash
ssh ubuntu@133.125.45.147 \
  "docker rm -f hypnochunk-web || true && cd ~/hypnochunk && ./deploy.sh"
```

- **Safe resume after partial success**
  - Rerun the same command; checkpoint will skip completed stages (`download_done` ... `upload_done`) and continue.

