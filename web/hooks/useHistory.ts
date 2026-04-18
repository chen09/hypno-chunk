'use client';

import { useCallback, useEffect, useState } from 'react';
import { history, type HistoryItem } from '@/lib/history';

export function useHistoryList(): {
  items: HistoryItem[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await history.list();
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}
