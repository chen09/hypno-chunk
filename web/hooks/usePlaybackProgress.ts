'use client';

import { useEffect, useRef } from 'react';
import { history } from '@/lib/history';

export type PlaybackTrackMeta = {
  id: string;
  path: string;
  displayName?: string;
  category?: string;
};

const THROTTLE_MS = 5000;

/**
 * Persists playback position: throttled timeupdate + immediate seeked/pause/ended.
 * Mirrors last known position to localStorage on beforeunload/pagehide.
 */
export function usePlaybackProgress(
  audio: HTMLAudioElement | null,
  track: PlaybackTrackMeta | null,
): void {
  const lastThrottleRef = useRef(0);

  useEffect(() => {
    if (!audio || !track) return;

    const flush = () => {
      const position = audio.currentTime;
      const duration = Number.isFinite(audio.duration) ? audio.duration : undefined;
      if (!Number.isFinite(position)) return;
      void history.upsert({
        id: track.id,
        path: track.path,
        displayName: track.displayName,
        category: track.category,
        position,
        duration,
        updatedAt: Date.now(),
      });
    };

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < THROTTLE_MS) return;
      lastThrottleRef.current = now;
      flush();
    };

    const onImmediate = () => {
      lastThrottleRef.current = Date.now();
      flush();
    };

    const onPageHide = () => {
      const position = audio.currentTime;
      const duration = Number.isFinite(audio.duration) ? audio.duration : undefined;
      history.syncPlaybackToLocalStorageSync({
        id: track.id,
        path: track.path,
        displayName: track.displayName,
        category: track.category,
        position,
        duration,
      });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('seeked', onImmediate);
    audio.addEventListener('pause', onImmediate);
    audio.addEventListener('ended', onImmediate);
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('seeked', onImmediate);
      audio.removeEventListener('pause', onImmediate);
      audio.removeEventListener('ended', onImmediate);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [audio, track]);
}
