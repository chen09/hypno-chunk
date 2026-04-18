import localforage from 'localforage';

const STORE_NAME = 'hypnochunk';
const ITEMS_KEY = 'hypnochunk_history_items_v1';
const LAST_PLAYED_KEY = 'hypnochunk_last_played_v1';
const LS_BACKUP_KEY = 'hypnochunk_history_ls_backup_v1';

export interface HistoryItem {
  id: string;
  displayName?: string;
  category?: string;
  path: string;
  position: number;
  duration?: number;
  playCount: number;
  updatedAt: number;
  createdAt: number;
}

export interface HistoryExport {
  version: 1;
  exportedAt: number;
  items: HistoryItem[];
  lastPlayedId?: string;
}

type ItemsMap = Record<string, HistoryItem>;

const itemsStore = localforage.createInstance({
  name: STORE_NAME,
  storeName: 'history',
});

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readBackupFromLocalStorage(): { items: ItemsMap; lastPlayedId: string | null } | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(LS_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { items?: ItemsMap; lastPlayedId?: string | null };
    if (!parsed || typeof parsed.items !== 'object') return null;
    return { items: parsed.items, lastPlayedId: parsed.lastPlayedId ?? null };
  } catch {
    return null;
  }
}

function writeBackupToLocalStorage(items: ItemsMap, lastPlayedId: string | null): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LS_BACKUP_KEY, JSON.stringify({ items, lastPlayedId }));
  } catch {
    // ignore quota/private mode failures
  }
}

async function loadItemsMap(): Promise<ItemsMap> {
  try {
    const stored = await itemsStore.getItem<ItemsMap>(ITEMS_KEY);
    if (stored && typeof stored === 'object') return stored;
  } catch {
    // fall through to localStorage backup
  }
  const backup = readBackupFromLocalStorage();
  return backup?.items ?? {};
}

async function saveItemsMap(items: ItemsMap, lastPlayedOverride?: string | null): Promise<void> {
  try {
    await itemsStore.setItem(ITEMS_KEY, items);
  } catch {
    // keep fallback copy in localStorage
  }
  const last =
    lastPlayedOverride !== undefined
      ? lastPlayedOverride
      : await itemsStore.getItem<string | null>(LAST_PLAYED_KEY);
  writeBackupToLocalStorage(items, last ?? null);
}

let beforeUnloadRegistered = false;

function ensureBeforeUnload(): void {
  if (!isBrowser() || beforeUnloadRegistered) return;
  beforeUnloadRegistered = true;
  window.addEventListener('beforeunload', () => {
    const backup = readBackupFromLocalStorage();
    if (backup) {
      writeBackupToLocalStorage(backup.items, backup.lastPlayedId);
    }
  });
}

export const history = {
  async get(id: string): Promise<HistoryItem | null> {
    ensureBeforeUnload();
    const items = await loadItemsMap();
    return items[id] ?? null;
  },

  async list(): Promise<HistoryItem[]> {
    ensureBeforeUnload();
    const items = await loadItemsMap();
    return Object.values(items).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async upsert(
    partial: Omit<HistoryItem, 'createdAt' | 'playCount'> &
      Partial<Pick<HistoryItem, 'createdAt' | 'playCount'>>,
  ): Promise<HistoryItem> {
    ensureBeforeUnload();
    const items = await loadItemsMap();
    const now = Date.now();
    const existing = items[partial.id];
    const merged: HistoryItem = {
      id: partial.id,
      path: partial.path,
      displayName: partial.displayName ?? existing?.displayName,
      category: partial.category ?? existing?.category,
      position: partial.position,
      duration: partial.duration ?? existing?.duration,
      playCount: existing?.playCount ?? 0,
      createdAt: partial.createdAt ?? existing?.createdAt ?? now,
      updatedAt: partial.updatedAt ?? now,
    };
    items[partial.id] = merged;
    await itemsStore.setItem(LAST_PLAYED_KEY, partial.id);
    await saveItemsMap(items, partial.id);
    return merged;
  },

  async recordPlayStart(meta: {
    id: string;
    path: string;
    displayName?: string;
    category?: string;
  }): Promise<HistoryItem> {
    ensureBeforeUnload();
    const items = await loadItemsMap();
    const now = Date.now();
    const existing = items[meta.id];
    const merged: HistoryItem = {
      id: meta.id,
      path: meta.path,
      displayName: meta.displayName ?? existing?.displayName,
      category: meta.category ?? existing?.category,
      position: existing?.position ?? 0,
      duration: existing?.duration,
      playCount: (existing?.playCount ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    items[meta.id] = merged;
    await itemsStore.setItem(LAST_PLAYED_KEY, meta.id);
    await saveItemsMap(items, meta.id);
    return merged;
  },

  async remove(id: string): Promise<void> {
    ensureBeforeUnload();
    const items = await loadItemsMap();
    delete items[id];
    const last = await itemsStore.getItem<string | null>(LAST_PLAYED_KEY);
    if (last === id) {
      const newest = Object.values(items).sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const nextLast = newest?.id ?? null;
      await itemsStore.setItem(LAST_PLAYED_KEY, nextLast);
      await saveItemsMap(items, nextLast);
    } else {
      await saveItemsMap(items);
    }
  },

  async clear(): Promise<void> {
    ensureBeforeUnload();
    await itemsStore.setItem(ITEMS_KEY, {});
    await itemsStore.setItem(LAST_PLAYED_KEY, null);
    await saveItemsMap({}, null);
  },

  async getLastPlayedId(): Promise<string | null> {
    ensureBeforeUnload();
    try {
      const id = await itemsStore.getItem<string | null>(LAST_PLAYED_KEY);
      if (id) return id;
    } catch {
      // ignore and fallback
    }
    const backup = readBackupFromLocalStorage();
    return backup?.lastPlayedId ?? null;
  },

  async setLastPlayedId(id: string | null): Promise<void> {
    ensureBeforeUnload();
    await itemsStore.setItem(LAST_PLAYED_KEY, id);
    const items = await loadItemsMap();
    writeBackupToLocalStorage(items, id);
  },

  async exportJson(): Promise<HistoryExport> {
    const items = await this.list();
    const lastPlayedId = await this.getLastPlayedId();
    return {
      version: 1,
      exportedAt: Date.now(),
      items,
      lastPlayedId: lastPlayedId ?? undefined,
    };
  },

  async importJson(data: unknown): Promise<{ merged: number; skipped: number }> {
    ensureBeforeUnload();
    if (!data || typeof data !== 'object') throw new Error('Invalid import: not an object');
    const obj = data as Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) {
      throw new Error('Invalid import: expected version 1 and items array');
    }
    const incoming = obj.items as HistoryItem[];
    const items = await loadItemsMap();
    let merged = 0;
    let skipped = 0;

    for (const row of incoming) {
      if (!row?.id || typeof row.id !== 'string') {
        skipped += 1;
        continue;
      }
      const existing = items[row.id];
      const incUpdated = typeof row.updatedAt === 'number' ? row.updatedAt : 0;
      if (existing && existing.updatedAt >= incUpdated) {
        skipped += 1;
        continue;
      }
      items[row.id] = {
        id: row.id,
        path: row.path || `/audio/${row.id}`,
        displayName: row.displayName,
        category: row.category,
        position: typeof row.position === 'number' ? row.position : 0,
        duration: typeof row.duration === 'number' ? row.duration : undefined,
        playCount: typeof row.playCount === 'number' ? row.playCount : existing?.playCount ?? 0,
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : existing?.createdAt ?? incUpdated,
        updatedAt: incUpdated,
      };
      merged += 1;
    }

    if (typeof obj.lastPlayedId === 'string' && obj.lastPlayedId) {
      await itemsStore.setItem(LAST_PLAYED_KEY, obj.lastPlayedId);
      await saveItemsMap(items, obj.lastPlayedId);
    } else {
      await saveItemsMap(items);
    }

    return { merged, skipped };
  },

  syncPlaybackToLocalStorageSync(meta: {
    id: string;
    path: string;
    displayName?: string;
    category?: string;
    position: number;
    duration?: number;
  }): void {
    const backup = readBackupFromLocalStorage();
    const items: ItemsMap = backup?.items ? { ...backup.items } : {};
    const now = Date.now();
    const existing = items[meta.id];
    items[meta.id] = {
      id: meta.id,
      path: meta.path,
      displayName: meta.displayName ?? existing?.displayName,
      category: meta.category ?? existing?.category,
      position: meta.position,
      duration: meta.duration ?? existing?.duration,
      playCount: existing?.playCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    writeBackupToLocalStorage(items, meta.id);
  },
};
