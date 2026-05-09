import * as vscode from 'vscode';
import { callAI, buildPrompt, DEFAULT_MODELS, type AIAction, type AIProvider } from '@nowforge/core';
import { readHeader } from '../sync/metadata.js';

const SECRET_KEY = 'nowforge.ai.apiKey';

export interface AIConfig { provider: AIProvider; apiKey: string; model: string; }

/**
 * Reads + writes the AI configuration. API key in SecretStorage; provider
 * and model live in workspace/user settings (not sensitive).
 */
export class AIConfigStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(): Promise<AIConfig | null> {
    const cfg = vscode.workspace.getConfiguration('nowforge.ai');
    const provider = (cfg.get<AIProvider>('provider')) ?? 'anthropic';
    const apiKey = await this.secrets.get(SECRET_KEY);
    const model = cfg.get<string>('model') ?? DEFAULT_MODELS[provider];
    if (!apiKey) return null;
    return { provider, apiKey, model };
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.store(SECRET_KEY, key);
  }

  async setProvider(p: AIProvider): Promise<void> {
    await vscode.workspace.getConfiguration('nowforge.ai')
      .update('provider', p, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration('nowforge.ai')
      .update('model', DEFAULT_MODELS[p], vscode.ConfigurationTarget.Global);
  }

  async clear(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
  }
}

/**
 * Run an AI action against the user's active editor and stream output to
 * a dedicated VS Code output channel. Output channels are append-only and
 * the user can copy from them; a future iteration could promote results
 * to a webview with proper markdown rendering.
 */
export class AIRunner {
  private readonly channel: vscode.OutputChannel;

  constructor(private readonly store: AIConfigStore) {
    this.channel = vscode.window.createOutputChannel('NowForge AI');
  }

  /** True if the user has configured an API key. */
  async isReady(): Promise<boolean> {
    return (await this.store.get()) !== null;
  }

  /** Prompt for an API key + provider; returns true if config is now ready. */
  async configure(): Promise<boolean> {
    const provider = await vscode.window.showQuickPick(
      [
        { label: 'Anthropic (Claude)', value: 'anthropic' as const },
        { label: 'OpenAI (GPT)',       value: 'openai'    as const },
      ],
      { placeHolder: 'Choose a provider' }
    );
    if (!provider) return false;
    await this.store.setProvider(provider.value);

    const key = await vscode.window.showInputBox({
      prompt: provider.value === 'anthropic'
        ? 'Anthropic API key (sk-ant-…)'
        : 'OpenAI API key (sk-…)',
      password: true,
      ignoreFocusOut: true,
    });
    if (!key) return false;
    await this.store.setApiKey(key.trim());
    void vscode.window.showInformationMessage('NowForge AI: API key saved.');
    return true;
  }

  /**
   * Run an action. Resolves the script from the active editor (or accepts
   * an explicit one). Pops output in the NowForge AI channel.
   */
  async run(action: AIAction, explicit?: { description?: string; errorMessage?: string }): Promise<void> {
    let cfg = await this.store.get();
    if (!cfg) {
      const ok = await this.configure();
      if (!ok) return;
      cfg = await this.store.get();
      if (!cfg) return;
    }

    const editor = vscode.window.activeTextEditor;
    let script: string | undefined;
    let table: string | undefined;
    let scriptType: string | undefined;

    if (editor && action !== 'generate' && action !== 'explainError') {
      const text = editor.document.getText();
      const parsed = readHeader(text);
      if (parsed) {
        script = parsed.body.replace(/^\n/, '');
        table = parsed.meta.scope === 'global' ? undefined : parsed.meta.scope;
        scriptType = parsed.meta.table;
      } else {
        script = text;
      }
    }

    let description = explicit?.description;
    if (action === 'generate' && !description) {
      description = await vscode.window.showInputBox({
        prompt: 'Describe what to generate',
        ignoreFocusOut: true,
      });
      if (!description) return;
    }

    let errorMessage = explicit?.errorMessage;
    if (action === 'explainError' && !errorMessage) {
      errorMessage = await vscode.window.showInputBox({
        prompt: 'Paste the error message',
        ignoreFocusOut: true,
      });
      if (!errorMessage) return;
    }

    const userPrompt = buildPrompt(action, { script, description, scriptType, table, errorMessage });
    this.channel.show(true);
    this.channel.appendLine(`\n──── ${action} (${cfg.model}) ────`);

    const finalCfg = cfg;
    const res = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `NowForge AI: ${action}…` },
      () => callAI({
        provider: finalCfg.provider,
        apiKey: finalCfg.apiKey,
        model: finalCfg.model,
        userPrompt,
        maxTokens: 3072,
      })
    );

    if (!res.ok) {
      this.channel.appendLine(`✗ ${res.error}`);
      void vscode.window.showErrorMessage(`NowForge AI: ${res.error}`);
      return;
    }
    this.channel.appendLine(res.text);
  }
}
