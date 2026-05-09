import * as vscode from 'vscode';
import type { ConnectionManager } from '../connection/ConnectionManager.js';

export type SyncState = 'idle' | 'syncing' | 'error';

/**
 * The status-bar item at the bottom of VS Code. Click → quick-pick menu of
 * common actions (switch instance, pull all, disconnect).
 */
export class SyncStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private syncState: SyncState = 'idle';
  private syncMessage = '';

  constructor(private readonly connection: ConnectionManager) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'nowforge.statusBarMenu';
    this.connection.onDidChange(() => this.render());
    this.render();
    this.item.show();
  }

  setSyncing(message: string): void {
    this.syncState = 'syncing';
    this.syncMessage = message;
    this.render();
  }

  setIdle(): void {
    this.syncState = 'idle';
    this.syncMessage = '';
    this.render();
  }

  setError(message: string): void {
    this.syncState = 'error';
    this.syncMessage = message;
    this.render();
  }

  private render(): void {
    const conn = this.connection.getCurrent();
    if (!conn) {
      this.item.text = '$(plug) NowForge: disconnected';
      this.item.tooltip = 'Click to connect to a ServiceNow instance';
      this.item.backgroundColor = undefined;
      return;
    }
    if (this.syncState === 'syncing') {
      this.item.text = `$(sync~spin) ${this.syncMessage || 'Syncing…'}`;
      this.item.backgroundColor = undefined;
      return;
    }
    if (this.syncState === 'error') {
      this.item.text = `$(error) ${this.syncMessage || 'NowForge: error'}`;
      this.item.tooltip = this.syncMessage;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      return;
    }
    this.item.text = `$(cloud) NowForge: ${conn.config.name}`;
    this.item.tooltip = conn.config.url;
    this.item.backgroundColor = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}
