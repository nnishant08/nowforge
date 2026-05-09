import * as vscode from 'vscode';
import { CredentialStore } from './credentials.js';
import { VsCodeServiceNowClient } from './ServiceNowClient.js';

export interface InstanceConfig {
  name: string;
  url: string;
  username: string;
}

export interface ActiveConnection {
  config: InstanceConfig;
  client: VsCodeServiceNowClient;
}

/**
 * Owns the lifecycle of the user's active SN connection. Reads/writes
 * settings, manages credentials, and exposes change events the rest of
 * the extension subscribes to.
 */
export class ConnectionManager {
  private readonly _onDidChange = new vscode.EventEmitter<ActiveConnection | null>();
  readonly onDidChange = this._onDidChange.event;

  private current: ActiveConnection | null = null;

  constructor(private readonly credentials: CredentialStore) {}

  // ── Settings access ─────────────────────────────────────────────────────

  getInstances(): InstanceConfig[] {
    const cfg = vscode.workspace.getConfiguration('nowforge');
    return cfg.get<InstanceConfig[]>('instances') ?? [];
  }

  async setInstances(instances: InstanceConfig[]): Promise<void> {
    await vscode.workspace.getConfiguration('nowforge')
      .update('instances', instances, vscode.ConfigurationTarget.Global);
  }

  getActiveInstanceName(): string {
    return vscode.workspace.getConfiguration('nowforge').get<string>('activeInstance') ?? '';
  }

  async setActiveInstanceName(name: string): Promise<void> {
    await vscode.workspace.getConfiguration('nowforge')
      .update('activeInstance', name, vscode.ConfigurationTarget.Global);
  }

  // ── Public API ─────────────────────────────────────────────────────────

  getCurrent(): ActiveConnection | null {
    return this.current;
  }

  isConnected(): boolean {
    return this.current !== null;
  }

  /**
   * Connect to an instance. If none configured, prompts to add one. If
   * multiple configured, lets the user pick.
   */
  async connect(): Promise<ActiveConnection | null> {
    let instances = this.getInstances();

    if (instances.length === 0) {
      const added = await this.promptAddInstance();
      if (!added) return null;
      instances = this.getInstances();
    }

    let chosen: InstanceConfig | undefined;
    if (instances.length === 1) {
      chosen = instances[0];
    } else {
      const items = [
        ...instances.map((i) => ({ label: i.name, description: i.url, instance: i })),
        { label: '+ Add new instance…', description: '', instance: null as InstanceConfig | null },
      ];
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Choose an instance to connect to',
      });
      if (!pick) return null;
      if (!pick.instance) {
        const added = await this.promptAddInstance();
        if (!added) return null;
        chosen = added;
      } else {
        chosen = pick.instance;
      }
    }

    return this.connectTo(chosen);
  }

  /**
   * Connect to a specific instance by config. Resolves password from
   * SecretStorage; prompts the user if not stored. Tests the connection
   * before declaring success.
   */
  async connectTo(config: InstanceConfig): Promise<ActiveConnection | null> {
    let password = await this.credentials.getPassword(config.name);
    if (!password) {
      password = await vscode.window.showInputBox({
        prompt: `Password for ${config.username} on ${config.name}`,
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) return null;
      await this.credentials.setPassword(config.name, password);
    }

    const client = new VsCodeServiceNowClient(config.url, {
      type: 'basic',
      username: config.username,
      password,
    });

    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `NowForge: connecting to ${config.name}…` },
      () => client.pingInstance()
    );

    if (!result.ok) {
      const friendly = this.friendlyError(result.status, result.body);
      void vscode.window.showErrorMessage(`NowForge: connection failed — ${friendly}`);
      // Clear stored password if it was an auth failure
      if (result.status === 401) await this.credentials.deletePassword(config.name);
      return null;
    }

    this.current = { config, client };
    await this.setActiveInstanceName(config.name);
    this._onDidChange.fire(this.current);
    void vscode.window.showInformationMessage(`NowForge: connected to ${config.name}`);
    return this.current;
  }

  async disconnect(): Promise<void> {
    if (!this.current) return;
    this.current = null;
    await this.setActiveInstanceName('');
    this._onDidChange.fire(null);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async promptAddInstance(): Promise<InstanceConfig | null> {
    const url = await vscode.window.showInputBox({
      prompt: 'Instance URL (e.g. https://dev12345.service-now.com)',
      ignoreFocusOut: true,
      validateInput: (v) =>
        v && /^https:\/\//.test(v) ? null : 'URL must start with https://',
    });
    if (!url) return null;

    const defaultName = (() => {
      try { return new URL(url).host.split('.')[0]; } catch { return 'instance'; }
    })();
    const name = await vscode.window.showInputBox({
      prompt: 'Friendly name for this instance',
      value: defaultName,
      ignoreFocusOut: true,
    });
    if (!name) return null;

    const username = await vscode.window.showInputBox({
      prompt: `Username for ${name}`,
      ignoreFocusOut: true,
    });
    if (!username) return null;

    const password = await vscode.window.showInputBox({
      prompt: `Password for ${username} on ${name}`,
      password: true,
      ignoreFocusOut: true,
    });
    if (!password) return null;

    const cleaned: InstanceConfig = { name, url: url.replace(/\/$/, ''), username };
    const list = this.getInstances().filter((i) => i.name !== name);
    list.push(cleaned);
    await this.setInstances(list);
    await this.credentials.setPassword(name, password);
    return cleaned;
  }

  private friendlyError(status: number, body: string): string {
    if (status === 401) return 'wrong username or password (or MFA blocking basic auth)';
    if (status === 403) return 'authentication succeeded, but the user lacks API access';
    if (status === 0) return `could not reach the instance (${body})`;
    return `HTTP ${status}: ${body.slice(0, 200)}`;
  }

  /** Restore connection on activation if a connection was active last time. */
  async restoreFromSettings(): Promise<void> {
    const activeName = this.getActiveInstanceName();
    if (!activeName) return;
    const config = this.getInstances().find((i) => i.name === activeName);
    if (!config) return;
    // Silent restore — don't pop a "wrong password" dialog at activation if
    // the password was rotated. Just leave the connection unset.
    const password = await this.credentials.getPassword(activeName);
    if (!password) return;

    const client = new VsCodeServiceNowClient(config.url, {
      type: 'basic',
      username: config.username,
      password,
    });
    const ping = await client.pingInstance();
    if (!ping.ok) return;
    this.current = { config, client };
    this._onDidChange.fire(this.current);
  }
}
