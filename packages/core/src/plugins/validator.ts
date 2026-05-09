import type { Plugin, PluginValidationResult } from './types.js';

/**
 * Validate a plugin object before installing. We don't pretend to be JSON
 * Schema — these are hand-written checks for the fields that matter.
 */
export function validatePlugin(input: unknown): PluginValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['Plugin must be a JSON object.'] };
  }
  const p = input as Record<string, unknown>;

  if (typeof p.id !== 'string' || !/^[a-z0-9.-]+\.[a-z0-9.-]+$/.test(p.id)) {
    errors.push('id is required and must look like "com.author.plugin-name".');
  }
  if (typeof p.name !== 'string' || !p.name.trim()) errors.push('name is required.');
  if (typeof p.version !== 'string' || !/^\d+\.\d+\.\d+/.test(p.version)) errors.push('version must be semver-ish.');
  if (typeof p.author !== 'object' || !p.author) errors.push('author object is required.');
  if (typeof p.category !== 'string') errors.push('category is required.');
  if (typeof p.contents !== 'object' || !p.contents) errors.push('contents object is required.');

  // Per-section sanity check
  const c = (p.contents ?? {}) as Plugin['contents'];
  if (c.qualityRules) {
    for (const r of c.qualityRules) {
      try { new RegExp(r.pattern); }
      catch { errors.push(`Quality rule "${r.ruleId}" has invalid regex pattern.`); }
    }
  }
  if (c.commands) {
    for (const cmd of c.commands) {
      if (cmd.action?.type === 'navigate' && !cmd.action.url) errors.push(`Command "${cmd.id}" missing url.`);
      if (cmd.action?.type === 'runScript' && !cmd.action.script) errors.push(`Command "${cmd.id}" missing script.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
