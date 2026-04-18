import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import ReactH5AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import { History, Repeat, Repeat1, Shuffle, X } from 'lucide-react';

type PlayMode = 'normal' | 'repeat-all' | 'repeat-one' | 'shuffle';

interface CustomAudioPlayerProps {
  currentTrack: {
    filename: string;
    path: string;
    displayName?: string;
    category?: string;
  } | null;
  onNext: () => void;
  onPrev: () => void;
  onClose?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  /** Seek to this time (seconds) once metadata is ready for the current track */
  initialPosition?: number | null;
  /** Notifies when the underlying `<audio>` element is available (or null when detached) */
  onAudioReady?: (audio: HTMLAudioElement | null) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  playMode?: PlayMode;
  onPlayModeChange?: (mode: PlayMode) => void;
  onTrackEnded?: () => void;
}

export default function CustomAudioPlayer({
  currentTrack,
  onNext,
  onPrev,
  onClose,
  onTimeUpdate,
  initialPosition = null,
  onAudioReady,
  hasPrevious = false,
  hasNext = false,
  playMode = 'normal',
  onPlayModeChange,
  onTrackEnded,
}: CustomAudioPlayerProps) {
  const playerRef = useRef<InstanceType<typeof ReactH5AudioPlayer> | null>(null);
  // Use useState with a function to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  // Track playing state to auto-play when switching tracks
  const [wasPlaying, setWasPlaying] = useState(false);
  const previousTrackRef = useRef<string | null>(null);
  const seekAppliedForPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Set mounted after component mounts on client side
    // This is necessary to avoid hydration mismatch in Next.js
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!currentTrack?.filename) {
      seekAppliedForPathRef.current = null;
    }
  }, [currentTrack?.filename]);

  // Track playing state
  useEffect(() => {
    if (!playerRef.current || !currentTrack) return;

    const audioElement = playerRef.current.audio?.current;
    if (!audioElement) return;

    const handlePlay = () => {
      setWasPlaying(true);
    };

    const handlePause = () => {
      setWasPlaying(false);
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
    };
  }, [currentTrack]);

  // Auto-play when track changes if was playing before
  useEffect(() => {
    if (!currentTrack || !playerRef.current) return;

    const trackChanged = previousTrackRef.current !== currentTrack.path;
    const shouldAutoPlay = trackChanged && wasPlaying;
    previousTrackRef.current = currentTrack.path;

    if (shouldAutoPlay) {
      // Wait for audio element to be ready, then play
      const tryPlay = () => {
        const audioElement = playerRef.current?.audio?.current;
        if (audioElement) {
          if (audioElement.readyState >= 2) {
            // Already loaded enough to play
            audioElement.play().catch((err) => {
              console.log('Auto-play prevented:', err);
            });
          } else {
            // Wait for canplay event
            const handleCanPlay = () => {
              audioElement.play().catch((err) => {
                console.log('Auto-play prevented:', err);
              });
              audioElement.removeEventListener('canplay', handleCanPlay);
            };
            audioElement.addEventListener('canplay', handleCanPlay);
            return () => {
              audioElement.removeEventListener('canplay', handleCanPlay);
            };
          }
        }
      };

      // Try immediately and also after a delay
      tryPlay();
      const timer = setTimeout(tryPlay, 200);
      return () => clearTimeout(timer);
    }

    // Media Session API Setup
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.displayName || currentTrack.filename,
        artist: 'HypnoChunk',
        album: currentTrack.category || 'HypnoChunk',
      });
      
      navigator.mediaSession.setActionHandler('previoustrack', onPrev);
      navigator.mediaSession.setActionHandler('nexttrack', onNext);
    }
  }, [currentTrack, wasPlaying, onNext, onPrev]);

  // Resume playback position once per track load
  useEffect(() => {
    if (!mounted || !currentTrack) return;
    if (initialPosition === null || initialPosition === undefined) return;

    const pathKey = currentTrack.filename;
    seekAppliedForPathRef.current = null;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryBind = () => {
      const audioElement = playerRef.current?.audio?.current;
      if (!audioElement) return null;

      const applySeek = () => {
        if (cancelled) return;
        if (seekAppliedForPathRef.current === pathKey) return;
        if (audioElement.readyState < HTMLMediaElement.HAVE_METADATA) return;
        audioElement.currentTime = Math.max(0, initialPosition);
        seekAppliedForPathRef.current = pathKey;
      };

      const onLoaded = () => {
        applySeek();
      };

      audioElement.addEventListener('loadedmetadata', onLoaded);
      applySeek();

      return () => {
        audioElement.removeEventListener('loadedmetadata', onLoaded);
      };
    };

    const setup = () => {
      if (cancelled) return;
      cleanup?.();
      cleanup = tryBind() ?? null;
      if (!cleanup && !cancelled) {
        timeoutId = setTimeout(setup, 50);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      cleanup?.();
    };
  }, [mounted, currentTrack, initialPosition]);

  // Expose underlying <audio> for progress persistence
  useEffect(() => {
    if (!mounted || !currentTrack) {
      onAudioReady?.(null);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      const el = playerRef.current?.audio?.current ?? null;
      onAudioReady?.(el);
      if (!el && !cancelled) {
        timeoutId = setTimeout(tick, 50);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      onAudioReady?.(null);
    };
  }, [mounted, currentTrack, onAudioReady]);

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

  // Control button states based on hasPrevious/hasNext
  useEffect(() => {
    if (!mounted || !currentTrack) return;

    const updateButtonStates = () => {
      // Try multiple ways to find the container
      const container = 
        playerRef.current?.audio?.current?.closest('.rhap_container') ||
        document.querySelector('.rhap_container');
      
      if (!container) return;

      // Find buttons - try multiple selectors
      const prevButton = container.querySelector(
        '.rhap_skip-button[aria-label*="Previous"], .rhap_skip-button[aria-label*="上一"], .rhap_button-clear:first-of-type'
      ) as HTMLElement;
      
      const nextButton = container.querySelector(
        '.rhap_skip-button[aria-label*="Next"], .rhap_skip-button[aria-label*="下一"], .rhap_button-clear:last-of-type'
      ) as HTMLElement;

      // Alternative: find by position (previous is usually first skip button, next is last)
      const allSkipButtons = container.querySelectorAll('.rhap_skip-button') as NodeListOf<HTMLElement>;
      const prevBtn = allSkipButtons[0];
      const nextBtn = allSkipButtons[allSkipButtons.length - 1];

      const finalPrevButton = prevButton || prevBtn;
      const finalNextButton = nextButton || nextBtn;

      if (finalPrevButton) {
        if (hasPrevious) {
          finalPrevButton.style.opacity = '1';
          finalPrevButton.style.cursor = 'pointer';
          finalPrevButton.style.pointerEvents = 'auto';
          finalPrevButton.removeAttribute('data-disabled');
        } else {
          finalPrevButton.style.opacity = '0.3';
          finalPrevButton.style.cursor = 'not-allowed';
          finalPrevButton.style.pointerEvents = 'none';
          finalPrevButton.setAttribute('data-disabled', 'true');
        }
      }

      if (finalNextButton) {
        if (hasNext) {
          finalNextButton.style.opacity = '1';
          finalNextButton.style.cursor = 'pointer';
          finalNextButton.style.pointerEvents = 'auto';
          finalNextButton.removeAttribute('data-disabled');
        } else {
          finalNextButton.style.opacity = '0.3';
          finalNextButton.style.cursor = 'not-allowed';
          finalNextButton.style.pointerEvents = 'none';
          finalNextButton.setAttribute('data-disabled', 'true');
        }
      }
    };

    // Wait for player to render, try multiple times
    const timers = [
      setTimeout(updateButtonStates, 50),
      setTimeout(updateButtonStates, 200),
      setTimeout(updateButtonStates, 500),
      setTimeout(updateButtonStates, 1000),
    ];
    updateButtonStates();

    // Also use MutationObserver to catch when buttons are added
    const observer = new MutationObserver(updateButtonStates);
    const container = document.querySelector('.rhap_container');
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      observer.disconnect();
    };
  }, [mounted, hasPrevious, hasNext, currentTrack]);

  // Override jump buttons to use 10 seconds interval
  useEffect(() => {
    if (!mounted || !currentTrack || !playerRef.current) return;

    const setupJumpButtons = () => {
      const audioElement = playerRef.current?.audio?.current;
      if (!audioElement) return;

      const container = audioElement.closest('.rhap_container');
      if (!container) return;

      // Find jump buttons
      const jumpButtons = container.querySelectorAll('.rhap_jump-button');
      jumpButtons.forEach((button) => {
        const btn = button as HTMLElement;

        // Check if it's rewind or forward by checking aria-label or class
        const isRewind = btn.getAttribute('aria-label')?.toLowerCase().includes('rewind') ||
                         btn.classList.contains('rhap_rewind-button') ||
                         btn.querySelector('.rhap_rewind-button') !== null;
        
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (isRewind) {
            audioElement.currentTime = Math.max(0, audioElement.currentTime - 10);
          } else {
            const duration = audioElement.duration || 0;
            audioElement.currentTime = Math.min(duration, audioElement.currentTime + 10);
          }
        };
      });
    };

    // Wait for buttons to render
    const timers = [
      setTimeout(setupJumpButtons, 100),
      setTimeout(setupJumpButtons, 300),
      setTimeout(setupJumpButtons, 500),
    ];

    // Also observe for button changes
    const container = playerRef.current?.audio?.current?.closest('.rhap_container');
    if (container) {
      const observer = new MutationObserver(setupJumpButtons);
      observer.observe(container, { childList: true, subtree: true });
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
        observer.disconnect();
      };
    }

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [mounted, currentTrack]);

  // Avoid Hydration Mismatch by only rendering on client
  if (!mounted) return null;

  return (
    <div 
      id="audio-player-container"
      className="fixed top-0 left-0 right-0 bg-white border-b border-blue-200 shadow-md z-[99999]"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: '#ffffff' }}
    >
      
      {/* Custom Header for Title and Close Button */}
      <div className="flex items-center justify-between px-3 sm:px-4 pt-2 sm:pt-3 pb-2 gap-2">
        <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-blue-900 text-xs sm:text-sm truncate">
                {currentTrack ? (currentTrack.displayName || currentTrack.filename) : "Ready to Play"}
            </h3>
        </div>
        <div className="flex items-center shrink-0 gap-0.5">
          <Link
            href="/history"
            className="p-2 text-gray-500 hover:text-blue-700 rounded-lg hover:bg-blue-50"
            aria-label="Playback history"
            title="History"
          >
            <History className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          {onClose && (
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      {/* The Player Component */}
      <div className="px-1 sm:px-2 pb-2 sm:pb-3">
        {currentTrack ? (
          <>
            <ReactH5AudioPlayer
                ref={playerRef}
                autoPlay={false}
                src={currentTrack.path}
                onEnded={onTrackEnded || (hasNext ? onNext : undefined)}
                onClickPrevious={hasPrevious ? onPrev : undefined}
                onClickNext={hasNext ? onNext : undefined}
                showSkipControls={true}
                showJumpControls={true}
                layout="stacked-reverse" 
                customAdditionalControls={[
                  <button
                    key="play-mode"
                    onClick={() => {
                      if (!onPlayModeChange) return;
                      const modes: PlayMode[] = ['normal', 'repeat-all', 'repeat-one', 'shuffle'];
                      const currentIndex = modes.indexOf(playMode);
                      const nextIndex = (currentIndex + 1) % modes.length;
                      onPlayModeChange(modes[nextIndex]);
                    }}
                    className="rhap_button-clear rhap_repeat-button"
                    aria-label="Play mode"
                    title={`Play mode: ${playMode}`}
                  >
                    {playMode === 'repeat-all' && <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {playMode === 'repeat-one' && <Repeat1 className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {playMode === 'shuffle' && <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {playMode === 'normal' && <Repeat className="w-4 h-4 sm:w-5 sm:h-5 opacity-30" />}
                  </button>
                ]}
                customVolumeControls={[]} 
                showFilledVolume={false}
            />
          </>
        ) : (
          <div className="p-4 text-center text-gray-400 text-sm">
              Select a track to start playing...
          </div>
        )}
      </div>
    </div>
  );
}
