import type { PageContext } from '../../../shared/messaging.js';
import type { Command } from './types.js';
import { buildOverlay, renderResults, type OverlayHandles } from './ui.js';
import { rankCommands } from './search.js';
import { buildAllCommands, buildDynamicCommands } from './commands.js';

const USAGE_KEY = 'nowforge_command_usage';

export class CommandBar {
  private overlay: OverlayHandles | null = null;
  private isOpen = false;
  private context: PageContext;
  private staticCommands: Command[];
  private filtered: Command[] = [];
  private selectedIndex = 0;
  private usageCounts: Record<string, number> = {};

  constructor(initialContext: PageContext) {
    this.context = initialContext;
    this.staticCommands = buildAllCommands({
      toast: (msg) => this.overlay?.toast.show(msg),
    });
    void this.loadUsageCounts();
  }

  // ── Public API ────────────────────────────────────────────────────────

  setContext(ctx: PageContext): void {
    this.context = ctx;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (!this.overlay) this.overlay = buildOverlay();
    if (!this.overlay.host.isConnected) document.body.appendChild(this.overlay.host);

    this.attachListenersOnce();

    // Reset state
    this.overlay.input.value = '';
    this.refilter('');

    requestAnimationFrame(() => {
      this.overlay?.overlay.classList.add('open');
      this.overlay?.input.focus();
      this.overlay?.input.select();
    });
    this.isOpen = true;
  }

  close(): void {
    if (!this.overlay || !this.isOpen) return;
    this.overlay.overlay.classList.remove('open');
    this.isOpen = false;
    // Defer focus return so the .open class actually animates out
    setTimeout(() => {
      try { this.overlay?.input.blur(); } catch { /* ignore */ }
    }, 0);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private listenersAttached = false;
  private attachListenersOnce(): void {
    if (this.listenersAttached || !this.overlay) return;
    this.listenersAttached = true;

    const { input, overlay } = this.overlay;

    // Input events
    input.addEventListener('input', () => this.refilter(input.value));

    input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          this.close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          this.move(+1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          this.move(-1);
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          void this.executeSelected(e.metaKey || e.ctrlKey);
          break;
      }
    });

    // Click on the dim backdrop closes; clicks inside the panel don't
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) this.close();
    });
  }

  private refilter(query: string): void {
    if (!this.overlay) return;
    const dynamic = buildDynamicCommands(query);
    const available = this.staticCommands.filter(
      (c) => !c.isAvailable || c.isAvailable(this.context)
    );
    const ranked = rankCommands(available, query, this.usageCounts);
    this.filtered = [...dynamic, ...ranked];
    this.selectedIndex = 0;
    this.render();
  }

  private render(): void {
    if (!this.overlay) return;
    renderResults({
      list: this.overlay.list,
      commands: this.filtered,
      selectedIndex: this.selectedIndex,
      onClick: (i, withMod) => {
        this.selectedIndex = i;
        void this.executeSelected(withMod);
      },
      onMouseEnter: (i) => {
        if (i === this.selectedIndex) return;
        this.selectedIndex = i;
        this.updateSelectedClassOnly();
      },
    });
  }

  /** Lightweight DOM mutation when only the highlight needs to change. */
  private updateSelectedClassOnly(): void {
    if (!this.overlay) return;
    this.overlay.list.querySelectorAll<HTMLLIElement>('.nf-cmd-row').forEach((row) => {
      const idx = Number(row.dataset.index);
      row.classList.toggle('selected', idx === this.selectedIndex);
    });
  }

  private move(delta: number): void {
    if (this.filtered.length === 0) return;
    const next = this.selectedIndex + delta;
    if (next < 0) this.selectedIndex = this.filtered.length - 1;
    else if (next >= this.filtered.length) this.selectedIndex = 0;
    else this.selectedIndex = next;
    this.updateSelectedClassOnly();
    this.scrollSelectedIntoView();
  }

  private scrollSelectedIntoView(): void {
    if (!this.overlay) return;
    const row = this.overlay.list.querySelector<HTMLLIElement>(
      `.nf-cmd-row[data-index="${this.selectedIndex}"]`
    );
    row?.scrollIntoView({ block: 'nearest' });
  }

  private async executeSelected(newTab: boolean): Promise<void> {
    const cmd = this.filtered[this.selectedIndex];
    if (!cmd) return;
    const query = this.overlay?.input.value ?? '';

    // Increment usage BEFORE execution (in case execute navigates away)
    this.bumpUsage(cmd.id);

    // Close the bar BEFORE running navigation commands so the page change
    // doesn't happen with a half-faded overlay.
    if (cmd.category === 'navigation' || cmd.category === 'search') {
      this.close();
    }

    try {
      await cmd.execute(this.context, { newTab, query });
    } catch (err) {
      console.error('[NowForge] command execute failed:', err);
      this.overlay?.toast.show('Command failed — see console');
    }

    // For action commands we leave the bar open if a toast was shown
    // (executor returns and toast is already up). Auto-close so it feels snappy.
    if (cmd.category === 'action' && this.isOpen) {
      this.close();
    }
  }

  // ── Usage tracking ────────────────────────────────────────────────────

  private async loadUsageCounts(): Promise<void> {
    try {
      const stored = await new Promise<unknown>((resolve) => {
        chrome.storage.local.get(USAGE_KEY, (r) => resolve(r[USAGE_KEY]));
      });
      this.usageCounts = (stored as Record<string, number>) ?? {};
    } catch {
      this.usageCounts = {};
    }
  }

  private bumpUsage(commandId: string): void {
    this.usageCounts[commandId] = (this.usageCounts[commandId] ?? 0) + 1;
    try {
      void chrome.storage.local.set({ [USAGE_KEY]: this.usageCounts });
    } catch { /* ignore */ }
  }
}
