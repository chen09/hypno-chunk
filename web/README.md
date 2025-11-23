# Web Player Development

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Fetching**: SWR

## Key Features
- **Auto-Scanning**: The API route `/api/files` dynamically scans the `../data/2_audio_output` directory to list available MP3s.
- **Media Session**: Integrated with `navigator.mediaSession` to support lock-screen controls and background playback on mobile devices.
- **Responsive Design**: Fixed bottom player with scrollable playlist.

## Deployment Notes
- **Nginx Proxy**: 
  - The Next.js app is served via `http://localhost:3000`.
  - Static audio files are served directly by Nginx alias `/audio/` for performance.
- **PM2**: Used to keep the Node.js process running.

## Directory Structure
```
web/
├── app/
│   ├── api/files/route.ts  # Scans ../data folder
│   ├── page.tsx            # Main UI
│   └── globals.css         # Global styles
├── components/
│   └── AudioPlayer.tsx     # Player logic & UI
└── public/                 # Static assets
```
