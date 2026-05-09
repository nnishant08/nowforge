import * as vscode from 'vscode';
import { TABLE_CONFIGS } from '../config/tableConfigs.js';
import type { ConnectionManager } from '../connection/ConnectionManager.js';
import type { FileMapper } from '../sync/FileMapper.js';
import { readHeader, type NowForgeMetadata } from '../sync/metadata.js';

/**
 * Tree view in the activity bar. Top-level node = active instance; children
 * are table groups; grandchildren are individual records.
 *
 * Reads from the local sync folder (so it stays available even when offline).
 * On connection change, refreshes from the SN side using `sys_metadata` / per-table queries.
 */

export class NowForgeTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly kind: 'instance' | 'table' | 'record',
    public readonly meta?: { table?: string; sysId?: string; filePath?: string }
  ) {
    super(label, collapsibleState);
  }
}

export class InstanceExplorerProvider implements vscode.TreeDataProvider<NowForgeTreeItem> {
  private readonly _onDidChange = new vscode.EventEmitter<NowForgeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  /** Cached children per parent, keyed by the parent's id. */
  private children: Map<string, NowForgeTreeItem[]> = new Map();

  constructor(
    private readonly connection: ConnectionManager,
    private readonly mapper: () => FileMapper | null
  ) {
    connection.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.children.clear();
    this._onDidChange.fire();
  }

  getTreeItem(el: NowForgeTreeItem): vscode.TreeItem {
    return el;
  }

  async getChildren(parent?: NowForgeTreeItem): Promise<NowForgeTreeItem[]> {
    if (!parent) return this.rootNodes();
    if (parent.kind === 'instance') return this.tableNodes();
    if (parent.kind === 'table') return this.recordNodes(parent.meta?.table ?? '');
    return [];
  }

  private rootNodes(): NowForgeTreeItem[] {
    const conn = this.connection.getCurrent();
    if (!conn) {
      const item = new NowForgeTreeItem(
        'Not connected — run "NowForge: Connect"',
        vscode.TreeItemCollapsibleState.None,
        'instance'
      );
      item.iconPath = new vscode.ThemeIcon('plug');
      return [item];
    }
    const item = new NowForgeTreeItem(
      `${conn.config.name} (connected)`,
      vscode.TreeItemCollapsibleState.Expanded,
      'instance'
    );
    item.iconPath = new vscode.ThemeIcon('cloud');
    item.tooltip = conn.config.url;
    return [item];
  }

  private tableNodes(): NowForgeTreeItem[] {
    const cfg = vscode.workspace.getConfiguration('nowforge');
    const tables = cfg.get<string[]>('syncTables') ?? [];
    return tables
      .map((t) => TABLE_CONFIGS[t])
      .filter(Boolean)
      .map((tc) => {
        const item = new NowForgeTreeItem(
          tc.label,
          vscode.TreeItemCollapsibleState.Collapsed,
          'table',
          { table: tc.table }
        );
        item.iconPath = new vscode.ThemeIcon('symbol-class');
        return item;
      });
  }

  /**
   * Records for a table are read from the local synced files. Walking the
   * sync folder + parsing NowForge headers gives us all the records that
   * have been pulled at least once. Run "Pull All" to populate.
   */
  private async recordNodes(table: string): Promise<NowForgeTreeItem[]> {
    const conn = this.connection.getCurrent();
    const mapper = this.mapper();
    if (!conn || !mapper) return [];

    const files = await mapper.listSyncedFiles(conn.config.name);
    const items: NowForgeTreeItem[] = [];
    const seenSysIds = new Set<string>();

    for (const filePath of files) {
      // Only show entries in the table's folder (one folder per table)
      const cfg = TABLE_CONFIGS[table];
      if (!cfg) continue;
      if (!filePath.includes(`/${cfg.folder}/`) && !filePath.includes(`\\${cfg.folder}\\`)) continue;

      const contents = await mapper.readFile(filePath);
      if (!contents) continue;
      const parsed = readHeader(contents);
      if (!parsed || parsed.meta.table !== table) continue;
      if (seenSysIds.has(parsed.meta.sys_id)) continue;
      seenSysIds.add(parsed.meta.sys_id);

      items.push(this.buildRecordItem(parsed.meta, filePath));
    }
    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return items;
  }

  private buildRecordItem(meta: NowForgeMetadata, filePath: string): NowForgeTreeItem {
    const item = new NowForgeTreeItem(
      meta.name,
      vscode.TreeItemCollapsibleState.None,
      'record',
      { table: meta.table, sysId: meta.sys_id, filePath }
    );
    item.contextValue = 'record';
    item.iconPath = new vscode.ThemeIcon('symbol-method');
    item.tooltip = `${meta.scope ?? 'global'} · ${meta.table}\n${meta.sys_id}`;
    item.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: [vscode.Uri.file(filePath)],
    };
    return item;
  }
}
