'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Languages, Library, Rows3 } from 'lucide-react';
import AudioPlayer from '@/components/AudioPlayer';
import ReadingSubtitleView from '@/components/ReadingSubtitleView';
import { history } from '@/lib/history';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FileWithDisplayName = {
  filename: string;
  displayName?: string;
  category?: string;
  path: string;
  size: number;
  date: string;
};

function LearnDetailInner() {
  const params = useParams<{ filename: string }>();
  const router = useRouter();
  const filename = typeof params.filename === 'string' ? decodeURIComponent(params.filename) : '';
  const { data, error, isLoading } = useSWR('/api/files', fetcher);
  const files: FileWithDisplayName[] = useMemo(() => data?.files ?? [], [data]);

  const currentIndex = useMemo(
    () => files.findIndex((file) => file.filename === filename),
    [files, filename],
  );
  const currentTrack = currentIndex >= 0 ? files[currentIndex] : null;
  const srtPath = currentTrack
    ? `/audio/${currentTrack.filename.replace(/\.mp3$/i, '.srt')}`
    : null;

  const [currentTime, setCurrentTime] = useState(0);
  const [initialPosition, setInitialPosition] = useState(0);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [bilingual, setBilingual] = useState(false);

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    void (async () => {
      await history.recordPlayStart({
        id: currentTrack.filename,
        path: currentTrack.path,
        displayName: currentTrack.displayName,
        category: currentTrack.category,
      });
      const item = await history.get(currentTrack.filename);
      if (!cancelled) setInitialPosition(item?.position ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  const playbackTrackMeta = useMemo(() => {
    if (!currentTrack) return null;
    return {
      id: currentTrack.filename,
      path: currentTrack.path,
      displayName: currentTrack.displayName,
      category: currentTrack.category,
    };
  }, [currentTrack]);

  usePlaybackProgress(audioEl, playbackTrackMeta);

  const navigateToIndex = useCallback(
    (index: number) => {
      const file = files[index];
      if (!file) return;
      router.push(`/learn/${encodeURIComponent(file.filename)}`);
    },
    [files, router],
  );

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < files.length - 1) {
      navigateToIndex(currentIndex + 1);
    }
  }, [currentIndex, files.length, navigateToIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      navigateToIndex(currentIndex - 1);
    }
  }, [currentIndex, navigateToIndex]);

  const title = currentTrack?.displayName || currentTrack?.filename || 'Reading Detail';

  return (
    <div className="reader-detail-shell min-h-dvh bg-[var(--reader-bg)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-cyan-900/10 bg-[var(--reader-bg)]/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[980px] items-center gap-2 px-3 py-2 sm:px-5">
          <Link
            href="/"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-cyan-100 hover:text-slate-950"
            aria-label="Back to library"
            title="Back to library"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="reader-kicker flex items-center gap-1.5 text-[11px] font-semibold uppercase">
              <Library className="h-3.5 w-3.5" />
              Reading detail
            </p>
            <h1 className="reader-title line-clamp-2-safe text-sm font-semibold leading-tight sm:text-base">
              {title}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setBilingual((value) => !value)}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
              bilingual
                ? 'border-cyan-300 bg-cyan-100 text-cyan-900'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
            aria-pressed={bilingual}
          >
            {bilingual ? <Languages className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
            <span>{bilingual ? '双语' : '英文'}</span>
          </button>
        </div>

        {currentTrack && (
          <div className="mx-auto w-full max-w-[760px] px-2 pb-2 sm:px-3">
            <div className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-[0_8px_24px_rgba(8,47,73,0.10)]">
              <AudioPlayer
                currentTrack={currentTrack}
                onNext={handleNext}
                onPrev={handlePrev}
                onTimeUpdate={setCurrentTime}
                initialPosition={initialPosition}
                onAudioReady={setAudioEl}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex >= 0 && currentIndex < files.length - 1}
                onTrackEnded={handleNext}
                onClose={() => router.push('/')}
              />
            </div>
          </div>
        )}
      </header>

      {isLoading && (
        <main className="py-20 text-center text-sm text-slate-500">
          Loading library...
        </main>
      )}

      {error && (
        <main className="py-20 text-center text-sm text-red-600">
          Failed to load audio files
        </main>
      )}

      {!isLoading && !error && files.length > 0 && !currentTrack && (
        <main className="mx-auto max-w-[680px] px-4 py-20 text-center">
          <p className="text-sm text-slate-500">
            找不到这个音频，可能文件名已经变化。
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
          >
            返回列表
          </Link>
        </main>
      )}

      {currentTrack && (
        <ReadingSubtitleView
          srtPath={srtPath}
          currentTime={currentTime}
          bilingual={bilingual}
        />
      )}
    </div>
  );
}

export default function LearnDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="reader-detail-shell flex min-h-dvh items-center justify-center bg-[var(--reader-bg)] text-slate-500">
          Loading...
        </div>
      }
    >
      <LearnDetailInner />
    </Suspense>
  );
}
