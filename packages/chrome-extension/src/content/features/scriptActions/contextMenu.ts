import { SCRIPT_ACTIONS_STYLES } from './styles.js';

export interface ActionItem {
  id: string;
  icon: string;
  label: string;
  /** When true, action is shown but disabled. */
  disabled?: boolean;
  /** Optional right-side label, e.g. "Pro". */
  badge?: string;
  /** Group separator before this item. */
  newSection?: boolean;
  onClick?: () => void;
}

export class ScriptActionsMenu {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private menuEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastTimer: number | null = null;
  private isOpen = false;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = '__nowforge_script_actions__';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = SCRIPT_ACTIONS_STYLES;
    this.shadow.appendChild(style);

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'sa-menu';
    this.menuEl.setAttribute('role', 'menu');
    this.shadow.appendChild(this.menuEl);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'sa-toast';
    this.shadow.appendChild(this.toastEl);

    this.attachGlobalListeners();
  }

  private mountIfNeeded(): void {
    if (!this.host.isConnected) document.body.appendChild(this.host);
  }

  open(items: ActionItem[], x: number, y: number): void {
    this.mountIfNeeded();
    this.render(items);
    this.position(x, y);
    requestAnimationFrame(() => this.menuEl.classList.add('open'));
    this.isOpen = true;
  }

  close(): void {
    if (!this.isOpen) return;
    this.menuEl.classList.remove('open');
    this.isOpen = false;
  }

  toast(message: string): void {
    this.mountIfNeeded();
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.toastTimer = null;
    }, 2000);
  }

  private render(items: ActionItem[]): void {
    while (this.menuEl.firstChild) this.menuEl.removeChild(this.menuEl.firstChild);
    let section = document.createElement('div');
    section.className = 'sa-section';
    this.menuEl.appendChild(section);

    for (const item of items) {
      if (item.newSection) {
        section = document.createElement('div');
        section.className = 'sa-section';
        this.menuEl.appendChild(section);
      }
      const btn = document.createElement('button');
      btn.className = 'sa-action';
      btn.type = 'button';
      btn.disabled = !!item.disabled;
      btn.dataset.id = item.id;

      const icon = document.createElement('span');
      icon.className = 'sa-icon';
      icon.textContent = item.icon;
      const label = document.createElement('span');
      label.className = 'sa-label';
      label.textContent = item.label;
      btn.appendChild(icon);
      btn.appendChild(label);
      if (item.badge) {
        const badge = document.createElement('span');
        badge.className = 'sa-pro';
        badge.textContent = item.badge;
        btn.appendChild(badge);
      }
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.close();
        item.onClick?.();
      });
      section.appendChild(btn);
    }
  }

  private position(x: number, y: number): void {
    this.menuEl.style.left = '0px';
    this.menuEl.style.top = '0px';
    const w = this.menuEl.offsetWidth;
    const h = this.menuEl.offsetHeight;
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

  private attachGlobalListeners(): void {
    window.addEventListener('mousedown', (e) => {
      if (!this.isOpen) return;
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
  }
}
