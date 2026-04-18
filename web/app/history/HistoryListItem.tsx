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
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm outline-none ring-blue-200 focus-visible:ring-2"
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-gray-900">{displayTitle}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatRelativeTime(item.updatedAt)}
          {item.category && (
            <>
              {' · '}
              <span className="text-gray-600">{item.category}</span>
            </>
          )}
          {remaining !== undefined && (
            <>
              {' · '}
              <span className="font-medium text-gray-700">{formatClock(remaining)} left</span>
            </>
          )}
        </p>
        {duration !== undefined && (
          <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Remove from history"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
