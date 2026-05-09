import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { TABLE_CONFIGS, sanitiseName, type TableConfig } from '../config/tableConfigs.js';

/**
 * Maps SN records to local filesystem paths and back.
 *
 * Layout (default `grouped`):
 *   {workspace}/{syncFolder}/{instance}/{scope}/{table-folder}/{name}.script.js
 *
 * Widgets get a per-record subfolder:
 *   {workspace}/{syncFolder}/{instance}/{scope}/Widgets/{name}/server.js
 *                                                            /client.js
 *                                                            /template.html
 *                                                            /style.scss
 *                                                            /link.js
 */

export interface RecordRef {
  table: string;
  sysId: string;
  name: string;
  scope: string;
}

export class FileMapper {
  constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

  private syncRoot(): string {
    const cfg = vscode.workspace.getConfiguration('nowforge');
    const folder = cfg.get<string>('syncFolder') ?? 'nowforge-sync';
    return path.join(this.workspaceFolder.uri.fsPath, folder);
  }

  /** Top-level folder for a particular instance. */
  instanceRoot(instanceName: string): string {
    return path.join(this.syncRoot(), instanceName);
  }

  /**
   * Compute the local path for a (record, file) pair.
   * `cfg` defines whether this is a multi-file record (widgets) or single-file.
   */
  pathForFile(
    instanceName: string,
    record: RecordRef,
    cfg: TableConfig,
    filename: string
  ): string {
    const safeName = sanitiseName(record.name);
    const root = path.join(
      this.instanceRoot(instanceName),
      sanitiseName(record.scope || 'global'),
      cfg.folder
    );
    if (cfg.multiFile) {
      return path.join(root, safeName, filename);
    }
    // Single-file: `{name}.script.js` (or `.{filename}` if not the primary one)
    if (filename === 'script.js') {
      return path.join(root, `${safeName}.script.js`);
    }
    return path.join(root, `${safeName}.${filename}`);
  }

  /** Ensure the parent directory of a path exists. */
  async ensureParent(absPath: string): Promise<void> {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
  }

  /** Write a file's contents, creating parent directories as needed. */
  async writeFile(absPath: string, contents: string): Promise<void> {
    await this.ensureParent(absPath);
    await fs.writeFile(absPath, contents, 'utf8');
  }

  /** Read a file. Returns null if it doesn't exist. */
  async readFile(absPath: string): Promise<string | null> {
    try { return await fs.readFile(absPath, 'utf8'); }
    catch { return null; }
  }

  /**
   * Walk the sync folder looking for all NowForge-tagged files. Used when
   * the explorer needs to show what's locally synced.
   */
  async listSyncedFiles(instanceName: string): Promise<string[]> {
    const root = this.instanceRoot(instanceName);
    const out: string[] = [];
    async function walk(dir: string): Promise<void> {
      let entries: import('node:fs').Dirent[];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) out.push(p);
      }
    }
    await walk(root);
    return out;
  }
}

/** Look up the table config for a given table name. */
export function tableConfigFor(table: string): TableConfig | null {
  return TABLE_CONFIGS[table] ?? null;
}

/** Inverse of `pathForFile` — given a local file path, return the table config + filename, if recognised. */
export function detectFileFromPath(filePath: string): { cfg: TableConfig; filename: string } | null {
  const lower = filePath.replace(/\\/g, '/').toLowerCase();
  for (const cfg of Object.values(TABLE_CONFIGS)) {
    const folderToken = `/${cfg.folder.toLowerCase()}/`;
    if (!lower.includes(folderToken)) continue;
    if (cfg.multiFile) {
      // Filename is the literal basename
      const basename = path.basename(filePath);
      const match = cfg.files.find((f) => f.filename === basename);
      if (match) return { cfg, filename: match.filename };
    } else {
      // Single-file: ends with `.script.js`
      if (lower.endsWith('.script.js')) return { cfg, filename: 'script.js' };
    }
  }
  return null;
}
