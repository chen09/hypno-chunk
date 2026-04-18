'use client';

import { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import AudioPlayer from '@/components/AudioPlayer';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import ContinueListeningCard, {
  type ContinueListeningSummary,
} from '@/components/ContinueListeningCard';
import { PlayCircle, Play } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gray-50">
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
        className="fixed left-0 right-0 z-[99998] border-b border-gray-200 bg-white"
        style={{ top: `${playerHeight}px`, backgroundColor: '#ffffff' }}
      >
        <div className="mx-auto max-w-3xl">
          <SubtitleDisplay srtPath={srtPath} currentTime={currentTime} />
        </div>
      </div>

      <main
        className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6 md:px-6"
        style={{ paddingTop: `${playerHeight + subtitleHeight + 10}px` }}
      >
        {isLoading && (
          <div className="flex animate-pulse justify-center py-10 text-gray-500">Loading library...</div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">
            Failed to load audio files
          </div>
        )}

        {!isLoading && files.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-500">No audio files found in the library.</div>
        )}

        {!isLoading && files.length > 0 && <ContinueListeningCard summary={continueMeta} onSmartResume={onSmartResume} />}

        {!isLoading &&
          files.length > 0 &&
          (() => {
            const filesByCategory: { [key: string]: { files: FileWithDisplayName[]; indices: number[] } } = {};
            const uncategorized: { files: FileWithDisplayName[]; indices: number[] } = { files: [], indices: [] };

            files.forEach((file: FileWithDisplayName, index: number) => {
              const category = file.category || '未分类';
              if (category === '未分类') {
                uncategorized.files.push(file);
                uncategorized.indices.push(index);
              } else {
                if (!filesByCategory[category]) {
                  filesByCategory[category] = { files: [], indices: [] };
                }
                filesByCategory[category].files.push(file);
                filesByCategory[category].indices.push(index);
              }
            });

            const categoryOrder = ['英语学习', '小说'];
            const sortedCategories = [
              ...categoryOrder.filter((cat) => filesByCategory[cat]),
              ...Object.keys(filesByCategory).filter((cat) => !categoryOrder.includes(cat)),
            ];

            return (
              <div className="space-y-6">
                {sortedCategories.map((category) => {
                  const { files: categoryFiles, indices: categoryIndices } = filesByCategory[category];
                  return (
                    <div key={category} className="space-y-3">
                      <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800">
                        {category}
                        <span className="ml-2 text-sm font-normal text-gray-500">({categoryFiles.length})</span>
                      </h2>
                      <div className="space-y-2">
                        {categoryFiles.map((file: FileWithDisplayName, categoryIndex: number) => {
                          const originalIndex = categoryIndices[categoryIndex];
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
                                  ? 'border border-blue-300 bg-blue-50 shadow-sm shadow-blue-50'
                                  : 'border border-gray-100 bg-white shadow-sm hover:border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                                  isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {isSelected ? (
                                  <Play className="h-5 w-5 fill-white" />
                                ) : (
                                  <PlayCircle className="h-5 w-5" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <h3
                                  className={`truncate text-sm font-medium transition-colors ${
                                    isSelected ? 'font-semibold text-blue-700' : 'text-gray-900'
                                  }`}
                                >
                                  {displayName}
                                </h3>
                                <p
                                  className={`mt-0.5 text-xs transition-colors ${
                                    isSelected ? 'text-blue-600' : 'text-gray-500'
                                  }`}
                                >
                                  {(file.size / 1024 / 1024).toFixed(1)} MB • {new Date(file.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {uncategorized.files.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-800">
                      未分类
                      <span className="ml-2 text-sm font-normal text-gray-500">({uncategorized.files.length})</span>
                    </h2>
                    <div className="space-y-2">
                      {uncategorized.files.map((file: FileWithDisplayName, categoryIndex: number) => {
                        const originalIndex = uncategorized.indices[categoryIndex];
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
                                ? 'border border-blue-300 bg-blue-50 shadow-sm shadow-blue-50'
                                : 'border border-gray-100 bg-white shadow-sm hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div
                              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {isSelected ? (
                                <Play className="h-5 w-5 fill-white" />
                              ) : (
                                <PlayCircle className="h-5 w-5" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3
                                className={`truncate text-sm font-medium transition-colors ${
                                  isSelected ? 'font-semibold text-blue-700' : 'text-gray-900'
                                }`}
                              >
                                {displayName}
                              </h3>
                              <p
                                className={`mt-0.5 text-xs transition-colors ${
                                  isSelected ? 'text-blue-600' : 'text-gray-500'
                                }`}
                              >
                                {(file.size / 1024 / 1024).toFixed(1)} MB • {new Date(file.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">Loading…</div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
