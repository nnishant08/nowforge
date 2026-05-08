/**
 * Shadow-DOM stylesheet for the field-intelligence context menu and the
 * hover tooltip. Both use the same root host but separate visible elements
 * so we don't have to maintain two shadow trees.
 */

export const FIELD_INTEL_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483646; /* one below the command bar */
  pointer-events: none;
  contain: layout style;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg: #ffffff;
  --bg-hover: #f0f0ff;
  --text: #1c1c1e;
  --text-secondary: #6c6c70;
  --text-tertiary: #98989d;
  --border: #e5e5e7;
  --kbd-bg: #f5f5f7;
  --shadow: 0 8px 24px rgba(0,0,0,0.20);
  --mono: 'SF Mono', Menlo, Monaco, 'Cascadia Code', monospace;
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
    --shadow: 0 8px 24px rgba(0,0,0,0.40);
  }
}

/* ── Context menu ─────────────────────────────────────────────────────── */
.nf-fi-menu {
  position: absolute;
  width: 280px;
  max-width: calc(100vw - 16px);
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  font-size: 13px;
  line-height: 1.4;
  pointer-events: auto;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.10s ease, transform 0.10s ease;
  overflow: hidden;
}
.nf-fi-menu.open {
  opacity: 1;
  transform: translateY(0);
}

.nf-fi-section {
  padding: 8px 12px;
}
.nf-fi-section + .nf-fi-section {
  border-top: 1px solid var(--border);
}

.nf-fi-head {
  display: flex; align-items: center; gap: 8px;
}
.nf-fi-name {
  flex: 1;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nf-fi-type {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-secondary);
}

.nf-fi-row {
  display: flex; gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.nf-fi-row .k {
  color: var(--text-tertiary);
  min-width: 80px;
  flex-shrink: 0;
}
.nf-fi-row .v {
  color: var(--text);
  font-family: var(--mono);
  word-break: break-all;
}

.nf-fi-flags {
  display: flex; gap: 12px;
  margin-top: 4px;
  font-size: 11px;
}
.nf-fi-flag {
  color: var(--text-tertiary);
}
.nf-fi-flag b {
  color: var(--text);
  font-weight: 600;
}

.nf-fi-actions {
  padding: 4px 0;
}
.nf-fi-action {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--text);
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}
.nf-fi-action:hover,
.nf-fi-action:focus {
  background: var(--bg-hover);
  outline: none;
}
.nf-fi-action[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.nf-fi-action-icon {
  width: 18px;
  display: inline-flex;
  font-size: 14px;
  flex-shrink: 0;
}

.nf-fi-loading {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  font-style: italic;
}

.nf-fi-copy {
  width: 24px; height: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 13px;
  border-radius: 4px;
  padding: 0;
  flex-shrink: 0;
}
.nf-fi-copy:hover { background: var(--bg-hover); color: var(--text); }

/* ── Toast (shared with command bar style spirit) ─────────────────────── */
.nf-fi-toast {
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
.nf-fi-toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* ── Hover tooltip ────────────────────────────────────────────────────── */
.nf-fi-tooltip {
  position: absolute;
  background: rgba(28, 28, 30, 0.95);
  color: #f5f5f7;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 5px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.20);
  pointer-events: none;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.12s ease;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.nf-fi-tooltip.show { opacity: 1; }
.nf-fi-tooltip .type {
  color: rgba(245,245,247,0.55);
  font-weight: 400;
  margin-left: 6px;
}
`;
