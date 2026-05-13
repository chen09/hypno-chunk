'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { parseSRT, type SubtitleEntry, type WordEntry } from '@/lib/subtitles';

interface SubtitleDisplayProps {
  srtPath: string | null;
  currentTime: number; // in seconds
  trackCategory?: string;
}

type SubtitleMode = 'single' | 'auto' | 'multi';
type SubtitlePosition = 'high' | 'middle' | 'low';

/**
 * Splits `text` into whitespace-delimited tokens and wraps the token at
 * `activeWordIdx` (index into `cueWords`) with a spoken-word marker.
 * Falls back to plain text when no word data is available.
 */
function renderWithWordBox(text: string, cueWords: WordEntry[], activeWordIdx: number) {
  if (cueWords.length === 0) return text;
  const tokens = text.match(/\S+/g) ?? [text];
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i}>
          {i === activeWordIdx ? (
            <span className="rounded-md bg-cyan-300/95 px-1 text-slate-950 shadow-[0_1px_0_rgba(8,47,73,0.35),0_0_0_1px_rgba(14,116,144,0.24)]">
              {token}
            </span>
          ) : (
            token
          )}
          {i < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

export default function SubtitleDisplay({ srtPath, currentTime, trackCategory }: SubtitleDisplayProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState<number>(-1);
  const [lastActiveSubtitleIndex, setLastActiveSubtitleIndex] = useState<number>(-1);
  const [wordEntries, setWordEntries] = useState<WordEntry[]>([]);
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
        setLastActiveSubtitleIndex(-1);
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
        setCurrentSubtitleIndex(-1);
        setLastActiveSubtitleIndex(-1);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        setSubtitles([]);
      });
  }, [srtPath]);

  // Load word-boundary sidecar (.words.json) alongside the SRT.
  // Failures and 404s are silently ignored so older tracks keep working.
  useEffect(() => {
    startTransition(() => setWordEntries([]));
    if (!srtPath) return;
    const wordsPath = srtPath.replace(/\.srt$/, '.words.json');
    fetch(wordsPath)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setWordEntries(Array.isArray(data) ? (data as WordEntry[]) : []))
      .catch(() => {});
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

    startTransition(() => {
      setCurrentSubtitleIndex(activeIndex);
      if (activeIndex >= 0) {
        setLastActiveSubtitleIndex(activeIndex);
      }
    });
  }, [currentTime, subtitles]);

  const currentSubtitle = currentSubtitleIndex >= 0 ? subtitles[currentSubtitleIndex] : null;

  const effectiveMode = useMemo<Exclude<SubtitleMode, 'auto'>>(() => {
    if (mode !== 'auto') return mode;
    const category = trackCategory?.trim() || '';
    if (category.includes('新闻')) return 'multi';

    if (subtitles.length === 0) return 'single';

    const denseCount = subtitles.filter((sub, idx) => {
      if (currentSubtitleIndex >= 0) {
        const pivot = subtitles[currentSubtitleIndex];
        const windowStart = pivot.startTime - 4;
        const windowEnd = pivot.startTime + 8;
        return sub.startTime >= windowStart && sub.startTime <= windowEnd;
      }
      const anchor = lastActiveSubtitleIndex >= 0 ? subtitles[lastActiveSubtitleIndex] : null;
      if (!anchor) return idx < 4;
      const windowStart = anchor.startTime - 4;
      const windowEnd = anchor.startTime + 8;
      return sub.startTime >= windowStart && sub.startTime <= windowEnd;
    }).length;
    if (denseCount >= 4) return 'multi';

    const sample = subtitles.slice(0, Math.min(20, subtitles.length));
    const avgLength =
      sample.length > 0
        ? sample.reduce((acc, sub) => acc + sub.text.length, 0) / sample.length
        : 0;
    return avgLength >= 24 ? 'multi' : 'single';
  }, [mode, trackCategory, subtitles, currentSubtitleIndex, lastActiveSubtitleIndex]);

  const multiScrollAnchorIndex = useMemo(() => {
    if (currentSubtitleIndex >= 0) return currentSubtitleIndex;
    if (lastActiveSubtitleIndex >= 0) return lastActiveSubtitleIndex;
    return subtitles.length > 0 ? 0 : -1;
  }, [currentSubtitleIndex, lastActiveSubtitleIndex, subtitles.length]);

  // cueWords: word entries whose timing falls within the current active cue.
  // activeWordIdx: index (within cueWords) of the word currently being spoken.
  const { cueWords, activeWordIdx } = useMemo(() => {
    if (!currentSubtitle || wordEntries.length === 0) {
      return { cueWords: [] as WordEntry[], activeWordIdx: -1 };
    }
    const cueStartMs = currentSubtitle.startTime * 1000;
    const cueEndMs = currentSubtitle.endTime * 1000;
    const cueWords = wordEntries.filter((w) => w.start >= cueStartMs && w.start < cueEndMs);
    const currentTimeMs = currentTime * 1000;
    const activeWordIdx = cueWords.findIndex((w) => currentTimeMs >= w.start && currentTimeMs < w.end);
    return { cueWords, activeWordIdx };
  }, [currentSubtitle, wordEntries, currentTime]);

  useEffect(() => {
    if (effectiveMode !== 'multi' || subtitles.length === 0 || multiScrollAnchorIndex < 0) return;
    const lineEl = lineRefs.current[multiScrollAnchorIndex];
    if (!lineEl) return;
    lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [effectiveMode, multiScrollAnchorIndex, subtitles.length]);

  const positionOffset = position === 'high' ? -10 : position === 'low' ? 10 : 0;
  const singlePanelClass =
    'w-full min-h-[54px] max-w-full overflow-hidden border-y border-white/30 bg-black px-3 py-2.5 shadow-[0_10px_20px_rgba(0,0,0,0.55)]';
  const multiPanelClass =
    'h-[120px] max-w-full overflow-x-hidden overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left';

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
          <div className={effectiveMode === 'multi' ? multiPanelClass : singlePanelClass}>
            <div className="opacity-0 select-none text-sm" aria-hidden="true">
              subtitle spacer
            </div>
          </div>
        ) : loading ? (
          <div className={effectiveMode === 'multi' ? multiPanelClass : singlePanelClass}>
            <div className="py-2 text-sm text-[var(--text-muted)] animate-pulse">Loading subtitles...</div>
          </div>
        ) : error ? (
          <div className={effectiveMode === 'multi' ? multiPanelClass : singlePanelClass}>
            <div className="py-2 text-sm text-red-500 dark:text-red-400">Subtitle error: {error}</div>
          </div>
        ) : effectiveMode === 'single' ? (
          !currentSubtitle ? (
            <div className={singlePanelClass}>
              <p
                className="mx-auto max-w-[500px] text-center text-[16px] font-semibold leading-relaxed sm:text-[17px] opacity-0 select-none"
                aria-hidden="true"
              >
                subtitle placeholder
              </p>
            </div>
          ) : (
            <div className={singlePanelClass}>
              <p
                className="mx-auto max-w-[500px] text-center text-[16px] font-extrabold leading-relaxed tracking-[0.01em] break-words [overflow-wrap:anywhere] sm:text-[17px]"
                style={{
                  color: '#ffffff',
                  opacity: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,1), 0 0 1px rgba(255,255,255,0.18)',
                }}
              >
                {renderWithWordBox(currentSubtitle.text, cueWords, activeWordIdx)}
              </p>
            </div>
          )
        ) : subtitles.length === 0 ? (
          <div className={multiPanelClass}>
            <div className="opacity-0 select-none text-sm" aria-hidden="true">
              subtitle spacer
            </div>
          </div>
        ) : (
          <div className={multiPanelClass}>
            <div className="space-y-1.5">
              {subtitles.map((sub, idx) => {
                const isActive = idx === currentSubtitleIndex;
                return (
                  <div
                    key={`${sub.id}-${sub.startTime}`}
                    ref={(el) => {
                      lineRefs.current[idx] = el;
                    }}
                    className={`min-w-0 max-w-full overflow-hidden rounded-lg px-2 py-1.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere] transition ${
                      isActive
                        ? 'bg-cyan-50 text-slate-950 shadow-sm ring-1 ring-cyan-300/80 dark:bg-cyan-950/45 dark:text-cyan-50 dark:ring-cyan-700/70'
                        : 'text-[var(--text-muted)] opacity-80'
                    }`}
                  >
                    {isActive
                      ? renderWithWordBox(sub.text, cueWords, activeWordIdx)
                      : sub.text}
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
