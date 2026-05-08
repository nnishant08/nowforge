import type { FieldMetadata, FieldRef } from './types.js';
import { getFieldMetadata, getCachedMetadata } from './metadata.js';

/**
 * Custom right-click context menu rendered in a Shadow DOM. Lives inside
 * the field-intelligence host element managed by FieldIntelligence.ts.
 */

export interface ContextMenuDeps {
  /** Shadow root supplied by FieldIntelligence (shared with tooltip + toast). */
  shadow: ShadowRoot;
  /** Bottom-center toast trigger (also shared). */
  toast: (message: string) => void;
  /** Get the current page's instance base URL (for navigation actions). */
  getBaseUrl: () => string | null;
}

export class FieldContextMenu {
  private menuEl: HTMLDivElement;
  private isOpen = false;
  private currentRef: FieldRef | null = null;
  private currentMeta: FieldMetadata | null = null;

  constructor(private readonly deps: ContextMenuDeps) {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'nf-fi-menu';
    this.menuEl.setAttribute('role', 'menu');
    deps.shadow.appendChild(this.menuEl);

    this.attachGlobalListeners();
  }

  /**
   * Show menu for a (table, field) pair at viewport coordinates (x, y).
   * Renders in two passes: synchronous skeleton, then full info when REST
   * resolves (or instantly if cached).
   */
  open(ref: FieldRef, x: number, y: number): void {
    this.currentRef = ref;

    // First paint — instant if cache hit, otherwise loading
    const cached = getCachedMetadata(ref);
    this.currentMeta = cached;
    this.render(ref, cached);

    // Position before opacity transitions in
    this.position(x, y);

    requestAnimationFrame(() => {
      this.menuEl.classList.add('open');
    });
    this.isOpen = true;

    if (!cached) {
      // Async fetch
      void getFieldMetadata(ref).then((meta) => {
        if (!this.isOpen || this.currentRef !== ref) return;
        this.currentMeta = meta;
        this.render(ref, meta);
      });
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.menuEl.classList.remove('open');
    this.isOpen = false;
    this.currentRef = null;
    this.currentMeta = null;
  }

  // ── Layout ────────────────────────────────────────────────────────────

  private position(x: number, y: number): void {
    // First make it visible to measure (but still 0 opacity)
    this.menuEl.style.left = '0px';
    this.menuEl.style.top = '0px';

    const { offsetWidth: w, offsetHeight: h } = this.menuEl;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let left = x + 4;
    let top = y + 4;
    if (left + w + margin > vw) left = Math.max(margin, vw - w - margin);
    if (top + h + margin > vh) top = Math.max(margin, y - h - 4);

    this.menuEl.style.left = `${left}px`;
    this.menuEl.style.top = `${top}px`;
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  private render(ref: FieldRef, meta: FieldMetadata | null): void {
    while (this.menuEl.firstChild) this.menuEl.removeChild(this.menuEl.firstChild);

    // Header section (field name + type)
    const head = section();
    const headRow = document.createElement('div');
    headRow.className = 'nf-fi-head';
    const nameEl = document.createElement('div');
    nameEl.className = 'nf-fi-name';
    nameEl.textContent = meta?.element ?? ref.field;
    const copyName = iconButton('📋', 'Copy field name');
    copyName.addEventListener('click', () => {
      this.copy(meta?.element ?? ref.field, '✓ Field name copied');
    });
    headRow.appendChild(nameEl);
    headRow.appendChild(copyName);
    head.appendChild(headRow);

    const typeEl = document.createElement('div');
    typeEl.className = 'nf-fi-type';
    typeEl.textContent = meta ? meta.prettyType : 'Loading…';
    head.appendChild(typeEl);
    this.menuEl.appendChild(head);

    // Details section (only after metadata loaded)
    if (meta) {
      const details = section();
      details.appendChild(row('Column', meta.element));
      if (meta.maxLength) details.appendChild(row('Max length', meta.maxLength));
      if (meta.columnLabel && meta.columnLabel !== meta.element) {
        details.appendChild(row('Label', meta.columnLabel));
      }

      const flags = document.createElement('div');
      flags.className = 'nf-fi-flags';
      flags.appendChild(flag('Mandatory', meta.mandatory ? 'Yes' : 'No'));
      flags.appendChild(flag('Read-only', meta.readOnly ? 'Yes' : 'No'));
      details.appendChild(flags);

      this.menuEl.appendChild(details);
    } else {
      const loading = document.createElement('div');
      loading.className = 'nf-fi-loading';
      loading.textContent = 'Loading dictionary entry…';
      this.menuEl.appendChild(loading);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'nf-fi-actions';

    actions.appendChild(this.actionButton('📋', 'Copy field name', () => {
      this.copy(meta?.element ?? ref.field, '✓ Field name copied');
    }));
    actions.appendChild(this.actionButton('🔗', 'Copy dot-walk path', () => {
      this.copy(`${ref.table}.${ref.field}`, '✓ Dot-walk path copied');
    }));
    actions.appendChild(this.actionButton(
      '📖',
      'Open dictionary entry',
      () => this.openDictionary(ref, meta),
      Boolean(this.deps.getBaseUrl())
    ));
    actions.appendChild(this.actionButton(
      '🔍',
      'Open in list',
      () => this.openInList(ref),
      Boolean(this.deps.getBaseUrl())
    ));

    this.menuEl.appendChild(actions);
  }

  private actionButton(
    icon: string,
    label: string,
    onClick: () => void,
    enabled = true
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'nf-fi-action';
    btn.type = 'button';
    btn.disabled = !enabled;
    const iconEl = document.createElement('span');
    iconEl.className = 'nf-fi-action-icon';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.textContent = label;
    btn.appendChild(iconEl);
    btn.appendChild(textEl);
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      onClick();
      this.close();
    });
    return btn;
  }

  // ── Actions ───────────────────────────────────────────────────────────

  private copy(text: string, toastMsg: string): void {
    void navigator.clipboard.writeText(text).then(() => {
      this.deps.toast(toastMsg);
    }).catch(() => {
      this.deps.toast('Copy failed');
    });
    this.close();
  }

  private openDictionary(ref: FieldRef, meta: FieldMetadata | null): void {
    const baseUrl = this.deps.getBaseUrl();
    if (!baseUrl) return;

    // If we have the sys_id, go directly to the record. Otherwise filter.
    const url = meta?.sysId
      ? `${baseUrl}/sys_dictionary.do?sys_id=${meta.sysId}`
      : `${baseUrl}/sys_dictionary_list.do?sysparm_query=${encodeURIComponent(`name=${ref.table}^element=${ref.field}`)}`;
    window.location.href = url;
  }

  private openInList(ref: FieldRef): void {
    const baseUrl = this.deps.getBaseUrl();
    if (!baseUrl) return;
    // Open the table list ordered by this field, descending. Useful for
    // "what's the most-recent <field>" type questions.
    const url = `${baseUrl}/${ref.table}_list.do?sysparm_orderby_desc=${encodeURIComponent(ref.field)}`;
    window.location.href = url;
  }

  // ── Global outside-click / Escape / scroll ────────────────────────────

  private attachGlobalListeners(): void {
    // Click anywhere outside → close. Use capture so we run before SN.
    window.addEventListener('mousedown', (e) => {
      if (!this.isOpen) return;
      // Re-enter the menu? Don't close. The menu lives inside our shadow root,
      // and closed shadow events retarget to the host so clicks inside come
      // through as the host element.
      const path = e.composedPath();
      if (path.includes(this.menuEl)) return;
      this.close();
    }, { capture: true });

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, { capture: true });

    window.addEventListener('scroll', () => {
      if (this.isOpen) this.close();
    }, { capture: true, passive: true });

    window.addEventListener('resize', () => {
      if (this.isOpen) this.close();
    }, { passive: true });
  }
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

function section(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'nf-fi-section';
  return el;
}

function row(k: string, v: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'nf-fi-row';
  const ke = document.createElement('span');
  ke.className = 'k';
  ke.textContent = k;
  const ve = document.createElement('span');
  ve.className = 'v';
  ve.textContent = v;
  el.appendChild(ke);
  el.appendChild(ve);
  return el;
}

function flag(label: string, value: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'nf-fi-flag';
  el.innerHTML = `${label}: <b></b>`;
  el.querySelector('b')!.textContent = value;
  return el;
}

function iconButton(text: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'nf-fi-copy';
  btn.type = 'button';
  btn.title = title;
  btn.textContent = text;
  return btn;
}
