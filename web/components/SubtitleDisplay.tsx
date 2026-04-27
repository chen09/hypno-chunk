'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

interface SubtitleEntry {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

interface SubtitleDisplayProps {
  srtPath: string | null;
  currentTime: number; // in seconds
  trackCategory?: string;
}

type SubtitleMode = 'single' | 'auto' | 'multi';
type SubtitlePosition = 'high' | 'middle' | 'low';

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

export default function SubtitleDisplay({ srtPath, currentTime, trackCategory }: SubtitleDisplayProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SubtitleMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    const savedMode = window.localStorage.getItem('hypnochunk.subtitle.mode') as SubtitleMode | null;
    return savedMode === 'single' || savedMode === 'auto' || savedMode === 'multi'
      ? savedMode
      : 'auto';
  });
  const [position, setPosition] = useState<SubtitlePosition>(() => {
    if (typeof window === 'undefined') return 'middle';
    const savedPosition = window.localStorage.getItem(
      'hypnochunk.subtitle.position',
    ) as SubtitlePosition | null;
    return savedPosition === 'high' || savedPosition === 'middle' || savedPosition === 'low'
      ? savedPosition
      : 'middle';
  });
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    window.localStorage.setItem('hypnochunk.subtitle.mode', mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem('hypnochunk.subtitle.position', position);
  }, [position]);

  // Load and parse SRT file
  useEffect(() => {
    if (!srtPath) {
      // Reset state when srtPath is cleared
      startTransition(() => {
        setSubtitles([]);
        setCurrentSubtitleIndex(-1);
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

  // Find current subtitle index based on currentTime
  useEffect(() => {
    if (subtitles.length === 0) {
      startTransition(() => setCurrentSubtitleIndex(-1));
      return;
    }

    const activeIndex = subtitles.findIndex(
      (sub) => currentTime >= sub.startTime && currentTime < sub.endTime
    );

    startTransition(() => setCurrentSubtitleIndex(activeIndex));
  }, [currentTime, subtitles]);

  const currentSubtitle = currentSubtitleIndex >= 0 ? subtitles[currentSubtitleIndex] : null;

  const effectiveMode = useMemo<Exclude<SubtitleMode, 'auto'>>(() => {
    if (mode !== 'auto') return mode;
    const category = trackCategory?.trim() || '';
    if (category.includes('新闻')) return 'multi';
    if (!currentSubtitle) return 'single';
    if (currentSubtitle.text.length >= 34) return 'multi';

    const denseCount = subtitles.filter(
      (sub) => sub.startTime >= currentTime && sub.startTime < currentTime + 8,
    ).length;
    if (denseCount >= 4) return 'multi';

    const sample = subtitles.slice(0, Math.min(20, subtitles.length));
    const avgLength =
      sample.length > 0
        ? sample.reduce((acc, sub) => acc + sub.text.length, 0) / sample.length
        : 0;
    return avgLength >= 24 ? 'multi' : 'single';
  }, [mode, trackCategory, currentSubtitle, subtitles, currentTime]);

  useEffect(() => {
    if (effectiveMode !== 'multi' || currentSubtitleIndex < 0) return;
    const lineEl = lineRefs.current[currentSubtitleIndex];
    if (!lineEl) return;
    lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [effectiveMode, currentSubtitleIndex]);

  const positionOffset = position === 'high' ? -10 : position === 'low' ? 10 : 0;

  return (
    <div className="w-full border-t border-[var(--player-border)] bg-[var(--surface-card)] px-2 pb-2 pt-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
          {(['single', 'auto', 'multi'] as SubtitleMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                mode === item
                  ? 'bg-[var(--surface-card)] text-[#007aff] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {item === 'single' ? '单行' : item === 'multi' ? '多行' : '自动'}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-0.5">
          {([
            ['high', '高'],
            ['middle', '中'],
            ['low', '低'],
          ] as Array<[SubtitlePosition, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPosition(value)}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                position === value
                  ? 'bg-[var(--surface-card)] text-[#007aff] shadow-sm'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full text-center" style={{ transform: `translateY(${positionOffset}px)` }}>
        {!srtPath ? (
          <div className="text-[var(--text-muted)] text-sm invisible" />
        ) : loading ? (
          <div className="py-2 text-sm text-[var(--text-muted)] animate-pulse">
            Loading subtitles...
          </div>
        ) : error ? (
          <div className="py-2 text-sm text-red-500 dark:text-red-400">
            Subtitle error: {error}
          </div>
        ) : effectiveMode === 'single' ? (
          !currentSubtitle ? (
            <div className="text-[var(--text-muted)] text-sm invisible" />
          ) : (
            <div className="w-full border-y border-white/30 bg-black px-3 py-2.5 shadow-[0_10px_20px_rgba(0,0,0,0.55)]">
              <p
                className="mx-auto max-w-[500px] text-center text-[16px] font-extrabold leading-relaxed tracking-[0.01em] sm:text-[17px]"
                style={{
                  color: '#ffffff',
                  opacity: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,1), 0 0 1px rgba(255,255,255,0.18)',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {currentSubtitle.text}
              </p>
            </div>
          )
        ) : subtitles.length === 0 ? (
          <div className="text-[var(--text-muted)] text-sm invisible" />
        ) : (
          <div className="h-[120px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left">
            <div className="space-y-1.5">
              {subtitles.map((sub, idx) => {
                const isActive = idx === currentSubtitleIndex;
                return (
                  <div
                    key={`${sub.id}-${sub.startTime}`}
                    ref={(el) => {
                      lineRefs.current[idx] = el;
                    }}
                    className={`rounded-lg px-2 py-1.5 text-sm leading-relaxed transition ${
                      isActive
                        ? 'bg-black text-white shadow-md shadow-black/30'
                        : 'text-[var(--text-muted)] opacity-80'
                    }`}
                  >
                    {sub.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {mode === 'auto' && (
        <p className="mt-1 px-1 text-left text-[10px] text-[var(--text-muted)]">
          自动模式当前为：{effectiveMode === 'multi' ? '多行滚动' : '单行聚焦'}
        </p>
      )}
    </div>
  );
}

