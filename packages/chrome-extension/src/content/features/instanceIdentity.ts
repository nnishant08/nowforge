import type { PageContext } from '../../shared/messaging.js';
import {
  classifyEnv,
  getSettings,
  subscribeSettings,
  type Feature1Settings,
} from '../../shared/settings.js';
import { applyFaviconWithRetries } from './faviconBadge.js';
import { startTabTitle, stopTabTitle } from './tabTitle.js';
import { mountInstanceTag, unmountInstanceTag } from './instanceTag.js';

/**
 * Top-level coordinator for Feature 1 (Instance Identity).
 * Reads user settings, applies the three sub-features (favicon, tag, title)
 * and re-applies them on SPA navigation and on settings changes.
 */

let lastContext: PageContext | null = null;
let lastSettings: Feature1Settings | null = null;
let unsubSettings: (() => void) | null = null;

function resolveLabel(envType: string, ruleLabel: string | undefined): string {
  return (ruleLabel ?? envType).toUpperCase();
}

function resolveColor(
  envType: keyof Feature1Settings['envColors'],
  ruleColor: string | undefined,
  envColors: Feature1Settings['envColors']
): string {
  return ruleColor ?? envColors[envType] ?? envColors.unknown;
}

async function applyAll(context: PageContext, settings: Feature1Settings): Promise<void> {
  if (!context.instanceInfo) {
    // Not on a SN page — tear down everything
    unmountInstanceTag();
    stopTabTitle();
    return;
  }

  const { instanceName, environmentType, baseUrl } = context.instanceInfo;

  // Apply custom rules from settings — they can override the env type
  const { envType, rule } = classifyEnv(
    instanceName,
    settings.customRules,
    environmentType
  );
  const label = resolveLabel(envType, rule?.label);
  const color = resolveColor(envType, rule?.color, settings.envColors);

  // 1. Tab title
  if (settings.features.tabTitlePrefix) {
    startTabTitle(label);
  } else {
    stopTabTitle();
  }

  // 2. Favicon
  if (settings.features.faviconBadge) {
    applyFaviconWithRetries(instanceName, envType, settings.envColors);
  }

  // 3. Instance tag
  if (settings.features.instanceTag) {
    await mountInstanceTag({
      instanceName,
      baseUrl,
      envType,
      label,
      color,
      defaultCorner: settings.tagPosition,
    });
  } else {
    unmountInstanceTag();
  }
}

/**
 * Initialise on first content script load. Returns a function the caller
 * can invoke on SPA navigation to refresh everything.
 */
export async function initInstanceIdentity(
  initialContext: PageContext
): Promise<(updated: PageContext) => Promise<void>> {
  lastContext = initialContext;
  lastSettings = await getSettings();

  await applyAll(initialContext, lastSettings);

  // React to settings changes from the options page (live update)
  unsubSettings?.();
  unsubSettings = subscribeSettings((next) => {
    lastSettings = next;
    if (lastContext) void applyAll(lastContext, next);
  });

  return async (updated: PageContext) => {
    lastContext = updated;
    if (lastSettings) await applyAll(updated, lastSettings);
  };
}
