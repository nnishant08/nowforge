import type { EnvironmentType } from '@nowforge/core';
import type { TagCorner } from '../../shared/settings.js';
import { getCurrentUser, getCurrentUpdateSet, getCurrentScope, clearSnowApiCache } from '../snowApi.js';

/**
 * Floating instance identity tag.
 *
 * - Mounted in a closed Shadow DOM so SN's CSS can't bleed in (and ours can't
 *   bleed out).
 * - Top-level document only — not injected inside iframes.
 * - Click toggles expand/collapse. Drag (>4px movement) repositions and
 *   suppresses the click-to-expand for that interaction.
 * - Position persists across pages within a session via
 *   chrome.storage.local under `nowforge_tag_pos`.
 * - "Closed for session" state lives in window — comes back next page load
 *   unless the user disables the feature in options.
 */

const TAG_HOST_ID = '__nowforge_tag_host__';
const POS_STORAGE_KEY = 'nowforge_tag_pos';

interface TagInfo {
  instanceName: string;
  baseUrl: string;
  envType: EnvironmentType;
  label: string;          // e.g. "DEV"
  color: string;          // e.g. "#22C55E"
  defaultCorner: TagCorner;
}

interface TagDragPos { left: number; top: number; }

/** Session-only "user dismissed it" state. Resets on full page reload. */
let dismissedThisLoad = false;
let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let currentInfo: TagInfo | null = null;

// ─── Position persistence ─────────────────────────────────────────────────

async function loadDragPosition(): Promise<TagDragPos | null> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(POS_STORAGE_KEY, (result) => {
        resolve((result[POS_STORAGE_KEY] as TagDragPos | undefined) ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function saveDragPosition(pos: TagDragPos): void {
  try {
    void chrome.storage.local.set({ [POS_STORAGE_KEY]: pos });
  } catch {
    /* ignore */
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────

function buildStyles(color: string): string {
  return `
    :host {
      all: initial;
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      contain: layout style;
    }
    .tag {
      display: inline-flex;
      flex-direction: column;
      background: rgba(20, 20, 22, 0.78);
      color: #f5f5f7;
      border-radius: 10px;
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.08) inset,
        0 4px 20px rgba(0,0,0,0.30);
      overflow: hidden;
      max-width: 320px;
      transition: max-width 0.18s ease, transform 0.12s ease;
      user-select: none;
    }
    .tag.dragging { transition: none; cursor: grabbing; }
    .header {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 9px 5px 8px;
      cursor: grab;
      font-size: 11px;
      letter-spacing: 0.01em;
      line-height: 1;
    }
    .tag.dragging .header { cursor: grabbing; }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: ${color};
      flex-shrink: 0;
      box-shadow: 0 0 0 1.5px rgba(255,255,255,0.18);
    }
    .name {
      font-weight: 600;
      font-size: 11px;
      max-width: 140px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .pill {
      display: inline-flex;
      padding: 2px 7px;
      border-radius: 100px;
      background: ${color};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      line-height: 1;
    }
    .chev {
      width: 14px; height: 14px;
      color: rgba(245,245,247,0.55);
      flex-shrink: 0;
      transition: transform 0.18s ease;
    }
    .tag.expanded .chev { transform: rotate(180deg); }

    .body {
      display: none;
      padding: 6px 10px 10px;
      border-top: 1px solid rgba(255,255,255,0.10);
    }
    .tag.expanded .body { display: block; }

    .row {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 0;
      font-size: 11px;
    }
    .row + .row { border-top: 1px solid rgba(255,255,255,0.06); }
    .row .k {
      width: 56px; flex-shrink: 0;
      color: rgba(245,245,247,0.55);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .row .v {
      color: #f5f5f7;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      flex: 1; min-width: 0;
    }
    .row .v.loading { color: rgba(245,245,247,0.40); font-style: italic; }
    .row .v.muted { color: rgba(245,245,247,0.40); }

    .footer {
      display: flex; align-items: center; gap: 6px;
      justify-content: flex-end;
      padding-top: 8px;
      margin-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(245,245,247,0.75);
      font: inherit; font-size: 10px;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .btn.danger:hover { background: rgba(239,68,68,0.20); color: #fff; }

    .copy {
      background: transparent;
      border: none;
      color: rgba(245,245,247,0.45);
      cursor: pointer;
      padding: 0 2px;
      font-size: 12px;
      line-height: 1;
    }
    .copy:hover { color: rgba(255,255,255,0.85); }
  `;
}

// ─── DOM ──────────────────────────────────────────────────────────────────

function buildMarkup(info: TagInfo): string {
  return `
    <div class="tag" part="tag" role="region" aria-label="NowForge instance tag">
      <div class="header" data-role="header">
        <span class="dot" aria-hidden="true"></span>
        <span class="name" title="${escapeHtml(info.instanceName)}">${escapeHtml(info.instanceName)}</span>
        <span class="pill">${escapeHtml(info.label)}</span>
        <svg class="chev" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="body">
        <div class="row"><span class="k">URL</span><span class="v" data-field="url">${escapeHtml(info.baseUrl)}</span><button class="copy" data-copy="url" title="Copy URL">⎘</button></div>
        <div class="row"><span class="k">User</span><span class="v loading" data-field="user">loading…</span></div>
        <div class="row"><span class="k">Scope</span><span class="v loading" data-field="scope">loading…</span></div>
        <div class="row"><span class="k">Update</span><span class="v loading" data-field="updateSet">loading…</span></div>
        <div class="footer">
          <button class="btn" data-role="refresh" title="Re-fetch user / scope / update set">Refresh</button>
          <button class="btn danger" data-role="close" title="Hide until next page load">Close ×</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;'
  ));
}

// ─── Positioning ──────────────────────────────────────────────────────────

function applyCornerPosition(corner: TagCorner): void {
  if (!host) return;
  // Reset all corners
  host.style.top = '';
  host.style.bottom = '';
  host.style.left = '';
  host.style.right = '';

  const inset = '8px';
  if (corner === 'top-right')    { host.style.top = inset;    host.style.right = inset; }
  if (corner === 'top-left')     { host.style.top = inset;    host.style.left = inset; }
  if (corner === 'bottom-right') { host.style.bottom = inset; host.style.right = inset; }
  if (corner === 'bottom-left')  { host.style.bottom = inset; host.style.left = inset; }
}

function applyDragPosition(pos: TagDragPos): void {
  if (!host) return;
  host.style.top = `${pos.top}px`;
  host.style.bottom = '';
  host.style.left = `${pos.left}px`;
  host.style.right = '';
}

// ─── Data fetching ────────────────────────────────────────────────────────

async function populateExpandedData(): Promise<void> {
  if (!shadow) return;

  const setField = (field: string, text: string, isMuted = false) => {
    const el = shadow!.querySelector<HTMLSpanElement>(`[data-field="${field}"]`);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('loading');
    el.classList.toggle('muted', isMuted);
  };

  const tasks: Array<Promise<void>> = [
    getCurrentUser().then((u) => {
      setField('user', u?.name ?? '—', !u);
    }),
    getCurrentScope().then((s) => {
      setField('scope', s ?? '—', !s);
    }),
    getCurrentUpdateSet().then((u) => {
      setField('updateSet', u ?? 'Default', !u);
    }),
  ];
  await Promise.allSettled(tasks);
}

// ─── Drag & click handling ────────────────────────────────────────────────

const DRAG_THRESHOLD_PX = 4;

function attachInteractions(): void {
  if (!shadow || !host) return;

  const tagEl = shadow.querySelector<HTMLDivElement>('.tag')!;
  const headerEl = shadow.querySelector<HTMLDivElement>('[data-role="header"]')!;
  const closeBtn = shadow.querySelector<HTMLButtonElement>('[data-role="close"]')!;
  const refreshBtn = shadow.querySelector<HTMLButtonElement>('[data-role="refresh"]')!;
  const copyBtns = shadow.querySelectorAll<HTMLButtonElement>('.copy');

  // Drag from header
  let dragStart: { x: number; y: number; left: number; top: number } | null = null;
  let didDrag = false;

  const onPointerDown = (e: PointerEvent) => {
    if (!host) return;
    // Ignore clicks on buttons (they have their own handlers)
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = host.getBoundingClientRect();
    dragStart = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
    didDrag = false;
    headerEl.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragStart || !host) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (!didDrag && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    didDrag = true;
    tagEl.classList.add('dragging');
    const newLeft = Math.max(0, Math.min(window.innerWidth - 60, dragStart.left + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - 30, dragStart.top + dy));
    applyDragPosition({ left: newLeft, top: newTop });
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!dragStart) return;
    headerEl.releasePointerCapture(e.pointerId);
    tagEl.classList.remove('dragging');

    if (didDrag && host) {
      const rect = host.getBoundingClientRect();
      saveDragPosition({ left: rect.left, top: rect.top });
    } else {
      // Treated as a click — toggle expanded
      const willExpand = !tagEl.classList.contains('expanded');
      tagEl.classList.toggle('expanded');
      if (willExpand) void populateExpandedData();
    }
    dragStart = null;
    didDrag = false;
  };

  headerEl.addEventListener('pointerdown', onPointerDown);
  headerEl.addEventListener('pointermove', onPointerMove);
  headerEl.addEventListener('pointerup', onPointerUp);
  headerEl.addEventListener('pointercancel', onPointerUp);

  // Close
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissedThisLoad = true;
    unmountInstanceTag();
  });

  // Refresh
  refreshBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSnowApiCache();
    // Reset fields to loading state then re-fetch
    shadow!.querySelectorAll<HTMLSpanElement>('.v[data-field]').forEach((el) => {
      if (el.dataset.field === 'url') return;
      el.textContent = 'loading…';
      el.classList.add('loading');
      el.classList.remove('muted');
    });
    void populateExpandedData();
  });

  // Copy buttons (URL row)
  copyBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const field = btn.dataset.copy;
      if (!field || !shadow) return;
      const target = shadow.querySelector<HTMLSpanElement>(`[data-field="${field}"]`);
      const text = target?.textContent;
      if (text) void navigator.clipboard.writeText(text);
    });
  });
}

// ─── Mount / unmount ──────────────────────────────────────────────────────

export function unmountInstanceTag(): void {
  const existing = document.getElementById(TAG_HOST_ID);
  if (existing) existing.remove();
  host = null;
  shadow = null;
  currentInfo = null;
}

export async function mountInstanceTag(info: TagInfo): Promise<void> {
  // Top-level document only
  try { if (window.top !== window.self) return; } catch { return; }
  if (dismissedThisLoad) return;
  if (!document.body) return;

  unmountInstanceTag();
  currentInfo = info;

  host = document.createElement('div');
  host.id = TAG_HOST_ID;
  shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = buildStyles(info.color);
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildMarkup(info);
  // Move children of wrapper into shadow
  while (wrapper.firstChild) shadow.appendChild(wrapper.firstChild);

  document.body.appendChild(host);

  // Apply persisted drag position if any, otherwise corner from settings
  const dragged = await loadDragPosition();
  if (dragged) {
    applyDragPosition(dragged);
  } else {
    applyCornerPosition(info.defaultCorner);
  }

  attachInteractions();
}

/** True if the tag is currently mounted in the DOM. */
export function isInstanceTagMounted(): boolean {
  return !!host && !!document.getElementById(TAG_HOST_ID);
}

/** Get the current info the tag was rendered with. */
export function getCurrentTagInfo(): TagInfo | null {
  return currentInfo;
}
