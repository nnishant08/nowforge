/**
 * Typed wrapper around chrome.storage.local and chrome.storage.sync.
 * Works in both extension and non-extension environments (no-ops when chrome is unavailable).
 */

type StorageArea = 'local' | 'sync';

function getArea(area: StorageArea): chrome.storage.StorageArea {
  return area === 'sync' ? chrome.storage.sync : chrome.storage.local;
}

/**
 * Get a typed value from Chrome storage.
 * Returns undefined if the key does not exist.
 */
export async function storageGet<T>(
  key: string,
  area: StorageArea = 'local'
): Promise<T | undefined> {
  return new Promise((resolve) => {
    getArea(area).get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

/**
 * Get multiple typed values from Chrome storage.
 */
export async function storageGetMultiple<T extends Record<string, unknown>>(
  keys: (keyof T)[],
  area: StorageArea = 'local'
): Promise<Partial<T>> {
  return new Promise((resolve) => {
    getArea(area).get(keys as string[], (result) => {
      resolve(result as Partial<T>);
    });
  });
}

/**
 * Set a typed value in Chrome storage.
 */
export async function storageSet<T>(
  key: string,
  value: T,
  area: StorageArea = 'local'
): Promise<void> {
  return new Promise((resolve, reject) => {
    getArea(area).set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Set multiple values in Chrome storage.
 */
export async function storageSetMultiple(
  items: Record<string, unknown>,
  area: StorageArea = 'local'
): Promise<void> {
  return new Promise((resolve, reject) => {
    getArea(area).set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Remove a key from Chrome storage.
 */
export async function storageRemove(
  key: string | string[],
  area: StorageArea = 'local'
): Promise<void> {
  return new Promise((resolve, reject) => {
    getArea(area).remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ── Typed key factory ────────────────────────────────────────────────────────

export interface TypedStorageKey<T> {
  readonly key: string;
  readonly area: StorageArea;
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
  remove(): Promise<void>;
  /** Subscribe to changes; returns an unsubscribe function. */
  watch(callback: (newValue: T | undefined, oldValue: T | undefined) => void): () => void;
}

/**
 * Define a typed storage key with get/set/watch helpers. Use this to centralise
 * the string key + type so no caller has to remember either:
 *
 *   const SETTINGS = defineStorageKey<Feature1Settings>('nowforge_settings', 'sync');
 *   await SETTINGS.set(next);
 */
export function defineStorageKey<T>(
  key: string,
  area: StorageArea = 'local'
): TypedStorageKey<T> {
  return {
    key,
    area,
    get: () => storageGet<T>(key, area),
    set: (value) => storageSet(key, value, area),
    remove: () => storageRemove(key, area),
    watch(callback) {
      const handler = (
        changes: { [k: string]: chrome.storage.StorageChange },
        changedArea: string
      ) => {
        if (changedArea === area && key in changes) {
          callback(
            changes[key].newValue as T | undefined,
            changes[key].oldValue as T | undefined
          );
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    },
  };
}

/**
 * Clear all keys from a storage area.
 */
export async function storageClear(area: StorageArea = 'local'): Promise<void> {
  return new Promise((resolve, reject) => {
    getArea(area).clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
