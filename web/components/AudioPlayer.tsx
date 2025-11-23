import { useRef, useEffect, useState } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { X } from 'lucide-react';

interface CustomAudioPlayerProps {
  currentTrack: { filename: string; path: string } | null;
  onNext: () => void;
  onPrev: () => void;
  onClose?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export default function CustomAudioPlayer({ currentTrack, onNext, onPrev, onClose, onTimeUpdate }: CustomAudioPlayerProps) {
  const playerRef = useRef<AudioPlayer>(null);
  // Use useState with a function to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted after component mounts on client side
    // This is necessary to avoid hydration mismatch in Next.js
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  console.log("Render AudioPlayer. Mounted:", mounted, "Track:", currentTrack?.filename);

  // Auto-play when track changes
  useEffect(() => {
    if (currentTrack && playerRef.current) {
        console.log("AudioPlayer effect triggered. Setting src:", currentTrack.path);
        
        // Check if the src actually changed to avoid double-loading
        // const audioNode = playerRef.current.audio.current;
        // react-h5-audio-player handles prop changes, but explicit check helps
        
        // Media Session API Setup
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.filename,
                artist: 'HypnoChunk',
                album: 'English Learning',
            });
            
            navigator.mediaSession.setActionHandler('previoustrack', onPrev);
            navigator.mediaSession.setActionHandler('nexttrack', onNext);
        }
    }
  }, [currentTrack, onNext, onPrev]);

  // Listen to audio time updates
  useEffect(() => {
    if (!playerRef.current || !onTimeUpdate || !currentTrack) return;

    let audioElement: HTMLAudioElement | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let handleTimeUpdate: (() => void) | null = null;

    // Wait for audio element to be available
    const setupTimeUpdate = () => {
      audioElement = playerRef.current?.audio?.current || null;
      if (!audioElement) {
        // Retry after a short delay if audio element is not ready
        timeoutId = setTimeout(setupTimeUpdate, 100);
        return;
      }

      handleTimeUpdate = () => {
        if (audioElement) {
          onTimeUpdate(audioElement.currentTime);
        }
      };

      audioElement.addEventListener('timeupdate', handleTimeUpdate);
    };

    setupTimeUpdate();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (audioElement && handleTimeUpdate) {
        audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [currentTrack, onTimeUpdate]);

  // Avoid Hydration Mismatch by only rendering on client
  if (!mounted) return null;

  return (
    <div 
      id="audio-player-container"
      className="fixed top-0 left-0 right-0 bg-white border-b border-blue-200 shadow-md z-[99999]"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: '#ffffff' }}
    >
      
      {/* Custom Header for Title and Close Button */}
      <div className="flex items-center justify-between px-3 sm:px-4 pt-2 sm:pt-3 pb-2">
        <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-blue-900 text-xs sm:text-sm truncate">
                {currentTrack ? currentTrack.filename : "Ready to Play"}
            </h3>
        </div>
        {onClose && (
            <button onClick={onClose} className="p-1 ml-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
        )}
      </div>

      {/* The Player Component */}
      <div className="px-1 sm:px-2 pb-2 sm:pb-3">
        {currentTrack ? (
          <AudioPlayer
              ref={playerRef}
              autoPlay={false}
              src={currentTrack.path}
              onEnded={onNext}
              onClickPrevious={onPrev}
              onClickNext={onNext}
              showSkipControls={true}
              showJumpControls={false}
              layout="stacked-reverse" 
              customAdditionalControls={[]}
              customVolumeControls={[]} 
              showFilledVolume={false}
          />
        ) : (
          <div className="p-4 text-center text-gray-400 text-sm">
              Select a track to start playing...
          </div>
        )}
      </div>
    </div>
  );
}
