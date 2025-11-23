'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AudioPlayer from '@/components/AudioPlayer';
import SubtitleDisplay from '@/components/SubtitleDisplay';
import { PlayCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const { data, error, isLoading } = useSWR('/api/files', fetcher);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [playerHeight, setPlayerHeight] = useState(180);
  const [subtitleHeight, setSubtitleHeight] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);

  const files = data?.files || [];
  const currentTrack = currentTrackIndex !== null ? files[currentTrackIndex] : null;
  
  // Generate SRT path from current track filename
  const srtPath = currentTrack 
    ? `/audio/${currentTrack.filename.replace(/\.mp3$/i, '.srt')}`
    : null;

  const playTrack = (index: number) => {
    setCurrentTrackIndex(index);
  };

  const handleNext = () => {
    if (currentTrackIndex !== null && currentTrackIndex < files.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentTrackIndex !== null && currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Player - Fixed at top */}
      <AudioPlayer 
        currentTrack={currentTrack} 
        onNext={handleNext} 
        onPrev={handlePrev}
        onTimeUpdate={setCurrentTime}
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
          {files.map((file: { filename: string; path: string; size: number; date: string }, index: number) => (
            <div 
              key={`${file.filename}-${index}`}
              onClick={() => playTrack(index)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors active:scale-[0.99]
                ${currentTrackIndex === index 
                  ? 'bg-blue-50 border border-blue-100' 
                  : 'bg-white border border-transparent hover:bg-gray-100 border-gray-100 shadow-sm'
                }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${currentTrackIndex === index ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}
              `}>
                {currentTrackIndex === index ? (
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
                <h3 className={`font-medium text-sm truncate ${currentTrackIndex === index ? 'text-blue-900' : 'text-gray-900'}`}>
                  {file.filename}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(1)} MB • {new Date(file.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
