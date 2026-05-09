import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HISTORY_KEY,
  FAVORITES_KEY,
  sortByFrecency,
  type NavRecord,
  type NavFavorite,
} from '../../../shared/navigation.js';
import {
  loadHistory,
  loadFavorites,
  pinFavorite,
  unpinFavorite,
  openRecord,
  getActivePageContext,
} from './api.js';
import { RecentList } from './RecentList.js';
import { Favorites } from './Favorites.js';
import { QuickJump } from './QuickJump.js';
import './styles.css';

const RECENT_DISPLAY_LIMIT = 30;

export function Navigation() {
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [history, setHistory] = useState<NavRecord[]>([]);
  const [favorites, setFavorites] = useState<NavFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; kind: 'info' | 'error' } | null>(null);

  const showToast = (msg: string, kind: 'info' | 'error' = 'info') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 3000);
  };

  // ── Resolve active instance + initial load ────────────────────────────
  const refresh = useCallback(async (instance: string) => {
    const [h, f] = await Promise.all([loadHistory(instance), loadFavorites(instance)]);
    setHistory(h);
    setFavorites(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getActivePageContext().then((ctx) => {
      if (cancelled) return;
      const inst = ctx?.instanceInfo?.instanceName ?? null;
      setInstanceName(inst);
      if (inst) void refresh(inst);
      else setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refresh]);

  // ── Live updates from background visit broadcasts + sync favorites ────
  useEffect(() => {
    if (!instanceName) return;

    // Storage changes (history is local, favorites is sync)
    const onStorage = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && HISTORY_KEY(instanceName) in changes) {
        const next = changes[HISTORY_KEY(instanceName)].newValue as NavRecord[] | undefined;
        if (next) setHistory(next);
      }
      if (area === 'sync' && FAVORITES_KEY(instanceName) in changes) {
        const next = changes[FAVORITES_KEY(instanceName)].newValue as NavFavorite[] | undefined;
        setFavorites(next ?? []);
      }
    };
    chrome.storage.onChanged.addListener(onStorage);

    // Background broadcasts NAV_HISTORY_CHANGED — also a refresh trigger
    // (storage.onChanged would catch it too, but this is a backup).
    const onMessage = (message: { type?: string; instanceName?: string }) => {
      if (message?.type === 'NAV_HISTORY_CHANGED' && message.instanceName === instanceName) {
        void loadHistory(instanceName).then(setHistory);
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.storage.onChanged.removeListener(onStorage);
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [instanceName]);

  // ── Derived ───────────────────────────────────────────────────────────
  const ranked = useMemo(
    () => sortByFrecency(history).slice(0, RECENT_DISPLAY_LIMIT),
    [history]
  );
  const favoriteKeys = useMemo(
    () => new Set(favorites.map((f) => `${f.table}:${f.sysId}`)),
    [favorites]
  );

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleOpen = useCallback(
    (record: { table: string; sysId: string }, newTab: boolean) => {
      void openRecord(record.table, record.sysId, newTab);
    },
    []
  );

  const handlePin = useCallback(
    async (record: NavRecord | NavFavorite) => {
      if (!instanceName) return;
      await pinFavorite(instanceName, {
        table: record.table,
        sysId: record.sysId,
        displayValue: record.displayValue,
        url: record.url,
      });
      showToast(`Pinned ${record.displayValue}`);
    },
    [instanceName]
  );

  const handleUnpin = useCallback(
    async (record: { table: string; sysId: string; displayValue: string }) => {
      if (!instanceName) return;
      await unpinFavorite(instanceName, record.table, record.sysId);
      showToast(`Unpinned ${record.displayValue}`);
    },
    [instanceName]
  );

  const handleDeleteHistory = useCallback(
    async (record: NavRecord) => {
      if (!instanceName) return;
      const next = history.filter(
        (r) => !(r.table === record.table && r.sysId === record.sysId)
      );
      setHistory(next);
      await new Promise<void>((resolve) =>
        chrome.storage.local.set({ [HISTORY_KEY(instanceName)]: next }, () => resolve())
      );
    },
    [instanceName, history]
  );

  // ── Render ────────────────────────────────────────────────────────────
  if (!instanceName) {
    return (
      <div className="nv-root">
        <div className="nv-empty nv-empty--padded">
          Open a ServiceNow tab to see your recent records here.
        </div>
      </div>
    );
  }

  return (
    <div className="nv-root">
      <QuickJump onError={(m) => showToast(m, 'error')} />

      <section className="nv-section">
        <header className="nv-section__head">
          <h3 className="nv-section__title">Favorites</h3>
          <span className="nv-section__count">{favorites.length}</span>
        </header>
        <Favorites
          favorites={favorites}
          onOpen={(f, newTab) => handleOpen(f, newTab)}
          onUnpin={(f) => void handleUnpin(f)}
        />
      </section>

      <section className="nv-section">
        <header className="nv-section__head">
          <h3 className="nv-section__title">Recent</h3>
          <span className="nv-section__count">{ranked.length}</span>
        </header>
        <RecentList
          records={ranked}
          favoriteKeys={favoriteKeys}
          loading={loading}
          onOpen={(r, newTab) => handleOpen(r, newTab)}
          onPin={(r) => void handlePin(r)}
          onUnpin={(r) => void handleUnpin(r)}
          onDelete={(r) => void handleDeleteHistory(r)}
        />
      </section>

      {toast && (
        <div className={`nv-toast nv-toast--${toast.kind}`}>{toast.msg}</div>
      )}
    </div>
  );
}
