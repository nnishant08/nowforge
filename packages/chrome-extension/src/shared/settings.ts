import type { EnvironmentType } from '@nowforge/core';

/** A custom rule mapping an instance-name regex to an env type. */
export interface CustomRule {
  id: string;
  /** Regex source matched case-insensitively against the instance subdomain. */
  pattern: string;
  /** Env type to assign when this rule matches. */
  envType: EnvironmentType;
  /** Optional display label override (default: uppercased envType). */
  label?: string;
  /** Optional color override (default: envColors[envType]). */
  color?: string;
}

export type TagCorner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export type EnvColorMap = Record<EnvironmentType, string>;

export interface FeatureToggles {
  faviconBadge: boolean;
  instanceTag: boolean;
  tabTitlePrefix: boolean;
  /** Show technical field name on hover over field labels. Default off. */
  fieldTooltips: boolean;
}

export interface Feature1Settings {
  features: FeatureToggles;
  envColors: EnvColorMap;
  customRules: CustomRule[];
  tagPosition: TagCorner;
}

export const DEFAULT_SETTINGS: Feature1Settings = {
  features: {
    faviconBadge: true,
    instanceTag: true,
    tabTitlePrefix: true,
    fieldTooltips: false,
  },
  // Spec palette
  envColors: {
    dev: '#22C55E',
    test: '#EAB308',
    uat: '#A855F7',
    staging: '#F97316',
    prod: '#EF4444',
    unknown: '#6366F1',
  },
  customRules: [],
  tagPosition: 'top-right',
};

const STORAGE_KEY = 'nowforge_feature1_settings';

/** Read settings from chrome.storage.sync, layered on top of defaults. */
export async function getSettings(): Promise<Feature1Settings> {
  const stored = await new Promise<Partial<Feature1Settings>>((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as Partial<Feature1Settings>) ?? {});
    });
  });

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    features: { ...DEFAULT_SETTINGS.features, ...(stored.features ?? {}) },
    envColors: { ...DEFAULT_SETTINGS.envColors, ...(stored.envColors ?? {}) },
    customRules: stored.customRules ?? DEFAULT_SETTINGS.customRules,
    tagPosition: stored.tagPosition ?? DEFAULT_SETTINGS.tagPosition,
  };
}

export async function saveSettings(settings: Feature1Settings): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

/** Subscribe to settings changes. Returns an unsubscribe function. */
export function subscribeSettings(
  callback: (settings: Feature1Settings) => void
): () => void {
  const handler = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: string
  ) => {
    if (area === 'sync' && STORAGE_KEY in changes) {
      void getSettings().then(callback);
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/**
 * Apply custom rules first, fall back to detectEnvironmentType from core.
 * Returns the env type plus whether it came from a custom rule (for label/color override).
 */
export function classifyEnv(
  instanceName: string,
  rules: CustomRule[],
  fallback: EnvironmentType
): { envType: EnvironmentType; rule: CustomRule | null } {
  for (const rule of rules) {
    try {
      const re = new RegExp(rule.pattern, 'i');
      if (re.test(instanceName)) return { envType: rule.envType, rule };
    } catch {
      // Invalid regex — skip
    }
  }
  return { envType: fallback, rule: null };
}
