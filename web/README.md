# Web Player Development

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **React**: 19
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Data Fetching**: SWR
- **Audio**: react-h5-audio-player

## Key Features
- **Auto-Scanning**: The API route `/api/files` dynamically scans the audio directory (`AUDIO_DIR`, default `../data/2_audio_output`) to list available MP3s.
- **Streaming**: `/api/audio/[...path]` streams audio with HTTP Range support.
- **Media Session**: Integrated with `navigator.mediaSession` for lock-screen controls and background playback on mobile.
- **Responsive Design**: Fixed header player with scrollable playlist.

## Local Development
```bash
cd web
npm install
npm run dev
# http://localhost:3000
```

## Production Deployment (Reference Only)

The production deployment is handled by Docker + Nginx. See the repo-level `DEPLOYMENT.md` and `docker-compose.yml`.

Operational and security guardrails live in `AGENTS.md` (single source of truth). Key points:

- App container binds to `127.0.0.1:3000` (loopback only). Nginx is the public entrypoint.
- Docker log rotation, `read_only`, `cap_drop`, `security_opt` and resource limits must stay enabled.

## Directory Structure
```
web/
├── app/
│   ├── api/
│   │   ├── files/route.ts       # Lists available audio files
│   │   └── audio/[...path]/     # Streams audio with Range support
│   ├── page.tsx                 # Main UI
│   └── globals.css              # Global styles
├── components/
│   └── AudioPlayer.tsx          # Player logic & UI
├── Dockerfile                   # Multi-stage build (Next.js standalone)
└── public/                      # Static assets
```
