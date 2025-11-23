# HypnoChunk Project

An English learning audio player and content generation pipeline.

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
  - Previously located in the root directory.
  
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

The server runs Ubuntu with Nginx.

1. **Path Structure**:
   - Web App: `/var/www/hypnochunk/web`
   - Data: `/var/www/hypnochunk/data`

2. **Nginx Config**:
   - `/` -> Proxied to Next.js (localhost:3000)
   - `/audio/` -> Aliased to `data/2_audio_output/`

3. **Update Procedure**:
   ```bash
   git pull
   cd web
   npm install && npm run build
   pm2 restart next-web
   ```
