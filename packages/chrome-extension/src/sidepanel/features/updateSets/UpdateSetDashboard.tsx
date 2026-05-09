import { useCallback, useEffect, useState } from 'react';
import type {
  UpdateSetSummary,
  UpdateSetRecent,
  UpdateXmlEntry,
} from '../../../shared/messaging.js';
import { CurrentUpdateSet } from './CurrentUpdateSet.js';
import { QuickSwitch } from './QuickSwitch.js';
import { Contents } from './Contents.js';
import { CreateModal } from './CreateModal.js';
import {
  getCurrent,
  getRecent,
  getContents,
  switchTo,
  createSet,
  getActiveTabBaseUrl,
} from './api.js';
import './styles.css';

const REFRESH_INTERVAL_MS = 30_000;

interface ToastState { message: string; kind: 'info' | 'error'; }

export function UpdateSetDashboard() {
  // Data
  const [current, setCurrent] = useState<UpdateSetSummary | null>(null);
  const [recent, setRecent] = useState<UpdateSetRecent[]>([]);
  const [contents, setContents] = useState<UpdateXmlEntry[]>([]);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);

  // Loading + errors
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [contentsError, setContentsError] = useState<string | null>(null);

  // UI state
  const [switching, setSwitching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────
  const loadHeader = useCallback(async (): Promise<UpdateSetSummary | null> => {
    setLoadingHeader(true);
    const [c, r, base] = await Promise.all([getCurrent(), getRecent(), getActiveTabBaseUrl()]);
    setBaseUrl(base);
    if (c.ok) {
      setCurrent(c.current);
      setHeaderError(null);
    } else {
      setHeaderError(c.error ?? 'Failed to load current update set.');
    }
    if (r.ok) setRecent(r.recent);
    setLoadingHeader(false);
    return c.ok ? c.current : null;
  }, []);

  const loadContents = useCallback(async (sysId: string) => {
    setLoadingContents(true);
    setContentsError(null);
    const res = await getContents(sysId);
    if (res.ok) setContents(res.entries);
    else { setContents([]); setContentsError(res.error ?? 'Failed to load contents.'); }
    setLoadingContents(false);
  }, []);

  const refreshAll = useCallback(async () => {
    const cur = await loadHeader();
    if (cur) await loadContents(cur.sysId);
    else setContents([]);
  }, [loadHeader, loadContents]);

  // ── Initial + 30s auto-refresh ────────────────────────────────────────
  useEffect(() => {
    void refreshAll();
    const t = window.setInterval(() => { void refreshAll(); }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [refreshAll]);

  // ── Toast ─────────────────────────────────────────────────────────────
  const showToast = (message: string, kind: 'info' | 'error' = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  };

  // ── Actions ───────────────────────────────────────────────────────────
  const handleSwitch = async (sysId: string) => {
    setSwitching(true);
    const res = await switchTo(sysId);
    setSwitching(false);
    if (!res.ok) {
      showToast(res.error ?? 'Switch failed', 'error');
      return;
    }
    showToast('Switched. Refresh the SN page to update its picker.');
    await refreshAll();
  };

  const handleCreate = async (name: string, appSysId: string) => {
    const res = await createSet(name, appSysId);
    if (!res.ok) {
      throw new Error(res.error ?? 'Create failed');
    }
    setShowCreate(false);
    showToast(`Created "${name}". Refresh the SN page to update its picker.`);
    await refreshAll();
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="us-root">
      <CurrentUpdateSet
        current={current}
        loading={loadingHeader}
        error={headerError}
        onRefresh={() => void refreshAll()}
      />

      <QuickSwitch
        recent={recent}
        currentSysId={current?.sysId ?? null}
        loading={loadingHeader}
        switching={switching}
        onSwitch={(sysId) => void handleSwitch(sysId)}
        onCreate={() => setShowCreate(true)}
      />

      {current && (
        <Contents
          entries={contents}
          loading={loadingContents}
          error={contentsError}
          baseUrl={baseUrl}
        />
      )}

      {showCreate && (
        <CreateModal
          defaultAppName={current?.appName ?? 'Global'}
          defaultAppSysId={current?.appSysId ?? ''}
          onCancel={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {toast && (
        <div className={`us-toast us-toast--${toast.kind}`}>{toast.message}</div>
      )}
    </div>
  );
}
