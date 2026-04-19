'use client';

import { startTransition, useState, useEffect } from 'react';

interface SubtitleEntry {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

interface SubtitleDisplayProps {
  srtPath: string | null;
  currentTime: number; // in seconds
}

// Parse SRT file content
function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const id = parseInt(lines[0], 10);
    if (isNaN(id)) continue;

    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!timeMatch) continue;

    const startTime = 
      parseInt(timeMatch[1], 10) * 3600 +
      parseInt(timeMatch[2], 10) * 60 +
      parseInt(timeMatch[3], 10) +
      parseInt(timeMatch[4], 10) / 1000;

    const endTime = 
      parseInt(timeMatch[5], 10) * 3600 +
      parseInt(timeMatch[6], 10) * 60 +
      parseInt(timeMatch[7], 10) +
      parseInt(timeMatch[8], 10) / 1000;

    const text = lines.slice(2).join(' ').trim();

    if (text) {
      entries.push({ id, startTime, endTime, text });
    }
  }

  return entries;
}

export default function SubtitleDisplay({ srtPath, currentTime }: SubtitleDisplayProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load and parse SRT file
  useEffect(() => {
    if (!srtPath) {
      // Reset state when srtPath is cleared
      startTransition(() => {
        setSubtitles([]);
        setCurrentSubtitle(null);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    fetch(srtPath)
      .then((res) => {
        if (res.status === 404) {
          return '';
        }
        if (!res.ok) {
          throw new Error(`Failed to load subtitle: ${res.statusText}`);
        }
        return res.text();
      })
      .then((content) => {
        const parsed = content ? parseSRT(content) : [];
        setSubtitles(parsed);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        setSubtitles([]);
      });
  }, [srtPath]);

  // Find current subtitle based on currentTime
  useEffect(() => {
    if (subtitles.length === 0) {
      startTransition(() => setCurrentSubtitle(null));
      return;
    }

    const active = subtitles.find(
      (sub) => currentTime >= sub.startTime && currentTime < sub.endTime
    );

    startTransition(() => setCurrentSubtitle(active || null));
  }, [currentTime, subtitles]);

  return (
    <div className="px-4 py-6 min-h-[120px] flex items-center justify-center">
      <div className="text-center max-w-2xl w-full">
        {!srtPath ? (
          <div className="text-[var(--text-muted)] text-sm invisible" />
        ) : loading ? (
          <div className="text-[var(--text-muted)] text-sm animate-pulse">
            Loading subtitles...
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400 text-sm">
            Subtitle error: {error}
          </div>
        ) : !currentSubtitle ? (
          <div className="text-[var(--text-muted)] text-sm invisible" />
        ) : (
          <p className="text-base sm:text-lg md:text-xl text-[var(--text)] leading-relaxed">
            {currentSubtitle.text}
          </p>
        )}
      </div>
    </div>
  );
}

