import type { PageContext } from '../../../shared/messaging.js';
import { CommandBar } from './CommandBar.js';

export { CommandBar };

let instance: CommandBar | null = null;

/** Lazily create the singleton on first use. */
function getInstance(initialContext: PageContext): CommandBar {
  if (!instance) instance = new CommandBar(initialContext);
  return instance;
}

/**
 * Wire up the global Cmd/Ctrl+K binding. Must be called once during init.
 * Listens in the capture phase so SN's own keyboard handlers can't swallow it.
 *
 * Returns a refresh fn the caller invokes on SPA nav so the singleton's
 * PageContext stays current (used for Copy sys_id, Open XML, etc.).
 */
export function initCommandBar(initialContext: PageContext): (ctx: PageContext) => void {
  const bar = getInstance(initialContext);

  const isToggleKey = (e: KeyboardEvent): boolean =>
    (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K');

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isToggleKey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    bar.toggle();
  };

  // Capture phase — beats SN's own document/window-level handlers.
  window.addEventListener('keydown', onKeyDown, { capture: true });

  // Background may forward a chrome.commands hotkey via runtime message.
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === 'TOGGLE_COMMAND_BAR') bar.toggle();
    return false;
  });

  return (ctx: PageContext) => bar.setContext(ctx);
}
