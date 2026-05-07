import type { Command, CommandCategory } from './types.js';
import { COMMAND_BAR_STYLES } from './styles.js';
import { makeToastController } from './toast.js';

export interface OverlayHandles {
  host: HTMLElement;
  shadow: ShadowRoot;
  overlay: HTMLDivElement;
  panel: HTMLDivElement;
  input: HTMLInputElement;
  list: HTMLUListElement;
  toast: { show(message: string): void };
}

const SVG_SEARCH = `
  <svg class="nf-cmd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
`;

/** Build the overlay markup once. The host must already be appended to body. */
export function buildOverlay(): OverlayHandles {
  const host = document.createElement('div');
  host.id = '__nowforge_cmdbar__';
  const shadow = host.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = COMMAND_BAR_STYLES;
  shadow.appendChild(styleEl);

  const overlay = document.createElement('div');
  overlay.className = 'nf-cmd-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'NowForge command bar');
  shadow.appendChild(overlay);

  const panel = document.createElement('div');
  panel.className = 'nf-cmd-panel';
  overlay.appendChild(panel);

  // Search row
  const row = document.createElement('div');
  row.className = 'nf-cmd-search-row';
  row.innerHTML = SVG_SEARCH;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'nf-cmd-search-input';
  input.placeholder = 'Search commands, tables, or type / for shortcuts...';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'off');
  row.appendChild(input);
  panel.appendChild(row);

  // Results
  const results = document.createElement('div');
  results.className = 'nf-cmd-results';
  const list = document.createElement('ul');
  list.className = 'nf-cmd-list';
  list.setAttribute('role', 'listbox');
  results.appendChild(list);
  panel.appendChild(results);

  // Footer hints
  const footer = document.createElement('div');
  footer.className = 'nf-cmd-footer';
  footer.innerHTML = `
    <span class="nf-cmd-hints">
      <span class="nf-cmd-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span class="nf-cmd-hint"><kbd>↵</kbd> open</span>
      <span class="nf-cmd-hint"><kbd>⌘</kbd><kbd>↵</kbd> new tab</span>
      <span class="nf-cmd-hint"><kbd>esc</kbd> close</span>
    </span>
    <span>NowForge</span>
  `;
  panel.appendChild(footer);

  const toast = makeToastController(shadow, overlay);

  return { host, shadow, overlay, panel, input, list, toast };
}

// ── Result row rendering ────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<CommandCategory, string> = {
  navigation: 'Navigation',
  action: 'Actions',
  search: 'Search',
};

export interface RenderOptions {
  list: HTMLUListElement;
  commands: Command[];
  selectedIndex: number;
  onClick: (index: number, withModifier: boolean) => void;
  onMouseEnter: (index: number) => void;
}

/**
 * Render the result list with category headers between groups.
 * Returns the DOM index → command index map so the caller can scroll the
 * selected row into view.
 */
export function renderResults(opts: RenderOptions): HTMLLIElement[] {
  const { list, commands, selectedIndex, onClick, onMouseEnter } = opts;

  // Clear
  while (list.firstChild) list.removeChild(list.firstChild);

  if (commands.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'nf-cmd-empty';
    empty.textContent = 'No matching commands.';
    list.appendChild(empty);
    return [];
  }

  const rows: HTMLLIElement[] = [];
  let lastCategory: CommandCategory | null = null;

  commands.forEach((cmd, i) => {
    if (cmd.category !== lastCategory) {
      const header = document.createElement('li');
      header.className = 'nf-cmd-cat';
      header.textContent = CATEGORY_LABEL[cmd.category];
      list.appendChild(header);
      lastCategory = cmd.category;
    }

    const row = document.createElement('li');
    row.className = 'nf-cmd-row';
    row.setAttribute('role', 'option');
    row.dataset.index = String(i);
    if (i === selectedIndex) row.classList.add('selected');

    const icon = document.createElement('span');
    icon.className = 'nf-cmd-icon';
    icon.textContent = cmd.icon;

    const text = document.createElement('div');
    text.className = 'nf-cmd-text';
    const label = document.createElement('div');
    label.className = 'nf-cmd-label';
    label.textContent = cmd.label;
    text.appendChild(label);
    if (cmd.description) {
      const desc = document.createElement('div');
      desc.className = 'nf-cmd-desc';
      desc.textContent = cmd.description;
      text.appendChild(desc);
    }

    row.appendChild(icon);
    row.appendChild(text);
    if (cmd.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'nf-cmd-shortcut';
      shortcut.textContent = cmd.shortcut;
      row.appendChild(shortcut);
    }

    row.addEventListener('click', (e) => onClick(i, e.metaKey || e.ctrlKey));
    row.addEventListener('mouseenter', () => onMouseEnter(i));

    list.appendChild(row);
    rows.push(row);
  });

  return rows;
}
