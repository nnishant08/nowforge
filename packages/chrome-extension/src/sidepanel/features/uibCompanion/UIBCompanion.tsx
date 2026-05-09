import { useCallback, useEffect, useState } from 'react';
import type {
  UibComponentNode,
  UibComponentDetail,
  GetPageContextResponse,
} from '../../../shared/messaging.js';
import { getTree, getComponent, setHighlight } from './api.js';
import { ComponentTree } from './ComponentTree.js';
import { PropertyInspector } from './PropertyInspector.js';
import { ClientStateViewer } from './ClientStateViewer.js';
import { EventLog } from './EventLog.js';
import './styles.css';

const TREE_REFRESH_MS = 5000;

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

function Collapsible({ title, defaultOpen, rightSlot, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <section className={`uib-section${open ? ' uib-section--open' : ''}`}>
      <header className="uib-section__head">
        <button type="button" className="uib-section__toggle" onClick={() => setOpen((o) => !o)}>
          <span className="uib-section__chev" aria-hidden>{open ? '▾' : '▸'}</span>
          {title}
        </button>
        {rightSlot && <div className="uib-section__right">{rightSlot}</div>}
      </header>
      {open && <div className="uib-section__body">{children}</div>}
    </section>
  );
}

export function UIBCompanion() {
  const [inUib, setInUib] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [tree, setTree] = useState<UibComponentNode | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UibComponentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReason, setDetailReason] = useState<string | null>(null);

  // Refresh URL/tree
  const refreshTree = useCallback(async () => {
    const res = await getTree();
    if (!res.ok) {
      setReason(res.reason ?? 'Could not read the page.');
      setInUib(false);
      setTree(null);
      return;
    }
    setInUib(res.inUib);
    setPageTitle(res.pageTitle);
    setTree(res.tree);
    setReason(res.inUib ? null : null);
  }, []);

  // Initial + check active tab + periodic refresh
  useEffect(() => {
    let cancelled = false;
    void chrome.runtime.sendMessage(
      { type: 'GET_PAGE_CONTEXT' },
      (_res: GetPageContextResponse) => {
        if (cancelled) return;
        void refreshTree();
      }
    );
    const t = window.setInterval(() => void refreshTree(), TREE_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [refreshTree]);

  // When selection changes, fetch detail
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailReason(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    setDetailReason(null);
    void getComponent(selectedId).then((res) => {
      if (cancelled) return;
      setDetailLoading(false);
      setDetail(res.detail);
      setDetailReason(res.reason ?? null);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Highlight on hover
  const onHover = useCallback((id: string | null) => {
    void setHighlight(id);
  }, []);

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
    void setHighlight(id);
  }, []);

  // Not on a UIB page → empty state
  if (!inUib) {
    return (
      <div className="uib-empty">
        <div className="uib-empty__icon" aria-hidden>🛠</div>
        <p className="uib-empty__title">Open a UI Builder page to use the UIB Companion.</p>
        <p className="uib-empty__sub">
          {reason ?? 'Detected URLs: /now/builder/, /$uib/, or anything containing "ui-builder".'}
        </p>
        <button type="button" className="uib-empty__btn" onClick={() => void refreshTree()}>
          Re-check
        </button>
      </div>
    );
  }

  return (
    <div className="uib-root">
      <header className="uib-header">
        <span className="uib-header__icon" aria-hidden>🛠</span>
        <span className="uib-header__page">{pageTitle ?? 'UI Builder Page'}</span>
        <button type="button" className="uib-header__btn" onClick={() => void refreshTree()}>
          ↻
        </button>
      </header>

      <Collapsible title="Component Tree" defaultOpen>
        <ComponentTree
          root={tree}
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={onHover}
        />
      </Collapsible>

      <Collapsible title="Property Inspector" defaultOpen={!!selectedId}>
        <PropertyInspector
          detail={detail}
          loading={detailLoading}
          reason={detailReason}
        />
      </Collapsible>

      <Collapsible title="Client State">
        <ClientStateViewer />
      </Collapsible>

      <Collapsible title="Event Log">
        <EventLog />
      </Collapsible>
    </div>
  );
}
