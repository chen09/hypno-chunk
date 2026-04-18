# HypnoChunk Project

An English learning audio player and content generation pipeline.

## 📚 Project Status

**Latest Update**: 2025-11-25

- ✅ Successfully processed **EyrscFCoka8** video (1024 common English expressions)
- ✅ Fixed JSON merging to support both semantic modules and common expressions formats
- ✅ Production deployment with Docker and Nginx
- ✅ 10 audio modules available on production server

## ⚠️ Security & Ops Notes (2026-04)

Operational policy is centralized in `AGENTS.md` (single source of truth).

- Incident baseline: runtime container hijack (`xmrig`) and log-growth disk exhaustion once caused 502 outages.
- Mandatory controls: keep port `3000` loopback-only, preserve Docker log rotation and runtime hardening in `docker-compose.yml`.
- Data traceability: keep `data/2_audio_output/output_input_mapping.csv` and `data/2_audio_output/output_input_mapping.md` updated for each output refresh.

Before changing security/ops behavior, update `AGENTS.md` first, then sync brief summaries here.

## CI/CD

This project uses GitHub Actions for CI/CD:
- **CI**: Runs on pull requests to `main` branch (lint, type check, build)
- **CD**: Builds and pushes Docker image to Docker Hub when code is merged to `main`

## Project Structure

This project is organized as a monorepo with the following components:

- **`web/`**: Next.js web application (Frontend)
  - A responsive audio player built with React & Tailwind CSS.
  - Scans `data/2_audio_output` to serve MP3 files.
  - Supports background playback (Media Session API).
  
- **`pipeline/`**: Python Tools (Data Processing)
  - Scripts for downloading videos, extracting audio, and generating learning materials.
  - Supports two JSON formats:
    - **Type 1 (Semantic Modules)**: For learning collocations, phrasal verbs, idioms (includes `module`, `type`, `chinese_meaning`, `examples`)
    - **Type 2 (Common Expressions)**: For learning common English sentences (only `examples` with English and Chinese translation)
  - **Playlist automation workflow** (per-video processing steps):
    1. Run `pipeline/step1_prepare.py <YOUTUBE_URL>` to download MP3, run Whisper transcription with the largest local model, and split the resulting SRT into `<VIDEO_ID>_part*.srt`.
    2. Send each split SRT chunk to the Type 2 prompt (below) to regenerate `data/1_extracted_json/<VIDEO_ID>_part*.json` with English–Chinese pairs; this is handled by the assistant so you don't need to manually forward the prompt.
    3. Run `pipeline/step3_generate.py <VIDEO_ID>` to merge the JSON parts, synthesize new MP3/SRT outputs, and export module JSON for debugging.
    4. Upload `data/2_audio_output/<VIDEO_ID>_merged_final.*` and refresh the `track_names.json` / `data/0_raw_videos/playlist_progress.md` entries for the playlist.

**Type 2 Prompt (Common Expressions)**

> "You are an expert linguist and English teacher. Extract every useful English expression from the provided SRT chunk, deduplicating repeated lines and grouping related dialogue pairs into the same `examples` array. For this video set only `examples` arrays are required; omit `module`, `type`, and `chinese_meaning`. Provide each English sentence with its Chinese translation (treat romanized Chinese as the `cn` value) and return strictly valid JSON with the form `{ "modules": [{ "examples": [ ... ] }] }`. If nothing useful is found in the chunk, return `{ "modules": [] }`."

  
- **`data/`**: Shared Data Directory
  - `0_raw_videos/`: Original video/subtitle files.
  - `1_extracted_json/`: Intermediate JSON data.
  - `2_audio_output/`: Final MP3 files served by the Web App.

## Development

### Web App
```bash
cd web
npm install
npm run dev
# App runs at http://localhost:3000
```

### Pipeline (Python)
```bash
cd pipeline
# Create virtual environment if needed
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Run scripts
python main.py
```

## Deployment (Server)

The server runs Ubuntu 24.04 with Docker and Nginx.

1. **Server Information**:
   - IP: 133.125.45.147
   - Domain: https://hypnochunk.com
   - Path Structure:
     - Web App: Docker container (`chen920/hypnochunk-web:latest`)
     - Data: `/var/www/hypnochunk/data/2_audio_output/`

2. **Deployment Method**:
   - Uses Docker Compose for container management
   - Automatic CI/CD via GitHub Actions
   - Nginx reverse proxy with HTTPS (Let's Encrypt)

3. **Update Procedure**:
   ```bash
   # On server
   cd ~/hypnochunk
   ./deploy.sh
   ```

4. **Upload Audio Files**:
   ```bash
   # From local machine
   rsync -avz --progress data/2_audio_output/*_merged_final.* ubuntu@133.125.45.147:/var/www/hypnochunk/data/2_audio_output/
   rsync -avz --progress data/2_audio_output/track_names.json ubuntu@133.125.45.147:/var/www/hypnochunk/data/2_audio_output/
   ```

## 📖 Documentation

- **AGENTS.md**: Single source of truth for security/ops guardrails and agent handoff
- **DEPLOYMENT.md**: Detailed deployment guide
- **PROMPT_GUIDE.md**: LLM prompt templates for JSON extraction
- **fail2ban/README.md**: Fail2Ban rules, install and operations
- **fail2ban/SUDO_CONFIG.md**: Passwordless sudo setup (standalone topic)
- **web/README.md**: Web app development notes
- **MILESTONE-2025-11-23.md**: Historical deployment milestone (archived)
- **PROGRESS-2025-11-25.md**: Historical progress snapshot (archived)
