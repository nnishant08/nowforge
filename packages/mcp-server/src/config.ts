import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Persists per-instance credentials in ~/.nowforge/config.json.
 *
 * Encryption: we don't roll our own. If the user wants stronger protection,
 * they should configure their AI client to pass credentials via env vars
 * (which never touch disk). The config-file path is for the simple case.
 *
 * On first run we also support env vars NOWFORGE_INSTANCE / NOWFORGE_USER /
 * NOWFORGE_PASSWORD which take precedence over the config file. This is what
 * Claude Desktop's `env` block in `claude_desktop_config.json` populates.
 */

export interface InstanceCreds {
  url: string;
  username: string;
  password: string;
  /** Optional tag — affects safety prompts. */
  environment?: 'dev' | 'test' | 'staging' | 'prod' | 'pdi';
}

export interface Config {
  instances: Record<string, InstanceCreds>;
  activeInstance: string;
  /** When true, mutating tools return what they would do without executing. */
  dryRun?: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.nowforge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

let cached: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (cached) return cached;

  // 1. Env vars (Claude Desktop / Cursor pass via `env`)
  const envUrl = process.env.NOWFORGE_INSTANCE;
  const envUser = process.env.NOWFORGE_USER;
  const envPass = process.env.NOWFORGE_PASSWORD;
  if (envUrl && envUser && envPass) {
    cached = {
      instances: {
        env: {
          url: envUrl.replace(/\/$/, ''),
          username: envUser,
          password: envPass,
          environment: (process.env.NOWFORGE_ENV as InstanceCreds['environment']) ?? undefined,
        },
      },
      activeInstance: 'env',
      dryRun: process.env.NOWFORGE_DRY_RUN === 'true',
    };
    return cached;
  }

  // 2. Config file
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    cached = JSON.parse(raw) as Config;
    return cached;
  } catch {
    cached = { instances: {}, activeInstance: '' };
    return cached;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  cached = config;
}

export function getActiveInstance(config: Config): InstanceCreds | null {
  if (!config.activeInstance) return null;
  return config.instances[config.activeInstance] ?? null;
}

export async function setActiveInstance(name: string): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.instances[name]) throw new Error(`No instance named "${name}" is configured.`);
  cfg.activeInstance = name;
  await saveConfig(cfg);
}
