import type { Plugin } from './types.js';
import { validatePlugin } from './validator.js';

/**
 * Plugin store helpers — manage installed plugins in chrome.storage.local.
 * The chrome extension's startup code calls `loadInstalledPlugins()` and
 * merges each plugin's contents into its respective registries.
 */

const KEY = 'nowforge_plugins_installed';

export interface InstalledPlugin {
  plugin: Plugin;
  enabled: boolean;
  installedAt: number;
}

export async function loadInstalledPlugins(): Promise<InstalledPlugin[]> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) { resolve([]); return; }
    chrome.storage.local.get(KEY, (r) => resolve((r[KEY] as InstalledPlugin[] | undefined) ?? []));
  });
}

export async function saveInstalledPlugins(list: InstalledPlugin[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) { resolve(); return; }
    chrome.storage.local.set({ [KEY]: list }, () => resolve());
  });
}

export async function installPlugin(plugin: Plugin): Promise<{ ok: boolean; error?: string }> {
  const v = validatePlugin(plugin);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const list = await loadInstalledPlugins();
  // Replace if same id exists
  const filtered = list.filter((p) => p.plugin.id !== plugin.id);
  filtered.push({ plugin, enabled: true, installedAt: Date.now() });
  await saveInstalledPlugins(filtered);
  return { ok: true };
}

export async function uninstallPlugin(pluginId: string): Promise<void> {
  const list = await loadInstalledPlugins();
  await saveInstalledPlugins(list.filter((p) => p.plugin.id !== pluginId));
}

export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  const list = await loadInstalledPlugins();
  const next = list.map((p) => (p.plugin.id === pluginId ? { ...p, enabled } : p));
  await saveInstalledPlugins(next);
}

/**
 * Aggregate all enabled plugins' commands/rules/etc into flat arrays.
 * The extension's runtime registries import from here at boot.
 */
export async function aggregateEnabledContents(): Promise<{
  commands: NonNullable<Plugin['contents']['commands']>;
  qualityRules: NonNullable<Plugin['contents']['qualityRules']>;
  snippets: NonNullable<Plugin['contents']['snippets']>;
  aiPrompts: NonNullable<Plugin['contents']['aiPrompts']>;
  pipelineTemplates: NonNullable<Plugin['contents']['pipelineTemplates']>;
  tips: NonNullable<Plugin['contents']['tips']>;
}> {
  const list = await loadInstalledPlugins();
  const out = {
    commands: [] as NonNullable<Plugin['contents']['commands']>,
    qualityRules: [] as NonNullable<Plugin['contents']['qualityRules']>,
    snippets: [] as NonNullable<Plugin['contents']['snippets']>,
    aiPrompts: [] as NonNullable<Plugin['contents']['aiPrompts']>,
    pipelineTemplates: [] as NonNullable<Plugin['contents']['pipelineTemplates']>,
    tips: [] as NonNullable<Plugin['contents']['tips']>,
  };
  for (const entry of list) {
    if (!entry.enabled) continue;
    const c = entry.plugin.contents;
    if (c.commands)          out.commands.push(...c.commands);
    if (c.qualityRules)      out.qualityRules.push(...c.qualityRules);
    if (c.snippets)          out.snippets.push(...c.snippets);
    if (c.aiPrompts)         out.aiPrompts.push(...c.aiPrompts);
    if (c.pipelineTemplates) out.pipelineTemplates.push(...c.pipelineTemplates);
    if (c.tips)              out.tips.push(...c.tips);
  }
  return out;
}
