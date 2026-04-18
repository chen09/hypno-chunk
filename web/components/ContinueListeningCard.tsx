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
    <div className="mb-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Headphones className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Continue listening</p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-gray-900">{summary.title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatRelativeTime(summary.updatedAt)}
            {remaining !== undefined && (
              <>
                {' · '}
                <span className="font-medium text-gray-700">{formatClock(remaining)} left</span>
              </>
            )}
          </p>
          {duration !== undefined && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onSmartResume}
          className="flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-white" />
          Resume
        </button>
      </div>
    </div>
  );
}
