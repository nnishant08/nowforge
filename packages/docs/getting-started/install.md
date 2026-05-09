# Install

NowForge ships in three pieces. You probably want all three eventually; the browser extension is enough to start.

## 1. Browser extension (free)

The Chrome extension works in Chrome and Edge.

- **Chrome Web Store:** https://chrome.google.com/webstore/detail/nowforge — coming soon
- **From source** (today):
  ```bash
  git clone https://github.com/nnishant08/nowforge.git
  cd nowforge
  pnpm install
  pnpm build
  ```
  Then in Chrome: `chrome://extensions` → toggle Developer mode → Load unpacked → select `packages/chrome-extension/dist`.

## 2. VS Code extension (Pro)

The companion that lets you edit ServiceNow scripts in VS Code with auto-push on save.

- **From the VS Code Marketplace:** coming soon
- **From source:**
  ```bash
  pnpm build:vscode
  ```
  Then `code --install-extension packages/vscode-extension/dist/extension.js` (or package as VSIX with `vsce package`).

## 3. MCP server (Pro)

Connect AI tools (Claude Desktop, Cursor, Windsurf, VS Code MCP, GitHub Copilot) directly to your SN instance.

```bash
npm install -g @nowforge/mcp-server
# or run via npx without installing:
npx nowforge-mcp
```

For Claude Desktop, add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nowforge": {
      "command": "npx",
      "args": ["nowforge-mcp"],
      "env": {
        "NOWFORGE_INSTANCE": "https://dev12345.service-now.com",
        "NOWFORGE_USER": "admin",
        "NOWFORGE_PASSWORD": "your-password"
      }
    }
  }
}
```

For Cursor, add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nowforge": { "command": "npx", "args": ["nowforge-mcp"] }
  }
}
```

## Next

[First steps →](./first-steps)
