import type { UibEvent } from '../../../shared/messaging.js';
import { CAPTURED_DOM_EVENTS } from './selectors.js';
import { getUibScanDocument } from './uibDetector.js';

/**
 * Captures common DOM events from the UIB preview document and emits them
 * to a callback (which the bridge then batches up to the side panel).
 *
 * NOTE: This v1 only sees real DOM events bubbled to document level. Custom
 * Now-Experience events (DATA_FETCH_*, STATE_CHANGED, etc.) would require
 * monkey-patching `EventTarget.prototype.dispatchEvent` from a document_start
 * page-context script — deferred. The Event Log UI labels these tones so
 * the v2 expansion plugs in cleanly.
 */

export type EventEmitter = (event: UibEvent) => void;

let attachedDoc: Document | null = null;
let listeners: Array<{ type: string; handler: EventListener }> = [];

function describeTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return '(unknown)';
  const tag = target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : '';
  const cls = target.classList.length > 0 ? '.' + target.classList[0] : '';
  return `${tag}${id || cls}`;
}

function classifyTone(eventType: string): UibEvent['tone'] {
  if (eventType === 'click' || eventType === 'submit' ||
      eventType === 'focus' || eventType === 'blur') return 'user';
  if (eventType === 'input' || eventType === 'change') return 'state';
  return 'render';
}

function detachAll(): void {
  if (!attachedDoc) return;
  for (const { type, handler } of listeners) {
    attachedDoc.removeEventListener(type, handler, true);
  }
  listeners = [];
  attachedDoc = null;
}

export function startCapture(emit: EventEmitter): void {
  detachAll();
  const doc = getUibScanDocument();
  attachedDoc = doc;

  for (const eventType of CAPTURED_DOM_EVENTS) {
    const handler: EventListener = (e: Event) => {
      const tone = classifyTone(eventType);
      emit({
        timestamp: Date.now(),
        type: `USER_${eventType.toUpperCase()}`,
        tone,
        source: describeTarget(e.target),
        detail: '',
      });
    };
    doc.addEventListener(eventType, handler, true);
    listeners.push({ type: eventType, handler });
  }
}

export function stopCapture(): void {
  detachAll();
}
