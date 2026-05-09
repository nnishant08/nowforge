import type { PageContext } from '../../../shared/messaging.js';
import {
  captureFields,
  diffAgainst,
  isRecordForm,
  revertField,
  type CapturedField,
} from './valueCapture.js';
import { ChangeBadge } from './badge.js';

const SETTLE_DELAY_MS = 1000;
const POLL_INTERVAL_MS = 1500;

export interface ChangeIndicatorHandle {
  setContext(ctx: PageContext): void;
}

/**
 * Track form-field changes on a SN record form and surface a "N fields
 * changed" badge with per-field revert.
 *
 * Activates only when:
 *   - PageContext.pageType === 'form' (i.e. record form)
 *   - A form root is detected in the DOM
 *
 * On SPA navigation we re-capture from scratch.
 */
export function initChangeIndicator(initialContext: PageContext): ChangeIndicatorHandle {
  let context = initialContext;
  let captured: Map<string, CapturedField> = new Map();
  let badge: ChangeBadge | null = null;
  let pollTimer: number | null = null;
  let formListenersAttached = false;
  let onChangeListener: ((e: Event) => void) | null = null;

  const ensureBadge = (): ChangeBadge => {
    if (!badge) {
      badge = new ChangeBadge({
        onRevert: (name) => {
          const field = captured.get(name);
          if (!field) return;
          revertField(name, field.originalValue);
          // Re-diff after revert
          window.setTimeout(refresh, 50);
        },
        onRevertAll: () => {
          for (const [name, field] of captured) {
            revertField(name, field.originalValue);
          }
          window.setTimeout(refresh, 80);
        },
      });
    }
    return badge;
  };

  const refresh = (): void => {
    if (captured.size === 0) {
      badge?.setChanges([]);
      return;
    }
    const changes = diffAgainst(captured);
    ensureBadge().setChanges(changes);
  };

  const startPolling = (): void => {
    if (pollTimer !== null) return;
    pollTimer = window.setInterval(refresh, POLL_INTERVAL_MS);
  };
  const stopPolling = (): void => {
    if (pollTimer !== null) { window.clearInterval(pollTimer); pollTimer = null; }
  };

  const attachFormListeners = (): void => {
    if (formListenersAttached) return;
    onChangeListener = () => refresh();
    document.addEventListener('input', onChangeListener, true);
    document.addEventListener('change', onChangeListener, true);
    formListenersAttached = true;
  };
  const detachFormListeners = (): void => {
    if (!formListenersAttached || !onChangeListener) return;
    document.removeEventListener('input', onChangeListener, true);
    document.removeEventListener('change', onChangeListener, true);
    formListenersAttached = false;
    onChangeListener = null;
  };

  const teardown = (): void => {
    captured = new Map();
    stopPolling();
    detachFormListeners();
    if (badge) {
      badge.setChanges([]);
      badge.destroy();
      badge = null;
    }
  };

  const startTracking = (): void => {
    teardown();
    if (context.pageType !== 'form') return;
    if (!isRecordForm()) return;

    // Wait for business rules / setValue calls to settle before capturing
    window.setTimeout(() => {
      captured = captureFields();
      if (captured.size === 0) return;
      attachFormListeners();
      startPolling();
      // First refresh in case the user already typed during the settle delay
      refresh();
    }, SETTLE_DELAY_MS);
  };

  // Initial run
  startTracking();

  return {
    setContext(ctx) {
      const pageChanged =
        ctx.url !== context.url ||
        ctx.tableName !== context.tableName ||
        ctx.sysId !== context.sysId;
      context = ctx;
      if (pageChanged) startTracking();
    },
  };
}
