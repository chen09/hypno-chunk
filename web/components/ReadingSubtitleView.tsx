'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildBilingualSegments,
  buildBilingualSegmentsFromPairs,
  detectSubtitleLanguage,
  parseSRT,
  segmentContainsEntry,
  type BilingualSubtitlePair,
  type BilingualSegment,
  type SubtitleEntry,
  type SubtitleLanguage,
  type WordEntry,
} from '@/lib/subtitles';

interface ReadingSubtitleViewProps {
  srtPath: string | null;
  currentTime: number;
  bilingual: boolean;
}

function isEntryActive(entry: SubtitleEntry | undefined, currentTime: number): boolean {
  return Boolean(entry && currentTime >= entry.startTime && currentTime < entry.endTime);
}

function lineTone(language: SubtitleLanguage): string {
  if (language === 'zh') return 'reader-line-zh font-medium';
  if (language === 'other') return 'reader-line-other font-semibold uppercase';
  return 'reader-line-en font-semibold';
}

function renderWithSpokenWord(text: string, words: WordEntry[], activeWordIdx: number) {
  if (words.length === 0 || activeWordIdx < 0) return text;
  const tokens = text.match(/\S+/g) ?? [text];

  return (
    <>
      {tokens.map((token, index) => (
        <span key={`${token}-${index}`}>
          {index === activeWordIdx ? (
            <span className="rounded-md bg-cyan-300/95 px-1 text-slate-950 shadow-[0_1px_0_rgba(8,47,73,0.35),0_0_0_1px_rgba(14,116,144,0.22)]">
              {token}
            </span>
          ) : (
            token
          )}
          {index < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

function segmentEntries(segment: BilingualSegment, bilingual: boolean): SubtitleEntry[] {
  if (!bilingual) {
    return [segment.english ?? segment.chinese ?? segment.other].filter(Boolean) as SubtitleEntry[];
  }
  return [segment.english, segment.chinese, segment.other].filter(Boolean) as SubtitleEntry[];
}

export default function ReadingSubtitleView({
  srtPath,
  currentTime,
  bilingual,
}: ReadingSubtitleViewProps) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [bilingualPairs, setBilingualPairs] = useState<BilingualSubtitlePair[]>([]);
  const [wordEntries, setWordEntries] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const segmentRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const lastActiveIndexRef = useRef(-1);

  useEffect(() => {
    if (!srtPath) {
      startTransition(() => {
        setSubtitles([]);
        setBilingualPairs([]);
        setError(null);
      });
      return;
    }

    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    fetch(srtPath)
      .then((res) => {
        if (res.status === 404) return '';
        if (!res.ok) throw new Error(`Failed to load subtitle: ${res.statusText}`);
        return res.text();
      })
      .then((content) => {
        startTransition(() => {
          setSubtitles(content ? parseSRT(content) : []);
          setError(null);
          setLoading(false);
        });
      })
      .catch((err: Error) => {
        startTransition(() => {
          setError(err.message);
          setSubtitles([]);
          setLoading(false);
        });
      });
  }, [srtPath]);

  useEffect(() => {
    startTransition(() => setBilingualPairs([]));
    if (!srtPath) return;
    const bilingualPath = srtPath.replace(/\.srt$/, '.bilingual.json');
    fetch(bilingualPath)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        startTransition(() => {
          setBilingualPairs(Array.isArray(data) ? (data as BilingualSubtitlePair[]) : []);
        });
      })
      .catch(() => {});
  }, [srtPath]);

  useEffect(() => {
    startTransition(() => setWordEntries([]));
    if (!srtPath) return;
    const wordsPath = srtPath.replace(/\.srt$/, '.words.json');
    fetch(wordsPath)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setWordEntries(Array.isArray(data) ? (data as WordEntry[]) : []))
      .catch(() => {});
  }, [srtPath]);

  const segments = useMemo(() => {
    if (bilingualPairs.length > 0) {
      return buildBilingualSegmentsFromPairs(bilingualPairs);
    }
    return buildBilingualSegments(subtitles);
  }, [bilingualPairs, subtitles]);

  const activeEntry = useMemo(() => {
    if (bilingualPairs.length > 0) {
      return (
        segments.find((segment) => currentTime >= segment.startTime && currentTime < segment.endTime)
          ?.english ?? null
      );
    }
    return subtitles.find((sub) => currentTime >= sub.startTime && currentTime < sub.endTime) ?? null;
  }, [bilingualPairs.length, currentTime, segments, subtitles]);

  const activeSegmentIndex = useMemo(() => {
    if (!activeEntry) return -1;
    return segments.findIndex((segment) => segmentContainsEntry(segment, activeEntry));
  }, [activeEntry, segments]);

  useEffect(() => {
    if (activeSegmentIndex < 0 || activeSegmentIndex === lastActiveIndexRef.current) return;
    lastActiveIndexRef.current = activeSegmentIndex;
    const node = segmentRefs.current[activeSegmentIndex];
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeSegmentIndex]);

  const activeWords = useMemo(() => {
    if (!activeEntry || detectSubtitleLanguage(activeEntry.text) !== 'en') {
      return { cueWords: [] as WordEntry[], activeWordIdx: -1 };
    }
    const cueStartMs = activeEntry.startTime * 1000;
    const cueEndMs = activeEntry.endTime * 1000;
    const cueWords = wordEntries.filter((word) => word.start >= cueStartMs && word.start < cueEndMs);
    const nowMs = currentTime * 1000;
    const activeWordIdx = cueWords.findIndex((word) => nowMs >= word.start && nowMs < word.end);
    return { cueWords, activeWordIdx };
  }, [activeEntry, currentTime, wordEntries]);

  if (!srtPath) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        这个音频没有可用字幕。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Loading article subtitles...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-sm text-red-600">
        Subtitle error: {error}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        这个音频暂时没有可阅读的字幕。
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-[760px] px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      <div className="space-y-2 text-[20px] leading-[1.75] sm:text-[22px] sm:leading-[1.85]">
        {segments.map((segment, index) => {
          const isSegmentActive = index === activeSegmentIndex;
          const entries = segmentEntries(segment, bilingual);

          return (
            <div
              key={segment.id}
              ref={(node) => {
                segmentRefs.current[index] = node;
              }}
              className={`relative rounded-lg px-3 py-2 transition-colors duration-200 ${
                isSegmentActive
                  ? 'bg-cyan-100/65'
                  : 'reader-segment-muted hover:bg-white/70'
              }`}
            >
              {isSegmentActive && (
                <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.42)]" />
              )}
              <div className="space-y-1 pl-2">
                {entries.map((entry) => {
                  const language = detectSubtitleLanguage(entry.text);
                  const isActiveLine = isEntryActive(entry, currentTime);
                  const isActiveEnglish = isActiveLine && language === 'en';
                  const isActiveChinese = isActiveLine && language === 'zh';

                  return (
                    <p
                      key={entry.id}
                      className={`break-words [overflow-wrap:anywhere] ${
                        language === 'zh' ? 'text-[16px] leading-[1.65] sm:text-[17px]' : ''
                      } ${lineTone(language)} ${
                        isActiveLine
                          ? ''
                          : ''
                      } ${isActiveChinese ? 'rounded-md bg-cyan-200/65 px-1.5 py-0.5' : ''}`}
                    >
                      {isActiveEnglish
                        ? renderWithSpokenWord(entry.text, activeWords.cueWords, activeWords.activeWordIdx)
                        : entry.text}
                    </p>
                  );
                })}
                {bilingual && segment.chineseTranslation && (
                  <p className="reader-line-zh break-words text-[15px] leading-[1.55] [overflow-wrap:anywhere] sm:text-[16px]">
                    {segment.chineseTranslation}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
