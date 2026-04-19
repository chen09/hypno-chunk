'use client';

import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import AudioPlayer from '@/components/AudioPlayer';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import ContinueListeningCard, {
  type ContinueListeningSummary,
} from '@/components/ContinueListeningCard';
import { BookOpen, Languages, PlayCircle } from 'lucide-react';
import { history } from '@/lib/history';
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PlayMode = 'normal' | 'repeat-all' | 'repeat-one' | 'shuffle';

type FileWithDisplayName = {
  filename: string;
  displayName?: string;
  category?: string;
  path: string;
  size: number;
  date: string;
};

type HomeTab = 'english' | 'novel';

function resolveTabByCategory(category?: string): HomeTab | null {
  const normalized = category?.trim();
  if (!normalized) return null;
  if (normalized.includes('英语')) return 'english';
  if (normalized.includes('小说')) return 'novel';
  return null;
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, error, isLoading } = useSWR('/api/files', fetcher);
  const files: FileWithDisplayName[] = useMemo(() => data?.files ?? [], [data]);

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [initialPosition, setInitialPosition] = useState(0);
  const [playerHeight, setPlayerHeight] = useState(180);
  const [subtitleHeight, setSubtitleHeight] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>('normal');
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [shuffleCurrentIndex, setShuffleCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<HomeTab>('english');
  const trackItemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [continueMeta, setContinueMeta] = useState<ContinueListeningSummary | null>(null);

  const refreshContinueMeta = useCallback(async (list: FileWithDisplayName[]) => {
    const lastId = await history.getLastPlayedId();
    if (!lastId) {
      setContinueMeta(null);
      return;
    }
    const item = await history.get(lastId);
    if (!item) {
      setContinueMeta(null);
      return;
    }
    const f = list.find((x) => x.filename === lastId);
    const title =
      f?.displayName ||
      item.displayName ||
      item.id.replace(/_merged_final\.mp3$/i, '') ||
      item.id;
    setContinueMeta({
      id: lastId,
      title,
      position: item.position,
      duration: item.duration,
      updatedAt: item.updatedAt,
    });
  }, []);

  // Deep-link resume: /?resume=<filename>&smart=1
  useEffect(() => {
    if (isLoading || files.length === 0) return;
    const resume = searchParams.get('resume');
    if (!resume) return;

    let cancelled = false;
    void (async () => {
      const idx = files.findIndex((f) => f.filename === resume);
      if (idx >= 0) {
        const smart = searchParams.get('smart') === '1';
        const item = await history.get(resume);
        let pos = item?.position ?? 0;
        if (smart) pos = Math.max(0, pos - 3);
        if (cancelled) return;
        setInitialPosition(pos);
        setCurrentTrackIndex(idx);
        const tab = resolveTabByCategory(files[idx]?.category);
        if (tab) setActiveTab(tab);
        router.replace('/', { scroll: false });
        await refreshContinueMeta(files);
        return;
      }
      await history.remove(resume);
      if (cancelled) return;
      router.replace('/', { scroll: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, files, searchParams, router, refreshContinueMeta]);

  // Default startup: last played or first file (no ?resume= in URL)
  useEffect(() => {
    if (isLoading || files.length === 0) return;
    if (searchParams.get('resume')) return;
    if (currentTrackIndex !== null) return;

    let cancelled = false;
    void (async () => {
      const lastId = await history.getLastPlayedId();
      if (lastId) {
        const idx = files.findIndex((f) => f.filename === lastId);
        if (idx >= 0) {
          const item = await history.get(lastId);
          if (cancelled) return;
          setInitialPosition(item?.position ?? 0);
          setCurrentTrackIndex(idx);
          const tab = resolveTabByCategory(files[idx]?.category);
          if (tab) setActiveTab(tab);
          await refreshContinueMeta(files);
          return;
        }
        await history.remove(lastId);
      }
      if (cancelled) return;
      setInitialPosition(0);
      setCurrentTrackIndex(0);
      await refreshContinueMeta(files);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, files, searchParams, currentTrackIndex, refreshContinueMeta]);

  // Generate shuffled indices when files change or shuffle mode is enabled
  useEffect(() => {
    if (files.length > 0 && playMode === 'shuffle' && shuffledIndices.length === 0) {
      const indices = Array.from({ length: files.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      startTransition(() => {
        setShuffledIndices(indices);

        if (currentTrackIndex !== null) {
          const currentPos = indices.indexOf(currentTrackIndex);
          setShuffleCurrentIndex(currentPos !== -1 ? currentPos : 0);
        } else {
          setShuffleCurrentIndex(0);
        }
      });
    } else if (playMode !== 'shuffle') {
      startTransition(() => {
        setShuffledIndices([]);
        setShuffleCurrentIndex(0);
      });
    }
  }, [files.length, playMode, currentTrackIndex, shuffledIndices.length]);

  const actualTrackIndex = useMemo(() => {
    if (currentTrackIndex === null) return null;
    if (playMode === 'shuffle' && shuffledIndices.length > 0) {
      return shuffledIndices[shuffleCurrentIndex];
    }
    return currentTrackIndex;
  }, [currentTrackIndex, playMode, shuffledIndices, shuffleCurrentIndex]);

  const currentTrack =
    actualTrackIndex !== null && files[actualTrackIndex] ? files[actualTrackIndex] : null;

  const hasPrevious = useMemo(() => {
    if (actualTrackIndex === null) return false;
    if (playMode === 'shuffle') {
      return shuffledIndices.length > 0 && shuffleCurrentIndex > 0;
    }
    return actualTrackIndex > 0;
  }, [actualTrackIndex, playMode, shuffledIndices, shuffleCurrentIndex]);

  const hasNext = useMemo(() => {
    if (actualTrackIndex === null) return false;
    if (playMode === 'shuffle') {
      return shuffledIndices.length > 0 && shuffleCurrentIndex < shuffledIndices.length - 1;
    }
    return actualTrackIndex < files.length - 1;
  }, [actualTrackIndex, playMode, shuffledIndices, shuffleCurrentIndex, files.length]);

  const srtPath = currentTrack
    ? `/audio/${currentTrack.filename.replace(/\.mp3$/i, '.srt')}`
    : null;

  const applyQueuedIndex = async (index: number) => {
    const file = files[index];
    if (!file) return;
    const h = await history.get(file.filename);
    setInitialPosition(h?.position ?? 0);
    setCurrentTrackIndex(index);
    const tab = resolveTabByCategory(file.category);
    if (tab) setActiveTab(tab);
    await history.setLastPlayedId(file.filename);
  };

  const playTrack = (index: number, opts?: { smartResume?: boolean }) => {
    void (async () => {
      const file = files[index];
      if (!file) return;
      await history.recordPlayStart({
        id: file.filename,
        path: file.path,
        displayName: file.displayName,
        category: file.category,
      });
      const h = await history.get(file.filename);
      const pos = opts?.smartResume ? Math.max(0, (h?.position ?? 0) - 3) : (h?.position ?? 0);
      setInitialPosition(pos);
      setCurrentTrackIndex(index);
      const tab = resolveTabByCategory(file.category);
      if (tab) setActiveTab(tab);
      if (playMode === 'shuffle' && shuffledIndices.length > 0) {
        const shufflePos = shuffledIndices.indexOf(index);
        if (shufflePos !== -1) {
          setShuffleCurrentIndex(shufflePos);
        }
      }
      await refreshContinueMeta(files);
    })();
  };

  const handleNext = () => {
    if (playMode === 'shuffle') {
      void (async () => {
        const nextShuffleIndex =
          shuffleCurrentIndex < shuffledIndices.length - 1 ? shuffleCurrentIndex + 1 : 0;
        const newIdx = shuffledIndices[nextShuffleIndex];
        await applyQueuedIndex(newIdx);
        setShuffleCurrentIndex(nextShuffleIndex);
      })();
      return;
    }
    if (currentTrackIndex !== null && currentTrackIndex < files.length - 1) {
      void applyQueuedIndex(currentTrackIndex + 1);
    } else if (playMode === 'repeat-all') {
      void applyQueuedIndex(0);
    }
  };

  const handlePrev = () => {
    if (playMode === 'shuffle') {
      void (async () => {
        const prevShuffleIndex =
          shuffleCurrentIndex > 0 ? shuffleCurrentIndex - 1 : shuffledIndices.length - 1;
        const newIdx = shuffledIndices[prevShuffleIndex];
        await applyQueuedIndex(newIdx);
        setShuffleCurrentIndex(prevShuffleIndex);
      })();
      return;
    }
    if (currentTrackIndex !== null && currentTrackIndex > 0) {
      void applyQueuedIndex(currentTrackIndex - 1);
    } else if (playMode === 'repeat-all') {
      void applyQueuedIndex(files.length - 1);
    }
  };

  const handleTrackEnded = () => {
    if (playMode === 'repeat-one') {
      const audioElement = document.querySelector('audio') as HTMLAudioElement;
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
      }
    } else if (playMode === 'repeat-all') {
      if (currentTrackIndex !== null && currentTrackIndex < files.length - 1) {
        void applyQueuedIndex(currentTrackIndex + 1);
      } else {
        void applyQueuedIndex(0);
      }
    } else if (playMode === 'shuffle') {
      void (async () => {
        const nextShuffleIndex =
          shuffleCurrentIndex < shuffledIndices.length - 1 ? shuffleCurrentIndex + 1 : 0;
        const newIdx = shuffledIndices[nextShuffleIndex];
        await applyQueuedIndex(newIdx);
        setShuffleCurrentIndex(nextShuffleIndex);
      })();
    }
  };

  const handleAudioReady = useCallback((el: HTMLAudioElement | null) => {
    setAudioEl(el);
  }, []);

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

  useEffect(() => {
    const playerContainer = document.getElementById('audio-player-container');
    if (!playerContainer) return;

    const updateHeight = () => {
      const height = playerContainer.offsetHeight;
      setPlayerHeight(height);
    };

    updateHeight();
    const timers = [setTimeout(updateHeight, 50), setTimeout(updateHeight, 200), setTimeout(updateHeight, 500)];
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(playerContainer);
    window.addEventListener('resize', updateHeight);

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [currentTrack]);

  useEffect(() => {
    const subtitleContainer = document.getElementById('subtitle-container');
    if (!subtitleContainer) return;

    const updateHeight = () => {
      const height = subtitleContainer.offsetHeight;
      setSubtitleHeight(height + 20);
    };

    updateHeight();
    const timers = [setTimeout(updateHeight, 50), setTimeout(updateHeight, 200), setTimeout(updateHeight, 500)];
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(subtitleContainer);
    window.addEventListener('resize', updateHeight);

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [currentTrack, srtPath]);

  useEffect(() => {
    if (actualTrackIndex !== null && trackItemRefs.current[actualTrackIndex]) {
      const element = trackItemRefs.current[actualTrackIndex];
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }, 100);
      }
    }
  }, [actualTrackIndex]);

  const onSmartResume = () => {
    if (!continueMeta) return;
    const idx = files.findIndex((f) => f.filename === continueMeta.id);
    if (idx < 0) return;
    playTrack(idx, { smartResume: true });
  };

  const categorizedEntries = useMemo(() => {
    return files.map((file, index) => ({ file, index }));
  }, [files]);

  const englishEntries = useMemo(
    () =>
      categorizedEntries.filter(
        ({ file }) => resolveTabByCategory(file.category) === 'english',
      ),
    [categorizedEntries],
  );
  const novelEntries = useMemo(
    () =>
      categorizedEntries.filter(
        ({ file }) => resolveTabByCategory(file.category) === 'novel',
      ),
    [categorizedEntries],
  );
  const otherEntries = useMemo(
    () =>
      categorizedEntries.filter(
        ({ file }) => resolveTabByCategory(file.category) === null,
      ),
    [categorizedEntries],
  );

  const activeEntries = activeTab === 'english' ? englishEntries : novelEntries;

  const renderTrackCard = (file: FileWithDisplayName, originalIndex: number) => {
    const isSelected = actualTrackIndex === originalIndex;
    const displayName = file.displayName || file.filename.replace('_merged_final.mp3', '');

    return (
      <div
        key={`${file.filename}-${originalIndex}`}
        ref={(el) => {
          trackItemRefs.current[originalIndex] = el;
        }}
        onClick={() => playTrack(originalIndex)}
        className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all duration-200 active:scale-[0.99] ${
          isSelected
            ? 'border border-blue-300 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-950/20 shadow-sm'
            : 'border border-[var(--border)] bg-[var(--surface-card)] shadow-sm hover:border-gray-200 dark:hover:border-slate-600/60 hover:bg-gray-50 dark:hover:bg-[#1a2440]'
        }`}
      >
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
            isSelected
              ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'bg-[var(--border)] dark:bg-slate-800 text-[var(--text-muted)]'
          }`}
        >
          {isSelected ? (
            <span className="flex items-end gap-0.5 justify-center h-5 w-5">
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
            </span>
          ) : (
            <PlayCircle className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-sm font-medium transition-colors ${
              isSelected ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-[var(--text)]'
            }`}
          >
            {displayName}
          </h3>
          <p
            className={`mt-0.5 text-xs transition-colors ${
              isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-[var(--text-muted)]'
            }`}
          >
            {(file.size / 1024 / 1024).toFixed(1)} MB • {new Date(file.date).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--surface-muted)]">
      <AudioPlayer
        currentTrack={currentTrack}
        onNext={handleNext}
        onPrev={handlePrev}
        onTimeUpdate={setCurrentTime}
        initialPosition={initialPosition}
        onAudioReady={handleAudioReady}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        playMode={playMode}
        onPlayModeChange={setPlayMode}
        onTrackEnded={handleTrackEnded}
      />

      <div
        id="subtitle-container"
        className="fixed left-0 right-0 z-[99998]"
        style={{ top: `${playerHeight}px` }}
      >
        <div className="mx-auto max-w-3xl">
          <SubtitleDisplay srtPath={srtPath} currentTime={currentTime} />
        </div>
      </div>

      <main
        className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 md:px-6"
        style={{ paddingTop: `${playerHeight + subtitleHeight + 10}px`, paddingBottom: '132px' }}
      >
        {isLoading && (
          <div className="flex animate-pulse justify-center py-10 text-[var(--text-muted)]">Loading library...</div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4 text-center text-sm text-red-600 dark:text-red-400">
            Failed to load audio files
          </div>
        )}

        {!isLoading && files.length === 0 && (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">No audio files found in the library.</div>
        )}

        {!isLoading && files.length > 0 && <ContinueListeningCard summary={continueMeta} onSmartResume={onSmartResume} />}

        {!isLoading && files.length > 0 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="border-b border-[var(--border)] pb-2 text-lg font-semibold text-[var(--text)]">
                {activeTab === 'english' ? '英语学习' : '小说'}
                <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({activeEntries.length})</span>
              </h2>
              {activeEntries.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-3">这个分类还没有音频。</p>
              ) : (
                <div className="space-y-2">
                  {activeEntries.map(({ file, index }) => renderTrackCard(file, index))}
                </div>
              )}
            </div>

            {otherEntries.length > 0 && (
              <div className="space-y-3">
                <h2 className="border-b border-[var(--border)] pb-2 text-lg font-semibold text-[var(--text)]">
                  其他内容
                  <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({otherEntries.length})</span>
                </h2>
                <div className="space-y-2">
                  {otherEntries.map(({ file, index }) => renderTrackCard(file, index))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {!isLoading && files.length > 0 && (
        <div
          className="fixed inset-x-0 z-[100000] pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
        >
          <div className="mx-auto max-w-3xl px-3 sm:px-4">
            <div className="pointer-events-auto grid grid-cols-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]/95 backdrop-blur-xl p-1.5 shadow-xl shadow-black/20">
              <button
                type="button"
                onClick={() => setActiveTab('english')}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'english'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Languages className="h-4 w-4" />
                英语学习
                <span className="text-xs opacity-80">({englishEntries.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('novel')}
                className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold rounded-xl transition ${
                  activeTab === 'novel'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                小说
                <span className="text-xs opacity-80">({novelEntries.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--surface-muted)] text-[var(--text-muted)]">Loading…</div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
