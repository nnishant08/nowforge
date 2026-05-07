/**
 * All styles for the command bar live as a single string injected into the
 * Shadow DOM. We don't import a .css file because the content script is
 * bundled by tsup as an IIFE — keeping CSS in TS avoids a separate bundling
 * pipeline for a single ~6 KB stylesheet.
 *
 * `:host { all: initial; }` resets every inheritable property, then we
 * progressively re-apply our own. SN's global stylesheet can't reach inside.
 */

export const COMMAND_BAR_STYLES = `
:host {
  all: initial;
  position: fixed; inset: 0;
  z-index: 2147483647;
  contain: layout style paint;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  pointer-events: none;
  --bg: #ffffff;
  --bg-hover: #f0f0ff;
  --text: #1c1c1e;
  --text-secondary: #6c6c70;
  --text-tertiary: #98989d;
  --border: #e5e5e7;
  --kbd-bg: #f5f5f7;
  --kbd-border: #d1d1d6;
  --shadow: 0 16px 48px rgba(0,0,0,0.30);
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1e1e1e;
    --bg-hover: #2a2a3a;
    --text: #f5f5f7;
    --text-secondary: #c7c7cc;
    --text-tertiary: #8e8e93;
    --border: #38383a;
    --kbd-bg: #2c2c2e;
    --kbd-border: #48484a;
    --shadow: 0 16px 48px rgba(0,0,0,0.50);
  }
}

/* ── Overlay (root) ───────────────────────────────────────────────────── */
.nf-cmd-overlay {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center;
  padding-top: 18vh;
  background: rgba(0,0,0,0.50);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0s linear 0.15s;
  pointer-events: none;
}
.nf-cmd-overlay.open {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.15s ease, visibility 0s;
  pointer-events: auto;
}

/* ── Panel ────────────────────────────────────────────────────────────── */
.nf-cmd-panel {
  width: 580px;
  max-width: calc(100vw - 32px);
  background: var(--bg);
  color: var(--text);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
  transform: translateY(-8px) scale(0.98);
  transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1);
}
.nf-cmd-overlay.open .nf-cmd-panel {
  transform: translateY(0) scale(1);
}

/* ── Search row ───────────────────────────────────────────────────────── */
.nf-cmd-search-row {
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px;
  height: 48px;
  border-bottom: 1px solid var(--border);
}
.nf-cmd-search-icon {
  width: 20px; height: 20px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}
.nf-cmd-search-input {
  flex: 1;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  width: 100%;
  padding: 0;
}
.nf-cmd-search-input::placeholder { color: var(--text-tertiary); }

/* ── Results list ─────────────────────────────────────────────────────── */
.nf-cmd-results {
  max-height: 400px;
  overflow-y: auto;
}
.nf-cmd-results::-webkit-scrollbar { width: 8px; }
.nf-cmd-results::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,0.30);
  border-radius: 4px;
}
.nf-cmd-list {
  list-style: none;
  margin: 0; padding: 4px 0;
}

.nf-cmd-cat {
  padding: 8px 16px 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  pointer-events: none;
}

.nf-cmd-row {
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px;
  height: 44px;
  cursor: pointer;
  user-select: none;
  border-radius: 0;
}
.nf-cmd-row.selected { background: var(--bg-hover); }
.nf-cmd-icon {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.nf-cmd-text {
  display: flex; flex-direction: column;
  min-width: 0; flex: 1;
  gap: 2px;
}
.nf-cmd-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nf-cmd-desc {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nf-cmd-shortcut {
  display: inline-flex;
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--kbd-bg);
  border: 1px solid var(--kbd-border);
  border-radius: 4px;
  padding: 2px 6px;
  flex-shrink: 0;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

/* ── Empty state ──────────────────────────────────────────────────────── */
.nf-cmd-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

/* ── Footer hint row ──────────────────────────────────────────────────── */
.nf-cmd-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-tertiary);
  gap: 12px;
}
.nf-cmd-footer .nf-cmd-hints { display: flex; gap: 14px; }
.nf-cmd-footer .nf-cmd-hint { display: inline-flex; align-items: center; gap: 4px; }
.nf-cmd-footer kbd {
  font: inherit; font-size: 10px;
  background: var(--kbd-bg);
  border: 1px solid var(--kbd-border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--text-secondary);
}

/* ── Toast ────────────────────────────────────────────────────────────── */
.nf-cmd-toast {
  position: fixed;
  left: 50%; bottom: 32px;
  transform: translate(-50%, 12px);
  background: rgba(28, 28, 30, 0.92);
  color: #f5f5f7;
  font-size: 13px;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: 100px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.30);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.nf-cmd-toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}
`;
