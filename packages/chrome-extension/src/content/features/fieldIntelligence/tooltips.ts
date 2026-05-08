import type { FieldRef } from './types.js';
import { getCachedMetadata, getFieldMetadata } from './metadata.js';

/**
 * Hover tooltips that surface the technical field name and (when available)
 * its type, in a small monospace pill below the label.
 *
 * Behaviour notes:
 *   • Only attached when `enabled` is true; cleanup tears down the listeners.
 *   • Resolves field info lazily on hover, then caches per-element via WeakMap.
 *   • Tooltip waits 300 ms before showing to avoid flicker on quick mouse-overs.
 *   • Type is best-effort — uses the in-memory cache if present, otherwise just
 *     fires the REST fetch silently and updates the tooltip if still hovered.
 */

export interface TooltipDeps {
  shadow: ShadowRoot;
  /** Resolves a label → field reference. Identical to the context-menu helper. */
  resolveLabel: (label: HTMLElement) => FieldRef | null;
}

const SHOW_DELAY_MS = 300;
const HIDE_DELAY_MS = 80;

export class FieldTooltips {
  private el: HTMLDivElement;
  private currentLabel: HTMLElement | null = null;
  private showTimer: number | null = null;
  private hideTimer: number | null = null;
  private resolved = new WeakMap<HTMLElement, FieldRef>();
  private listenersAttached = false;
  private boundOver: (e: MouseEvent) => void;
  private boundOut: (e: MouseEvent) => void;
  private boundScroll: () => void;

  constructor(private readonly deps: TooltipDeps) {
    this.el = document.createElement('div');
    this.el.className = 'nf-fi-tooltip';
    deps.shadow.appendChild(this.el);

    this.boundOver = this.onMouseOver.bind(this);
    this.boundOut = this.onMouseOut.bind(this);
    this.boundScroll = () => this.hide();
  }

  enable(): void {
    if (this.listenersAttached) return;
    document.addEventListener('mouseover', this.boundOver, { passive: true });
    document.addEventListener('mouseout', this.boundOut, { passive: true });
    window.addEventListener('scroll', this.boundScroll, { capture: true, passive: true });
    this.listenersAttached = true;
  }

  disable(): void {
    if (!this.listenersAttached) return;
    document.removeEventListener('mouseover', this.boundOver);
    document.removeEventListener('mouseout', this.boundOut);
    window.removeEventListener('scroll', this.boundScroll, { capture: true } as EventListenerOptions);
    this.listenersAttached = false;
    this.hide();
  }

  // ── Event handlers ────────────────────────────────────────────────────

  private onMouseOver(e: MouseEvent): void {
    const label = this.deps.resolveLabel(e.target as HTMLElement);
    if (!label) return;
    if (label === this.currentLabel) return;

    this.currentLabel = label;
    this.cancelHide();

    if (this.showTimer !== null) window.clearTimeout(this.showTimer);
    this.showTimer = window.setTimeout(() => {
      this.showTimer = null;
      this.maybeShow(label);
    }, SHOW_DELAY_MS);
  }

  private onMouseOut(e: MouseEvent): void {
    if (!this.currentLabel) return;
    // Only reset when leaving the current label
    const related = e.relatedTarget as Node | null;
    if (related && this.currentLabel.contains(related)) return;

    if (this.showTimer !== null) {
      window.clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    this.scheduleHide();
    this.currentLabel = null;
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
  private scheduleHide(): void {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      this.hide();
      this.hideTimer = null;
    }, HIDE_DELAY_MS);
  }

  // ── Resolution + render ───────────────────────────────────────────────

  private maybeShow(label: HTMLElement): void {
    let ref = this.resolved.get(label);
    if (!ref) {
      const next = this.deps.resolveLabel(label);
      if (!next) return;
      ref = next;
      this.resolved.set(label, ref);
    }

    // Render with whatever's available now (cache hit → with type, otherwise just name)
    const meta = getCachedMetadata(ref);
    this.render(label, ref, meta?.prettyType ?? null);

    // Async upgrade — if we don't have type yet, fetch and re-render
    if (!meta) {
      void getFieldMetadata(ref).then((m) => {
        if (this.currentLabel !== label) return;
        if (!m) return;
        this.render(label, ref, m.prettyType);
      });
    }
  }

  private render(label: HTMLElement, ref: FieldRef, type: string | null): void {
    while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    const nameSpan = document.createElement('span');
    nameSpan.textContent = ref.field;
    this.el.appendChild(nameSpan);
    if (type) {
      const typeSpan = document.createElement('span');
      typeSpan.className = 'type';
      typeSpan.textContent = type;
      this.el.appendChild(typeSpan);
    }

    // Position below label, clamped to viewport
    const rect = label.getBoundingClientRect();
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    this.el.classList.add('show');

    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const margin = 8;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + w + margin > window.innerWidth) left = window.innerWidth - w - margin;
    if (top + h + margin > window.innerHeight) top = rect.top - h - 4;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  private hide(): void {
    this.el.classList.remove('show');
  }
}
