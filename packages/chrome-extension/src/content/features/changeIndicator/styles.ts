export const CHANGE_INDICATOR_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483645;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #ebebed;
  --text: #1c1c1e;
  --text-secondary: #6c6c70;
  --text-tertiary: #98989d;
  --border: #e5e5e7;
  --warn-bg: #fef3c7;
  --warn-border: #fbbf24;
  --warn-text: #92400e;
  --shadow: 0 8px 24px rgba(0,0,0,0.20);
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1e1e1e;
    --bg-secondary: #2a2a2c;
    --bg-tertiary: #38383a;
    --text: #f5f5f7;
    --text-secondary: #c7c7cc;
    --text-tertiary: #8e8e93;
    --border: #38383a;
    --warn-bg: rgba(251, 191, 36, 0.18);
    --warn-border: #d97706;
    --warn-text: #fcd34d;
    --shadow: 0 8px 24px rgba(0,0,0,0.40);
  }
}

/* ── Badge ────────────────────────────────────────────────────────────── */
.ci-badge {
  position: absolute;
  display: none;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  border-radius: 100px;
  color: var(--warn-text);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 0.18s ease, transform 0.18s ease;
  opacity: 0;
  transform: translateY(-3px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.ci-badge.show {
  display: inline-flex;
  opacity: 1;
  transform: translateY(0);
}
.ci-badge:hover { filter: brightness(0.97); }
.ci-badge__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--warn-border);
  flex-shrink: 0;
}

/* ── Panel ────────────────────────────────────────────────────────────── */
.ci-panel {
  position: absolute;
  width: 380px;
  max-width: calc(100vw - 16px);
  max-height: 480px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  pointer-events: auto;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.10s ease, transform 0.10s ease;
  display: none;
  flex-direction: column;
  overflow: hidden;
}
.ci-panel.show {
  display: flex;
  opacity: 1;
  transform: translateY(0);
}
.ci-panel__head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.ci-panel__title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}
.ci-panel__count {
  font-size: 10px;
  font-weight: 700;
  color: var(--warn-text);
  background: var(--warn-bg);
  padding: 2px 8px;
  border-radius: 100px;
  border: 1px solid var(--warn-border);
}
.ci-btn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ci-btn:hover { background: var(--bg-secondary); }
.ci-btn--ghost {
  border: none;
  color: var(--text-tertiary);
  font-size: 14px;
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ci-btn--ghost:hover { background: var(--bg-secondary); color: var(--text); }
.ci-btn--danger {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.3);
}
.ci-btn--danger:hover { background: rgba(185, 28, 28, 0.08); }

.ci-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.ci-row {
  display: flex; flex-direction: column;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  gap: 6px;
}
.ci-row:last-child { border-bottom: none; }
.ci-row__head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
}
.ci-row__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ci-row__values {
  display: flex; flex-direction: column;
  gap: 3px;
  font-size: 11px;
}
.ci-row__line {
  display: flex; align-items: baseline; gap: 6px;
  font-family: 'Fira Code', SF Mono, Menlo, monospace;
}
.ci-row__tag {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 100px;
  width: 38px;
  text-align: center;
  font-family: -apple-system, sans-serif;
}
.ci-row__tag--was { background: var(--bg-tertiary); color: var(--text-tertiary); }
.ci-row__tag--now { background: var(--warn-bg); color: var(--warn-text); }
.ci-row__val {
  flex: 1;
  color: var(--text);
  word-break: break-word;
  white-space: pre-wrap;
}
.ci-row__val--empty { color: var(--text-tertiary); font-style: italic; }
.ci-row__journal {
  font-size: 10px;
  color: var(--text-tertiary);
  font-style: italic;
}
`;
