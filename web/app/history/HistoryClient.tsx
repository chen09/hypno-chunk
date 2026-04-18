'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Download, Search, Trash2, Upload } from 'lucide-react';
import { history } from '@/lib/history';
import { useHistoryList } from '@/hooks/useHistory';
import HistoryListItem from './HistoryListItem';

type FileWithDisplayName = {
  filename: string;
  displayName?: string;
  category?: string;
  path: string;
  size: number;
  date: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HistoryClient() {
  const router = useRouter();
  const { data: filesData } = useSWR('/api/files', fetcher);
  const files: FileWithDisplayName[] = useMemo(() => filesData?.files ?? [], [filesData]);
  const { items, loading, refresh } = useHistoryList();
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleForItem = useCallback(
    (id: string, displayName?: string) => {
      const f = files.find((x) => x.filename === id);
      const base =
        f?.displayName ||
        displayName ||
        id.replace(/_merged_final\.mp3$/i, '') ||
        id;
      return base;
    },
    [files],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const title = titleForItem(it.id, it.displayName).toLowerCase();
      return title.includes(q) || it.id.toLowerCase().includes(q);
    });
  }, [items, query, titleForItem]);

  const exportJson = useCallback(async () => {
    const payload = await history.exportJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `hypnochunk-history-${ds}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const onImportPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '');
          const data = JSON.parse(text) as unknown;
          void (async () => {
            const { merged, skipped } = await history.importJson(data);
            await refresh();
            alert(`Import done. Merged: ${merged}, skipped: ${skipped}`);
          })();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Import failed');
        }
      };
      reader.readAsText(file);
    },
    [refresh],
  );

  const clearAll = useCallback(async () => {
    if (!confirm('Clear all playback history? This cannot be undone.')) return;
    await history.clear();
    await refresh();
  }, [refresh]);

  const removeOne = useCallback(
    async (id: string) => {
      await history.remove(id);
      await refresh();
    },
    [refresh],
  );

  const openItem = useCallback(
    (id: string) => {
      router.push(`/?resume=${encodeURIComponent(id)}`);
    },
    [router],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3 sm:px-4">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Back to library"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-lg font-semibold text-gray-900">Playback history</h1>
          <button
            type="button"
            onClick={() => void exportJson()}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            title="Export JSON"
            aria-label="Export JSON"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            title="Import JSON"
            aria-label="Import JSON"
          >
            <Upload className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void clearAll()}
            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
            title="Clear all"
            aria-label="Clear all history"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto max-w-3xl px-3 pb-3 sm:px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or filename…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-200 focus:ring-2"
            />
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportPick} />
      </header>

      <main className="mx-auto max-w-3xl space-y-2 px-3 py-4 sm:px-4">
        {loading && (
          <p className="py-8 text-center text-sm text-gray-500 animate-pulse">Loading history…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            {items.length === 0 ? 'No playback history yet.' : 'No matches.'}
          </p>
        )}
        {!loading &&
          filtered.map((it) => (
            <HistoryListItem
              key={it.id}
              item={it}
              displayTitle={titleForItem(it.id, it.displayName)}
              onOpen={() => openItem(it.id)}
              onRemove={() => void removeOne(it.id)}
            />
          ))}
      </main>
    </div>
  );
}
