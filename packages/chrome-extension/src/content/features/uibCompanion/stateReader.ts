import type { UibClientState } from '../../../shared/messaging.js';
import { readClientState } from './pageContextBridge.js';
import { getUibPageWindow } from './uibDetector.js';

/**
 * Best-effort read of the UIB client state via the page-context bridge.
 * Maps the bridge result into the typed UibClientState shape.
 */
export async function readUibClientState(): Promise<UibClientState> {
  const win = getUibPageWindow();
  const result = await readClientState(win);

  if ((result as { __error?: string }).__error) {
    return {
      json: null,
      source: 'unavailable',
      error: (result as { __error?: string }).__error,
    };
  }

  if (result.value == null) {
    return { json: null, source: 'unavailable' };
  }

  // Map the raw eval-source string back to a friendly tone
  const src = result.source ?? 'unavailable';
  let source: UibClientState['source'] = 'fallback';
  if (src.includes('__STORE__')) source = 'store';
  else if (src.includes('NOW') && src.includes('uib')) source = 'uib';
  else if (src === 'unavailable') source = 'unavailable';

  return { json: result.value, source };
}
