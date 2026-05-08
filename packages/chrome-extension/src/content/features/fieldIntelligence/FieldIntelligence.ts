import type { PageContext } from '../../../shared/messaging.js';
import type { FieldRef } from './types.js';
import {
  extractFieldFromInput,
  findAssociatedInput,
  findFieldLabel,
} from './metadata.js';
import { FIELD_INTEL_STYLES } from './styles.js';
import { FieldContextMenu } from './contextMenu.js';
import { FieldTooltips } from './tooltips.js';

const HOST_ID = '__nowforge_field_intel__';

/**
 * Right-click and hover behaviour for field labels on ServiceNow forms.
 *
 * Single Shadow-DOM host → context menu, hover tooltip, and toast all live
 * inside it. The host stays mounted after first init; only its child
 * elements toggle visibility.
 */
export class FieldIntelligence {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private toastEl: HTMLDivElement;
  private toastTimer: number | null = null;
  private menu: FieldContextMenu;
  private tooltips: FieldTooltips;
  private context: PageContext;
  private tooltipsEnabled = false;
  private contextMenuListenerAttached = false;

  constructor(initialContext: PageContext) {
    this.context = initialContext;

    // ── Mount shared host ─────────────────────────────────────────────
    const existing = document.getElementById(HOST_ID);
    if (existing) existing.remove();
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    const styleEl = document.createElement('style');
    styleEl.textContent = FIELD_INTEL_STYLES;
    this.shadow.appendChild(styleEl);

    // Toast
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'nf-fi-toast';
    this.shadow.appendChild(this.toastEl);

    if (document.body) document.body.appendChild(this.host);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(this.host), { once: true });

    // ── Construct sub-components ──────────────────────────────────────
    this.menu = new FieldContextMenu({
      shadow: this.shadow,
      toast: (msg) => this.showToast(msg),
      getBaseUrl: () => this.context.instanceInfo?.baseUrl ?? null,
    });

    this.tooltips = new FieldTooltips({
      shadow: this.shadow,
      resolveLabel: (label) => this.resolveFieldFromLabel(label),
    });

    // Right-click listener — always on
    this.attachContextMenuListener();
  }

  // ── Public ────────────────────────────────────────────────────────────

  setContext(ctx: PageContext): void {
    this.context = ctx;
  }

  setTooltipsEnabled(enabled: boolean): void {
    if (enabled === this.tooltipsEnabled) return;
    this.tooltipsEnabled = enabled;
    if (enabled) this.tooltips.enable();
    else this.tooltips.disable();
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private resolveFieldFromLabel(label: HTMLElement): FieldRef | null {
    const input = findAssociatedInput(label);
    if (!input) return null;
    return extractFieldFromInput(input, this.context.tableName ?? null);
  }

  private attachContextMenuListener(): void {
    if (this.contextMenuListenerAttached) return;
    this.contextMenuListenerAttached = true;
    document.addEventListener('contextmenu', (e) => {
      const label = findFieldLabel(e.target);
      if (!label) return;
      const ref = this.resolveFieldFromLabel(label);
      if (!ref) return;
      // We have a real field — take over the right-click
      e.preventDefault();
      e.stopPropagation();
      this.menu.open(ref, e.clientX, e.clientY);
    }, { capture: true });
  }

  private showToast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('show');
    // Force reflow so re-show during fade still triggers transition
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.toastTimer = null;
    }, 2000);
  }
}
