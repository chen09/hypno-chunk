'use client';

import { Trash2 } from 'lucide-react';
import type { HistoryItem } from '@/lib/history';

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

interface HistoryListItemProps {
  item: HistoryItem;
  displayTitle: string;
  onOpen: () => void;
  onRemove: () => void;
}

export default function HistoryListItem({
  item,
  displayTitle,
  onOpen,
  onRemove,
}: HistoryListItemProps) {
  const duration = item.duration && item.duration > 0 ? item.duration : undefined;
  const pct =
    duration && duration > 0
      ? Math.min(100, Math.round((item.position / duration) * 100))
      : 0;
  const remaining =
    duration && duration > 0 ? Math.max(0, duration - item.position) : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150"
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-[var(--text)]">{displayTitle}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {formatRelativeTime(item.updatedAt)}
          {item.category && (
            <>
              {' · '}
              <span className="text-[var(--text-muted)]">{item.category}</span>
            </>
          )}
          {remaining !== undefined && (
            <>
              {' · '}
              <span className="font-medium text-[var(--text)]">{formatClock(remaining)} left</span>
            </>
          )}
        </p>
        {duration !== undefined && (
          <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 rounded-full p-2 text-[var(--text-muted)] hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        aria-label="Remove from history"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
