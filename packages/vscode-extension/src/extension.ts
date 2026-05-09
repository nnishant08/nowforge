import * as vscode from 'vscode';
import { CredentialStore } from './connection/credentials.js';
import { ConnectionManager } from './connection/ConnectionManager.js';
import { FileMapper, detectFileFromPath } from './sync/FileMapper.js';
import { SyncEngine } from './sync/SyncEngine.js';
import { readHeader } from './sync/metadata.js';
import { InstanceExplorerProvider } from './explorer/InstanceExplorer.js';
import { SyncStatusBar } from './status/SyncStatusBar.js';
import { AIConfigStore, AIRunner } from './ai/AIProvider.js';

let connectionManager: ConnectionManager | null = null;
let syncEngine: SyncEngine | null = null;
let fileMapper: FileMapper | null = null;
let statusBar: SyncStatusBar | null = null;
let explorerProvider: InstanceExplorerProvider | null = null;
let aiRunner: AIRunner | null = null;

const autoPushTimers = new Map<string, NodeJS.Timeout>();

export function activate(ctx: vscode.ExtensionContext): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showErrorMessage('NowForge needs a workspace folder open. Open one and reload.');
    return;
  }

  fileMapper = new FileMapper(folder);
  const credentials = new CredentialStore(ctx.secrets);
  connectionManager = new ConnectionManager(credentials);
  syncEngine = new SyncEngine(() => connectionManager?.getCurrent() ?? null, fileMapper);
  statusBar = new SyncStatusBar(connectionManager);
  explorerProvider = new InstanceExplorerProvider(connectionManager, () => fileMapper);
  aiRunner = new AIRunner(new AIConfigStore(ctx.secrets));

  ctx.subscriptions.push(
    statusBar,
    vscode.window.registerTreeDataProvider('nowforge-explorer', explorerProvider),
  );

  registerCommands(ctx);
  registerAutoPush(ctx);

  // Restore previously active connection silently in the background
  void connectionManager.restoreFromSettings();
}

export function deactivate(): void {
  for (const t of autoPushTimers.values()) clearTimeout(t);
  autoPushTimers.clear();
  statusBar?.dispose();
}

// ── Commands ────────────────────────────────────────────────────────────────

function registerCommands(ctx: vscode.ExtensionContext): void {
  const disposables = [
    vscode.commands.registerCommand('nowforge.connect', async () => {
      await connectionManager?.connect();
      explorerProvider?.refresh();
    }),

    vscode.commands.registerCommand('nowforge.disconnect', async () => {
      await connectionManager?.disconnect();
      explorerProvider?.refresh();
      void vscode.window.showInformationMessage('NowForge: disconnected');
    }),

    vscode.commands.registerCommand('nowforge.pullAll', async () => {
      if (!connectionManager?.isConnected()) {
        await vscode.commands.executeCommand('nowforge.connect');
      }
      if (!connectionManager?.isConnected() || !syncEngine) return;
      statusBar?.setSyncing('Pulling all scripts');
      try {
        const summaries = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'NowForge: pulling all scripts…' },
          (progress) => syncEngine!.pullAll(progress)
        );
        const totalPulled = summaries.reduce((a, s) => a + s.pulled, 0);
        const totalErrors = summaries.reduce((a, s) => a + s.errors, 0);
        explorerProvider?.refresh();
        void vscode.window.showInformationMessage(
          `NowForge: pulled ${totalPulled} record(s)${totalErrors ? ` · ${totalErrors} error(s)` : ''}`
        );
        statusBar?.setIdle();
      } catch (err) {
        statusBar?.setError(`Pull failed: ${(err as Error).message}`);
        void vscode.window.showErrorMessage(`NowForge: pull failed — ${(err as Error).message}`);
      }
    }),

    vscode.commands.registerCommand('nowforge.push', async (uriArg?: vscode.Uri) => {
      const uri = uriArg ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri) { void vscode.window.showWarningMessage('No file to push.'); return; }
      await pushUri(uri);
    }),

    vscode.commands.registerCommand('nowforge.pull', async (uriArg?: vscode.Uri) => {
      const uri = uriArg ?? vscode.window.activeTextEditor?.document.uri;
      if (!uri || !syncEngine) return;
      const r = await syncEngine.pullFile(uri.fsPath);
      if (r.ok) void vscode.window.showInformationMessage(`NowForge: ${r.message}`);
      else    void vscode.window.showWarningMessage(`NowForge: ${r.message}`);
    }),

    vscode.commands.registerCommand('nowforge.openInBrowser', async (arg?: vscode.Uri | { meta?: { table?: string; sysId?: string } }) => {
      const conn = connectionManager?.getCurrent();
      if (!conn) { void vscode.window.showWarningMessage('Not connected.'); return; }

      let table: string | undefined;
      let sysId: string | undefined;

      if (arg && typeof arg === 'object' && 'meta' in arg && arg.meta) {
        table = arg.meta.table;
        sysId = arg.meta.sysId;
      } else {
        const uri = arg instanceof vscode.Uri ? arg : vscode.window.activeTextEditor?.document.uri;
        if (uri) {
          const text = (await vscode.workspace.fs.readFile(uri)).toString();
          const parsed = readHeader(text);
          if (parsed) { table = parsed.meta.table; sysId = parsed.meta.sys_id; }
        }
      }

      if (!table || !sysId) {
        void vscode.window.showWarningMessage('No NowForge metadata in this file — cannot open.');
        return;
      }
      void vscode.env.openExternal(vscode.Uri.parse(`${conn.config.url}/${table}.do?sys_id=${sysId}`));
    }),

    vscode.commands.registerCommand('nowforge.runScript', async () => {
      const conn = connectionManager?.getCurrent();
      if (!conn) { void vscode.window.showWarningMessage('Not connected.'); return; }
      const editor = vscode.window.activeTextEditor;
      if (!editor) { void vscode.window.showWarningMessage('No active editor.'); return; }
      const raw = editor.document.getText();
      const parsed = readHeader(raw);
      const script = parsed ? parsed.body.replace(/^\n/, '') : raw;

      statusBar?.setSyncing('Running script…');
      try {
        const res = await conn.client.runBackgroundScript(script);
        if (!res.ok) {
          void vscode.window.showErrorMessage(`NowForge: ${res.error ?? 'run failed'}`);
        } else {
          const channel = vscode.window.createOutputChannel('NowForge: Background Script');
          channel.clear();
          channel.appendLine(res.output || '(no output)');
          channel.show(true);
        }
      } finally {
        statusBar?.setIdle();
      }
    }),

    vscode.commands.registerCommand('nowforge.diff', async (arg?: vscode.Uri | { meta?: { filePath?: string } }) => {
      const conn = connectionManager?.getCurrent();
      if (!conn || !syncEngine || !fileMapper) return;
      let uri: vscode.Uri | undefined;
      if (arg && typeof arg === 'object' && 'meta' in arg && arg.meta?.filePath) {
        uri = vscode.Uri.file(arg.meta.filePath);
      } else if (arg instanceof vscode.Uri) {
        uri = arg;
      } else {
        uri = vscode.window.activeTextEditor?.document.uri;
      }
      if (!uri) return;

      const localText = (await vscode.workspace.fs.readFile(uri)).toString();
      const parsed = readHeader(localText);
      if (!parsed) {
        void vscode.window.showWarningMessage('No NowForge metadata — cannot diff.');
        return;
      }
      try {
        const row = await conn.client.getRecord(parsed.meta.table, parsed.meta.sys_id, {
          fields: [parsed.meta.field],
        }) as unknown as Record<string, string>;
        const remoteValue = String(row[parsed.meta.field] ?? '');
        const tmp = vscode.Uri.parse(`untitled:${parsed.meta.name} (instance)`);
        const doc = await vscode.workspace.openTextDocument(tmp);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });
        await editor.edit((eb) => eb.insert(new vscode.Position(0, 0), remoteValue));
        await vscode.commands.executeCommand('vscode.diff', tmp, uri, `${parsed.meta.name}: instance ↔ local`);
      } catch (err) {
        void vscode.window.showErrorMessage(`Diff failed: ${(err as Error).message}`);
      }
    }),

    vscode.commands.registerCommand('nowforge.switchInstance', async () => {
      await connectionManager?.disconnect();
      await vscode.commands.executeCommand('nowforge.connect');
    }),

    vscode.commands.registerCommand('nowforge.switchUpdateSet', () => {
      void vscode.window.showInformationMessage(
        'NowForge: update-set switching is coming in a follow-up. For now, switch in the SN UI.'
      );
    }),

    vscode.commands.registerCommand('nowforge.refreshExplorer', () => {
      explorerProvider?.refresh();
    }),

    vscode.commands.registerCommand('nowforge.ai.configure',  () => aiRunner?.configure()),
    vscode.commands.registerCommand('nowforge.ai.explain',    () => aiRunner?.run('explain')),
    vscode.commands.registerCommand('nowforge.ai.refactor',   () => aiRunner?.run('refactor')),
    vscode.commands.registerCommand('nowforge.ai.generate',   () => aiRunner?.run('generate')),
    vscode.commands.registerCommand('nowforge.ai.convertToGlideQuery', () => aiRunner?.run('convertToGlideQuery')),
    vscode.commands.registerCommand('nowforge.ai.atfTest',    () => aiRunner?.run('generateAtfTest')),
    vscode.commands.registerCommand('nowforge.ai.document',   () => aiRunner?.run('document')),
    vscode.commands.registerCommand('nowforge.ai.explainError', () => aiRunner?.run('explainError')),

    // Hidden command bound to the status bar click — shows a quick menu
    vscode.commands.registerCommand('nowforge.statusBarMenu', async () => {
      const isConnected = connectionManager?.isConnected();
      const items: Array<vscode.QuickPickItem & { id: string }> = isConnected
        ? [
            { id: 'pullAll',     label: '$(sync) Pull all scripts' },
            { id: 'switch',      label: '$(arrow-swap) Switch instance' },
            { id: 'disconnect',  label: '$(plug) Disconnect' },
          ]
        : [{ id: 'connect', label: '$(plug) Connect to instance' }];
      const pick = await vscode.window.showQuickPick(items, { placeHolder: 'NowForge' });
      if (!pick) return;
      switch (pick.id) {
        case 'pullAll':    await vscode.commands.executeCommand('nowforge.pullAll'); break;
        case 'switch':     await vscode.commands.executeCommand('nowforge.switchInstance'); break;
        case 'disconnect': await vscode.commands.executeCommand('nowforge.disconnect'); break;
        case 'connect':    await vscode.commands.executeCommand('nowforge.connect'); break;
      }
    }),
  ];

  ctx.subscriptions.push(...disposables);
}

// ── Auto-push on save ───────────────────────────────────────────────────────

function registerAutoPush(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const cfg = vscode.workspace.getConfiguration('nowforge');
      if (!cfg.get<boolean>('autoPush')) return;
      if (!doc.uri.fsPath.includes(cfg.get<string>('syncFolder') ?? 'nowforge-sync')) return;
      const detect = detectFileFromPath(doc.uri.fsPath);
      if (!detect) return;

      const delay = cfg.get<number>('autoPushDelay') ?? 2000;
      const key = doc.uri.fsPath;
      const prev = autoPushTimers.get(key);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        autoPushTimers.delete(key);
        void pushUri(doc.uri);
      }, delay);
      autoPushTimers.set(key, timer);
    })
  );
}

async function pushUri(uri: vscode.Uri): Promise<void> {
  if (!syncEngine || !connectionManager?.isConnected()) {
    void vscode.window.showWarningMessage('NowForge: not connected — cannot push.');
    return;
  }
  statusBar?.setSyncing('Pushing…');
  const result = await syncEngine.pushFile(uri.fsPath);
  if (result.ok) {
    statusBar?.setIdle();
    vscode.window.setStatusBarMessage(`✓ ${result.message}`, 4000);
  } else {
    statusBar?.setError(result.message);
    if (!result.conflict) void vscode.window.showErrorMessage(`NowForge: ${result.message}`);
  }
}
