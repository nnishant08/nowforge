import { CHANGE_INDICATOR_STYLES } from './styles.js';
import type { FieldChange } from './valueCapture.js';

export interface BadgeCallbacks {
  /** Revert a single field. */
  onRevert: (name: string) => void;
  /** Revert all fields. */
  onRevertAll: () => void;
}

const HOST_ID = '__nowforge_change_indicator__';

/**
 * Renders the floating "N fields changed" badge plus a click-to-open panel
 * showing per-field old vs new values with revert buttons.
 *
 * Position: tries to anchor below the form's `.navbar`/`.form-header`/title
 * area. Falls back to top-right of viewport if no anchor is found.
 */
export class ChangeBadge {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private badgeEl: HTMLButtonElement;
  private panelEl: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private countEl: HTMLSpanElement;
  private isPanelOpen = false;
  private latestChanges: FieldChange[] = [];

  constructor(private readonly callbacks: BadgeCallbacks) {
    const existing = document.getElementById(HOST_ID);
    if (existing) existing.remove();

    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CHANGE_INDICATOR_STYLES;
    this.shadow.appendChild(style);

    this.badgeEl = document.createElement('button');
    this.badgeEl.type = 'button';
    this.badgeEl.className = 'ci-badge';
    this.badgeEl.innerHTML = `
      <span class="ci-badge__dot"></span>
      <span class="ci-badge__text">0 fields changed</span>
    `;
    this.badgeEl.addEventListener('click', () => this.togglePanel());
    this.shadow.appendChild(this.badgeEl);

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'ci-panel';
    this.panelEl.setAttribute('role', 'dialog');
    this.shadow.appendChild(this.panelEl);

    const head = document.createElement('div');
    head.className = 'ci-panel__head';
    const title = document.createElement('div');
    title.className = 'ci-panel__title';
    title.textContent = 'Unsaved Changes';
    this.countEl = document.createElement('span');
    this.countEl.className = 'ci-panel__count';
    const revertAll = document.createElement('button');
    revertAll.type = 'button';
    revertAll.className = 'ci-btn ci-btn--danger';
    revertAll.textContent = 'Revert All';
    revertAll.addEventListener('click', () => this.callbacks.onRevertAll());
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ci-btn ci-btn--ghost';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.closePanel());

    head.appendChild(title);
    head.appendChild(this.countEl);
    head.appendChild(revertAll);
    head.appendChild(closeBtn);
    this.panelEl.appendChild(head);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'ci-panel__body';
    this.panelEl.appendChild(this.bodyEl);

    this.attachGlobalListeners();
  }

  /** Update the badge + panel with the latest set of changes. */
  setChanges(changes: FieldChange[]): void {
    this.latestChanges = changes;
    if (!this.host.isConnected) document.body.appendChild(this.host);

    if (changes.length === 0) {
      this.badgeEl.classList.remove('show');
      if (this.isPanelOpen) this.closePanel();
      return;
    }
    const text = `${changes.length} field${changes.length === 1 ? '' : 's'} changed`;
    const textEl = this.badgeEl.querySelector('.ci-badge__text');
    if (textEl) textEl.textContent = text;
    this.countEl.textContent = String(changes.length);

    this.positionBadge();
    this.badgeEl.classList.add('show');
    if (this.isPanelOpen) this.renderPanelBody();
  }

  destroy(): void {
    this.host.remove();
  }

  // ── Panel ─────────────────────────────────────────────────────────────

  private togglePanel(): void {
    if (this.isPanelOpen) this.closePanel();
    else this.openPanel();
  }

  private openPanel(): void {
    this.renderPanelBody();
    this.positionPanel();
    this.panelEl.classList.add('show');
    this.isPanelOpen = true;
  }

  private closePanel(): void {
    this.panelEl.classList.remove('show');
    this.isPanelOpen = false;
  }

  private renderPanelBody(): void {
    while (this.bodyEl.firstChild) this.bodyEl.removeChild(this.bodyEl.firstChild);
    for (const change of this.latestChanges) {
      this.bodyEl.appendChild(this.buildRow(change));
    }
  }

  private buildRow(change: FieldChange): HTMLElement {
    const row = document.createElement('div');
    row.className = 'ci-row';

    const head = document.createElement('div');
    head.className = 'ci-row__head';
    const label = document.createElement('div');
    label.className = 'ci-row__label';
    label.textContent = change.label || change.name;
    label.title = `${change.label || change.name} (${change.name})`;
    const revertBtn = document.createElement('button');
    revertBtn.type = 'button';
    revertBtn.className = 'ci-btn';
    revertBtn.textContent = 'Revert';
    revertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onRevert(change.name);
    });
    head.appendChild(label);
    head.appendChild(revertBtn);
    row.appendChild(head);

    const values = document.createElement('div');
    values.className = 'ci-row__values';
    if (!change.isJournal) {
      values.appendChild(this.buildValueLine('was', change.oldDisplay || change.oldValue));
    }
    values.appendChild(this.buildValueLine('now', change.newDisplay || change.newValue));
    if (change.isJournal) {
      const note = document.createElement('div');
      note.className = 'ci-row__journal';
      note.textContent = '(append-only journal field)';
      values.appendChild(note);
    }
    row.appendChild(values);
    return row;
  }

  private buildValueLine(tag: 'was' | 'now', value: string): HTMLDivElement {
    const line = document.createElement('div');
    line.className = 'ci-row__line';
    const tagEl = document.createElement('span');
    tagEl.className = `ci-row__tag ci-row__tag--${tag}`;
    tagEl.textContent = tag;
    const valEl = document.createElement('span');
    valEl.className = 'ci-row__val';
    if (!value) {
      valEl.classList.add('ci-row__val--empty');
      valEl.textContent = '(empty)';
    } else {
      valEl.textContent = value.length > 200 ? value.slice(0, 200) + '…' : value;
    }
    line.appendChild(tagEl);
    line.appendChild(valEl);
    return line;
  }

  // ── Positioning ───────────────────────────────────────────────────────

  private positionBadge(): void {
    const anchor = this.findAnchor();
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      this.badgeEl.style.top = `${Math.max(8, rect.bottom + 4)}px`;
      this.badgeEl.style.left = `${Math.max(8, rect.left)}px`;
      this.badgeEl.style.right = '';
    } else {
      this.badgeEl.style.top = '8px';
      this.badgeEl.style.right = '8px';
      this.badgeEl.style.left = '';
    }
  }

  private positionPanel(): void {
    const rect = this.badgeEl.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    const panelWidth = 380;
    if (left + panelWidth + 8 > window.innerWidth) left = window.innerWidth - panelWidth - 8;
    if (top + 480 > window.innerHeight) top = Math.max(8, rect.top - 480 - 6);
    this.panelEl.style.top = `${Math.max(8, top)}px`;
    this.panelEl.style.left = `${Math.max(8, left)}px`;
  }

  private findAnchor(): Element | null {
    return (
      document.querySelector('.navbar .breadcrumb_container') ||
      document.querySelector('#title_text') ||
      document.querySelector('.navbar h1') ||
      document.querySelector('.form-header') ||
      document.querySelector('.section_header_label') ||
      null
    );
  }

  // ── Outside / Esc closes the panel ────────────────────────────────────

  private attachGlobalListeners(): void {
    window.addEventListener('mousedown', (e) => {
      if (!this.isPanelOpen) return;
      const path = e.composedPath();
      if (path.includes(this.panelEl) || path.includes(this.badgeEl)) return;
      this.closePanel();
    }, { capture: true });

    window.addEventListener('keydown', (e) => {
      if (this.isPanelOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closePanel();
      }
    }, { capture: true });

    // Reposition on scroll/resize
    window.addEventListener('resize', () => {
      if (this.host.isConnected && this.badgeEl.classList.contains('show')) {
        this.positionBadge();
        if (this.isPanelOpen) this.positionPanel();
      }
    });
  }
}
