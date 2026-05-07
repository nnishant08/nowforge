/**
 * Lightweight toast that lives inside the command bar's shadow root, so it
 * shares the same isolated styles. Auto-dismisses after a fixed timeout.
 * Re-firing while a toast is on screen replaces the message and resets the timer.
 */

const SHOW_MS = 2000;

export function makeToastController(shadow: ShadowRoot, parent: HTMLElement) {
  const el = document.createElement('div');
  el.className = 'nf-cmd-toast';
  parent.appendChild(el);
  void shadow; // shadow ref captured for symmetry; nothing else needed

  let timer: number | null = null;

  return {
    show(message: string): void {
      el.textContent = message;
      // Force reflow so re-show after a recent dismissal still triggers transition
      el.classList.remove('show');
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      void el.offsetWidth;
      el.classList.add('show');
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.classList.remove('show');
        timer = null;
      }, SHOW_MS);
    },
  };
}
