export const SCRIPT_ACTIONS_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --bg: #ffffff;
  --bg-hover: #f0f0ff;
  --text: #1c1c1e;
  --text-secondary: #6c6c70;
  --text-tertiary: #98989d;
  --border: #e5e5e7;
  --shadow: 0 8px 24px rgba(0,0,0,0.20);
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1e1e1e;
    --bg-hover: #2a2a3a;
    --text: #f5f5f7;
    --text-secondary: #c7c7cc;
    --text-tertiary: #8e8e93;
    --border: #38383a;
    --shadow: 0 8px 24px rgba(0,0,0,0.40);
  }
}

.sa-menu {
  position: absolute;
  width: 280px;
  max-width: calc(100vw - 16px);
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  font-size: 13px;
  padding: 4px 0;
  pointer-events: auto;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.10s ease, transform 0.10s ease;
}
.sa-menu.open { opacity: 1; transform: translateY(0); }

.sa-section + .sa-section { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px; }

.sa-action {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 7px 14px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: var(--text);
}
.sa-action:hover, .sa-action:focus {
  background: var(--bg-hover);
  outline: none;
}
.sa-action[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}
.sa-action[disabled]:hover { background: transparent; }
.sa-icon {
  width: 18px;
  font-size: 14px;
  flex-shrink: 0;
  text-align: center;
}
.sa-label { flex: 1; }
.sa-pro {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 1px 6px;
  border-radius: 100px;
  background: var(--bg-hover);
  flex-shrink: 0;
}

.sa-toast {
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
.sa-toast.show { opacity: 1; transform: translate(-50%, 0); }
`;
