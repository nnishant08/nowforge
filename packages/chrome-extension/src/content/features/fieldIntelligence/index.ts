import type { PageContext } from '../../../shared/messaging.js';
import { getSettings, subscribeSettings } from '../../../shared/settings.js';
import { FieldIntelligence } from './FieldIntelligence.js';

export { FieldIntelligence };

/**
 * Initialise field-intelligence on a SN page.
 *
 * Right-click on a field label → custom menu (always on).
 * Hover tooltips → respects `features.fieldTooltips` from settings (off by
 * default). Subscribes to settings changes so the options-page toggle and the
 * "Toggle field tooltips" command both apply live without a reload.
 *
 * Returns a refresh fn the content-script orchestrator calls on SPA nav so
 * the singleton's PageContext stays current.
 */
export async function initFieldIntelligence(
  initialContext: PageContext
): Promise<(ctx: PageContext) => void> {
  const fi = new FieldIntelligence(initialContext);

  const settings = await getSettings();
  fi.setTooltipsEnabled(settings.features.fieldTooltips);

  subscribeSettings((next) => {
    fi.setTooltipsEnabled(next.features.fieldTooltips);
  });

  return (ctx: PageContext) => fi.setContext(ctx);
}
