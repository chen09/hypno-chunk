'use client';

import { Headphones, Play } from 'lucide-react';

export type ContinueListeningSummary = {
  id: string;
  title: string;
  position: number;
  duration?: number;
  updatedAt: number;
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ContinueListeningCardProps {
  summary: ContinueListeningSummary | null;
  onSmartResume: () => void;
}

export default function ContinueListeningCard({
  summary,
  onSmartResume,
}: ContinueListeningCardProps) {
  if (!summary) return null;

  const duration = summary.duration && summary.duration > 0 ? summary.duration : undefined;
  const pct =
    duration && duration > 0
      ? Math.min(100, Math.round((summary.position / duration) * 100))
      : 0;
  const remaining =
    duration && duration > 0 ? Math.max(0, duration - summary.position) : undefined;

  return (
    <div className="mb-5 rounded-2xl p-4 sm:p-5
      bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50
      dark:from-sky-950/50 dark:via-blue-950/40 dark:to-indigo-950/30
      ring-1 ring-blue-200/60 dark:ring-blue-600/20
      shadow-md shadow-blue-100/60 dark:shadow-blue-900/20">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl
          bg-gradient-to-br from-sky-500 to-blue-600 text-white
          shadow-lg shadow-blue-500/30 dark:shadow-blue-900/50">
          <Headphones className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Continue listening
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-[var(--text)]">{summary.title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {formatRelativeTime(summary.updatedAt)}
            {remaining !== undefined && (
              <>
                {' · '}
                <span className="font-medium text-[var(--text)]">{formatClock(remaining)} left</span>
              </>
            )}
          </p>
          {duration !== undefined && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onSmartResume}
          className="flex shrink-0 items-center gap-1.5 rounded-full
            bg-gradient-to-r from-sky-500 to-blue-600
            hover:from-sky-400 hover:to-blue-500
            px-4 py-2.5 text-sm font-semibold text-white
            shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
            active:scale-[0.97] transition-all duration-150"
        >
          <Play className="h-4 w-4 fill-white" />
          Resume
        </button>
      </div>
    </div>
  );
}
