import * as vscode from 'vscode';

/**
 * Wraps VS Code's SecretStorage for instance passwords. Keyed by instance
 * name so users can have multiple instances configured.
 *
 * Why SecretStorage: VS Code's secret store is OS-level (Keychain on macOS,
 * DPAPI on Windows, libsecret on Linux). Passwords never sit in plaintext in
 * settings.json or anywhere on disk that a stray git commit could capture.
 */

const PREFIX = 'nowforge.password.';

export class CredentialStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getPassword(instanceName: string): Promise<string | undefined> {
    return this.secrets.get(PREFIX + instanceName);
  }

  async setPassword(instanceName: string, password: string): Promise<void> {
    await this.secrets.store(PREFIX + instanceName, password);
  }

  async deletePassword(instanceName: string): Promise<void> {
    await this.secrets.delete(PREFIX + instanceName);
  }
}
