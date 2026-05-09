import * as vscode from 'vscode';
import { TABLE_CONFIGS, fieldsForTable, type TableConfig } from '../config/tableConfigs.js';
import type { ActiveConnection } from '../connection/ConnectionManager.js';
import { FileMapper, detectFileFromPath } from './FileMapper.js';
import {
  buildHeaderComment,
  readHeader,
  stripHeader,
  wrapWithHeader,
  type NowForgeMetadata,
} from './metadata.js';

/**
 * The sync orchestrator.
 *
 * Responsibilities:
 *   - pullAll → fetch every record in the configured tables, write files
 *   - pushFile → push a single file's contents back to its source record
 *   - pull single → re-fetch the record for a given file
 *   - conflict detection → compare local meta.updated_on vs current sys_updated_on
 *
 * All "read+modify+write" cycles are serialised via the active connection's
 * client; concurrent saves should still be safe because the conflict check
 * is applied per-file.
 */

export interface SyncSummary {
  table: string;
  pulled: number;
  skipped: number;
  errors: number;
}

export class SyncEngine {
  constructor(
    private readonly connection: () => ActiveConnection | null,
    private readonly mapper: FileMapper
  ) {}

  // ── Pull ────────────────────────────────────────────────────────────────

  async pullAll(progress?: vscode.Progress<{ message: string; increment: number }>): Promise<SyncSummary[]> {
    const conn = this.connection();
    if (!conn) throw new Error('Not connected.');

    const cfg = vscode.workspace.getConfiguration('nowforge');
    const tables = cfg.get<string[]>('syncTables') ?? [];
    const scopeFilter = cfg.get<string>('scopeFilter') ?? '';

    const summaries: SyncSummary[] = [];
    const step = 100 / Math.max(1, tables.length);

    for (const table of tables) {
      const tableCfg = TABLE_CONFIGS[table];
      if (!tableCfg) {
        summaries.push({ table, pulled: 0, skipped: 0, errors: 1 });
        continue;
      }
      progress?.report({ message: `Pulling ${tableCfg.label}…`, increment: 0 });
      const sum = await this.pullTable(conn, tableCfg, scopeFilter);
      summaries.push(sum);
      progress?.report({ message: `Pulled ${sum.pulled} ${tableCfg.label}`, increment: step });
    }
    return summaries;
  }

  private async pullTable(
    conn: ActiveConnection,
    cfg: TableConfig,
    scopeFilter: string
  ): Promise<SyncSummary> {
    const fields = fieldsForTable(cfg);
    let query = '';
    if (scopeFilter) query = `sys_scope.scope=${scopeFilter}`;

    let records: Array<Record<string, unknown>>;
    try {
      records = await conn.client.getRecords(cfg.table, {
        query,
        fields,
        limit: 1000,
        displayValue: 'all',
      }) as unknown as Array<Record<string, unknown>>;
    } catch (err) {
      console.error(`[NowForge] failed to pull ${cfg.table}:`, err);
      return { table: cfg.table, pulled: 0, skipped: 0, errors: 1 };
    }

    let pulled = 0;
    let skipped = 0;
    let errors = 0;

    for (const r of records) {
      try {
        const wrote = await this.writeRecordFiles(conn, cfg, r);
        if (wrote === 'pulled') pulled++;
        else if (wrote === 'skipped') skipped++;
      } catch (err) {
        console.error(`[NowForge] error writing record:`, err);
        errors++;
      }
    }
    return { table: cfg.table, pulled, skipped, errors };
  }

  /**
   * Write all files for a single record (1 file for most, several for widgets).
   * Returns:
   *   - 'pulled'  if at least one file was written
   *   - 'skipped' if every file was unchanged or had unsaved local edits
   */
  private async writeRecordFiles(
    conn: ActiveConnection,
    cfg: TableConfig,
    row: Record<string, unknown>
  ): Promise<'pulled' | 'skipped'> {
    const dvField = (row as Record<string, { value?: string; display_value?: string }>);
    const sysId    = dvField.sys_id?.value ?? '';
    const name     = dvField.name?.value ?? dvField.sys_name?.value ?? sysId;
    const updated  = dvField.sys_updated_on?.value ?? '';
    const scopeVal = (row['sys_scope.scope'] as { value?: string } | undefined)?.value
                  ?? (row['sys_scope.name']  as { value?: string } | undefined)?.value
                  ?? 'global';

    if (!sysId) return 'skipped';

    let anyWritten = false;
    for (const fileSpec of cfg.files) {
      const fieldEnvelope = dvField[fileSpec.field];
      const value = (fieldEnvelope as { value?: string } | undefined)?.value ?? '';
      if (!value && !fileSpec.isPrimary) continue; // skip empty optional files (e.g. widget link.js)

      const meta: NowForgeMetadata = {
        table: cfg.table,
        sys_id: sysId,
        field: fileSpec.field,
        updated_on: updated,
        scope: scopeVal,
        name,
        filename: fileSpec.filename,
        instance: conn.config.name,
      };
      const localPath = this.mapper.pathForFile(conn.config.name, {
        table: cfg.table, sysId, name, scope: scopeVal,
      }, cfg, fileSpec.filename);

      // Conflict guard: if the local file has unsaved changes (different from
      // what we last wrote), prompt before overwriting.
      const existing = await this.mapper.readFile(localPath);
      if (existing) {
        const parsed = readHeader(existing);
        if (parsed && parsed.body.replace(/^\n/, '') !== value) {
          const choice = await vscode.window.showWarningMessage(
            `Local changes exist for ${name}. Overwrite with instance version?`,
            { modal: true },
            'Overwrite', 'Skip'
          );
          if (choice !== 'Overwrite') continue;
        }
      }

      const fileContents = wrapWithHeader(value, meta);
      await this.mapper.writeFile(localPath, fileContents);
      anyWritten = true;
    }
    return anyWritten ? 'pulled' : 'skipped';
  }

  // ── Pull single (refresh one file from instance) ────────────────────────

  async pullFile(filePath: string): Promise<{ ok: boolean; message: string }> {
    const conn = this.connection();
    if (!conn) return { ok: false, message: 'Not connected.' };

    const existing = await this.mapper.readFile(filePath);
    if (!existing) return { ok: false, message: 'File does not exist.' };
    const parsed = readHeader(existing);
    if (!parsed) return { ok: false, message: 'File has no NowForge metadata header.' };

    const cfg = TABLE_CONFIGS[parsed.meta.table];
    if (!cfg) return { ok: false, message: `Unknown table ${parsed.meta.table}.` };

    let row: Record<string, unknown>;
    try {
      row = await conn.client.getRecord(cfg.table, parsed.meta.sys_id, {
        fields: fieldsForTable(cfg),
        displayValue: 'all',
      }) as unknown as Record<string, unknown>;
    } catch (err) {
      return { ok: false, message: `Fetch failed: ${(err as Error).message}` };
    }

    const value = ((row as Record<string, { value?: string }>)[parsed.meta.field])?.value ?? '';
    const updated = ((row as Record<string, { value?: string }>)['sys_updated_on'])?.value ?? '';
    const meta: NowForgeMetadata = { ...parsed.meta, updated_on: updated };
    await this.mapper.writeFile(filePath, wrapWithHeader(value, meta));
    return { ok: true, message: `Pulled ${parsed.meta.name}` };
  }

  // ── Push ────────────────────────────────────────────────────────────────

  async pushFile(filePath: string): Promise<{ ok: boolean; message: string; conflict?: boolean }> {
    const conn = this.connection();
    if (!conn) return { ok: false, message: 'Not connected.' };

    const detect = detectFileFromPath(filePath);
    if (!detect) return { ok: false, message: 'File is not in a recognised NowForge folder.' };

    const contents = await this.mapper.readFile(filePath);
    if (contents == null) return { ok: false, message: 'Could not read file.' };
    const parsed = readHeader(contents);
    if (!parsed) return { ok: false, message: 'No NowForge header — pull this file first.' };

    const meta = parsed.meta;
    const body = stripHeader(contents);

    // Conflict check: re-fetch sys_updated_on, compare against header
    let serverRow: Record<string, unknown>;
    try {
      serverRow = await conn.client.getRecord(meta.table, meta.sys_id, {
        fields: ['sys_id', 'sys_updated_on', meta.field],
      }) as unknown as Record<string, unknown>;
    } catch (err) {
      return { ok: false, message: `Could not fetch current version: ${(err as Error).message}` };
    }
    const serverUpdated = String((serverRow as Record<string, string>)['sys_updated_on'] ?? '');

    if (serverUpdated && meta.updated_on && serverUpdated > meta.updated_on) {
      // Instance has been changed since our last pull
      const choice = await vscode.window.showWarningMessage(
        `Instance version of "${meta.name}" is newer than your local copy.`,
        { modal: true },
        'Push anyway', 'Pull latest', 'Cancel'
      );
      if (choice === 'Cancel' || choice === undefined) {
        return { ok: false, message: 'Cancelled by user.', conflict: true };
      }
      if (choice === 'Pull latest') {
        const r = await this.pullFile(filePath);
        return { ok: r.ok, message: r.message, conflict: true };
      }
      // 'Push anyway' falls through
    }

    // Push it
    try {
      await conn.client.updateRecord(meta.table, meta.sys_id, { [meta.field]: body });
    } catch (err) {
      return { ok: false, message: `Push failed: ${(err as Error).message}` };
    }

    // Re-read the new sys_updated_on so subsequent saves stay in sync
    try {
      const refreshed = await conn.client.getRecord(meta.table, meta.sys_id, {
        fields: ['sys_updated_on'],
      }) as unknown as Record<string, string>;
      const newUpdated = String(refreshed['sys_updated_on'] ?? meta.updated_on);
      const newMeta: NowForgeMetadata = { ...meta, updated_on: newUpdated };
      await this.mapper.writeFile(filePath, wrapWithHeader(body, newMeta));
    } catch { /* best-effort */ }

    return { ok: true, message: `Pushed ${meta.name} → ${conn.config.name}` };
  }

  /** Public: build the metadata header line as a string (helps tests). */
  buildHeader(meta: NowForgeMetadata): string {
    return buildHeaderComment(meta);
  }
}
