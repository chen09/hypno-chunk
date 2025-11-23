'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import AudioPlayer from '@/components/AudioPlayer';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import { PlayCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PlayMode = 'normal' | 'repeat-all' | 'repeat-one' | 'shuffle';

export default function Home() {
  const { data, error, isLoading } = useSWR('/api/files', fetcher);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [playerHeight, setPlayerHeight] = useState(180);
  const [subtitleHeight, setSubtitleHeight] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>('normal');
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [shuffleCurrentIndex, setShuffleCurrentIndex] = useState(0);
  const trackItemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const files = data?.files || [];
  
  // Generate shuffled indices when files change or shuffle mode is enabled
  useEffect(() => {
    if (files.length > 0 && playMode === 'shuffle' && shuffledIndices.length === 0) {
      const indices = Array.from({ length: files.length }, (_, i) => i);
      // Fisher-Yates shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShuffledIndices(indices);
      
      // If there's a current track, find its position in the shuffled list
      // This keeps the current track playing when switching to shuffle mode
      if (currentTrackIndex !== null) {
        const currentPos = indices.indexOf(currentTrackIndex);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShuffleCurrentIndex(currentPos !== -1 ? currentPos : 0);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShuffleCurrentIndex(0);
      }
    } else if (playMode !== 'shuffle') {
      // Clear shuffled indices when leaving shuffle mode
      setShuffledIndices([]);
      setShuffleCurrentIndex(0);
    }
  }, [files.length, playMode, currentTrackIndex, shuffledIndices.length]);

  // Get current track based on play mode
  // In shuffle mode, use the shuffled list, but keep current track if shuffle list not ready yet
  const actualTrackIndex = useMemo(() => {
    if (currentTrackIndex === null) return null;
    if (playMode === 'shuffle' && shuffledIndices.length > 0) {
      return shuffledIndices[shuffleCurrentIndex];
    }
    // If shuffle mode but list not ready, or not shuffle mode, use currentTrackIndex
    return currentTrackIndex;
  }, [currentTrackIndex, playMode, shuffledIndices, shuffleCurrentIndex]);

  const currentTrack = actualTrackIndex !== null ? files[actualTrackIndex] : null;
  
  // Calculate if previous/next buttons should be enabled
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
  
  // Generate SRT path from current track filename
  const srtPath = currentTrack 
    ? `/audio/${currentTrack.filename.replace(/\.mp3$/i, '.srt')}`
    : null;

  const playTrack = (index: number) => {
    setCurrentTrackIndex(index);
    // If in shuffle mode, find the position in shuffled list
    if (playMode === 'shuffle' && shuffledIndices.length > 0) {
      const shufflePos = shuffledIndices.indexOf(index);
      if (shufflePos !== -1) {
        setShuffleCurrentIndex(shufflePos);
      }
    }
  };

  const handleNext = () => {
    if (playMode === 'shuffle') {
      const nextShuffleIndex = shuffleCurrentIndex < shuffledIndices.length - 1 
        ? shuffleCurrentIndex + 1 
        : 0;
      setShuffleCurrentIndex(nextShuffleIndex);
      // Update currentTrackIndex to match the actual track being played
      setCurrentTrackIndex(shuffledIndices[nextShuffleIndex]);
    } else {
      if (currentTrackIndex !== null && currentTrackIndex < files.length - 1) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      } else if (playMode === 'repeat-all') {
        setCurrentTrackIndex(0);
      }
    }
  };

  const handlePrev = () => {
    if (playMode === 'shuffle') {
      const prevShuffleIndex = shuffleCurrentIndex > 0 
        ? shuffleCurrentIndex - 1 
        : shuffledIndices.length - 1;
      setShuffleCurrentIndex(prevShuffleIndex);
      // Update currentTrackIndex to match the actual track being played
      setCurrentTrackIndex(shuffledIndices[prevShuffleIndex]);
    } else {
      if (currentTrackIndex !== null && currentTrackIndex > 0) {
        setCurrentTrackIndex(currentTrackIndex - 1);
      } else if (playMode === 'repeat-all') {
        setCurrentTrackIndex(files.length - 1);
      }
    }
  };

  const handleTrackEnded = () => {
    if (playMode === 'repeat-one') {
      // Restart current track
      const audioElement = document.querySelector('audio') as HTMLAudioElement;
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
      }
    } else if (playMode === 'repeat-all') {
      // Go to next, or loop back to first
      if (currentTrackIndex !== null && currentTrackIndex < files.length - 1) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      } else {
        setCurrentTrackIndex(0);
      }
    } else if (playMode === 'shuffle') {
      // Go to next in shuffle, or loop back to first
      const nextShuffleIndex = shuffleCurrentIndex < shuffledIndices.length - 1 
        ? shuffleCurrentIndex + 1 
        : 0;
      setShuffleCurrentIndex(nextShuffleIndex);
      // Update currentTrackIndex to match the actual track being played
      setCurrentTrackIndex(shuffledIndices[nextShuffleIndex]);
    }
    // normal mode: do nothing (stop)
  };

  // Auto-select first track on initial load
  useEffect(() => {
    if (!isLoading && files.length > 0 && currentTrackIndex === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentTrackIndex(0);
    }
  }, [isLoading, files.length, currentTrackIndex]);

  // Dynamically calculate player height
  useEffect(() => {
    const playerContainer = document.getElementById('audio-player-container');
    if (!playerContainer) return;

    const updateHeight = () => {
      const height = playerContainer.offsetHeight;
      setPlayerHeight(height);
    };

    // Initial update
    updateHeight();
    
    // Use multiple timeouts to catch different render phases
    const timers = [
      setTimeout(updateHeight, 50),
      setTimeout(updateHeight, 200),
      setTimeout(updateHeight, 500),
    ];

    // Use ResizeObserver for more accurate height tracking
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(playerContainer);

    // Update on window resize
    window.addEventListener('resize', updateHeight);

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [currentTrack]);

  // Dynamically calculate subtitle height
  useEffect(() => {
    const subtitleContainer = document.getElementById('subtitle-container');
    if (!subtitleContainer) return;

    const updateHeight = () => {
      const height = subtitleContainer.offsetHeight;
      // Add 20px buffer to ensure no overlap
      setSubtitleHeight(height + 20);
    };

    // Initial update
    updateHeight();
    
    // Use multiple timeouts to catch different render phases
    const timers = [
      setTimeout(updateHeight, 50),
      setTimeout(updateHeight, 200),
      setTimeout(updateHeight, 500),
    ];

    // Use ResizeObserver for more accurate height tracking
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });
    resizeObserver.observe(subtitleContainer);

    // Update on window resize
    window.addEventListener('resize', updateHeight);

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [currentTrack, srtPath]);

  // Auto-scroll to selected track
  useEffect(() => {
    if (actualTrackIndex !== null && trackItemRefs.current[actualTrackIndex]) {
      const element = trackItemRefs.current[actualTrackIndex];
      if (element) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }
    }
  }, [actualTrackIndex]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Player - Fixed at top */}
      <AudioPlayer 
        currentTrack={currentTrack} 
        onNext={handleNext} 
        onPrev={handlePrev}
        onTimeUpdate={setCurrentTime}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        playMode={playMode}
        onPlayModeChange={setPlayMode}
        onTrackEnded={handleTrackEnded}
      />
      
      {/* Subtitle Display - Fixed below player */}
      <div 
        id="subtitle-container"
        className="fixed left-0 right-0 bg-white border-b border-gray-200 z-[99998]"
        style={{ top: `${playerHeight}px`, backgroundColor: '#ffffff' }}
      >
        <div className="max-w-3xl mx-auto">
          <SubtitleDisplay srtPath={srtPath} currentTime={currentTime} />
        </div>
      </div>
      
      {/* Track List - Below player and subtitle, scrollable */}
      <main 
        className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6"
        style={{ paddingTop: `${playerHeight + subtitleHeight + 10}px` }}
      >
        {isLoading && (
          <div className="flex justify-center py-10 text-gray-500 animate-pulse">
            Loading library...
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-center text-sm">
            Failed to load audio files
          </div>
        )}

        {!isLoading && files.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm">
            No audio files found in the library.
          </div>
        )}

        <div className="space-y-2">
          {files.map((file: { filename: string; path: string; size: number; date: string }, index: number) => {
            // Use actualTrackIndex for highlighting in shuffle mode
            const isSelected = actualTrackIndex === index;
            return (
            <div 
              key={`${file.filename}-${index}`}
              ref={(el) => {
                trackItemRefs.current[index] = el;
              }}
              onClick={() => playTrack(index)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors active:scale-[0.99]
                ${isSelected
                  ? 'bg-blue-50 border border-blue-100' 
                  : 'bg-white border border-transparent hover:bg-gray-100 border-gray-100 shadow-sm'
                }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}
              `}>
                {isSelected ? (
                  <div className="flex gap-0.5 items-end h-3">
                     <div className="w-0.5 h-2 bg-white animate-pulse"></div>
                     <div className="w-0.5 h-3 bg-white animate-pulse delay-75"></div>
                     <div className="w-0.5 h-1 bg-white animate-pulse delay-150"></div>
                  </div>
                ) : (
                  <PlayCircle className="w-5 h-5" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium text-sm truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  {file.filename}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(1)} MB • {new Date(file.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
