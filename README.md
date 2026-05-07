# NowForge

> **The complete developer toolkit for ServiceNow** — built into your browser.

NowForge is a Chrome/Edge extension that turns any ServiceNow instance into a more productive place to build. It surfaces the instance you're on at a glance, gives you instant access to the records and scripts you actually use, and adds the keyboard-first shortcuts that the platform itself never shipped. Built for ServiceNow developers, admins, and consultants who switch between dev / test / UAT / prod instances all day and need to *not* push code to the wrong one.

## Screenshots

> _Real screenshots coming after Day 3 — placeholder for now._

| Instance Identity | Command Bar | Field Intelligence |
|---|---|---|
| ![identity placeholder](docs/screenshots/identity.png) | ![cmd placeholder](docs/screenshots/command-bar.png) | ![fields placeholder](docs/screenshots/field-intel.png) |

## Features

### Shipping in 0.1.0
- ✅ **Instance Identity** — color-coded favicon badges, floating env tag (with current user / scope / update set), and `[DEV]`/`[PROD]` tab title prefix so you always know which instance you're on

### On the roadmap
- 🔄 **Command Bar** — `⌘K` to jump to any record, table, script, or update set
- 🔄 **Field Intelligence** — hover any field in classic UI to see its type, dictionary entry, and references
- 🔄 **Background Script Runner** — execute scripts from a side-panel REPL with output streaming
- 🔄 **Update Set Dashboard** — at-a-glance view of in-progress update sets across instances
- 🔄 **Smart Navigation** — quick-switch between related records (incident → change → problem)
- 🔄 **UI Builder Companion** — component tree, prop inspector, and live data binding
- 🔄 **Flow Designer Inspector** — readable view of flow context, inputs/outputs, and execution history
- 🔄 **Script Quick Actions** — one-click "Run as user X", "Wrap in try/catch", "Convert to scoped" on any script field
- 🔄 **What's Changed Indicator** — diff view between the on-screen record and the latest server version

## Installation

### From source

Requires **Node.js 20+** and **pnpm 9+**.

```bash
git clone https://github.com/<your-username>/nowforge.git
cd nowforge
pnpm install
pnpm build
```

Then load it in Chrome (or Edge):

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the folder: `packages/chrome-extension/dist`

The NowForge icon should appear in your toolbar. Pin it. Visit any `*.service-now.com` page (hard-refresh if the tab was already open) and you should see the favicon turn into a colored circle and a floating tag appear in the top-right.

### From the Chrome Web Store

> Coming soon.

## Development

```bash
# Watch mode — rebuilds on every save
pnpm dev

# Type-check without emitting
pnpm typecheck

# Lint everything
pnpm lint

# Package for the Chrome Web Store (creates nowforge-extension-{version}.zip)
pnpm package
```

While in `pnpm dev`, click the **↺ reload** button on the NowForge card at `chrome://extensions` after each change. (Hot reload for content scripts requires a tab refresh too.)

### Project structure

```
nowforge/
├── packages/
│   ├── core/              # Pure TS library — instance detection, REST client, URL parsing
│   ├── types/             # ServiceNow ambient type declarations (GlideRecord, g_form, sn_ws...)
│   └── chrome-extension/  # MV3 extension — content script, background SW, popup, side panel, options
├── package.json           # Workspace root
├── pnpm-workspace.yaml
└── tsconfig.json          # Project references
```

### Architecture notes

- **Manifest V3** end-to-end — service worker for the background, no V2 APIs anywhere
- **Vite** builds the extension UI pages (popup / side panel / options) and the background SW
- **tsup** builds the content script as a self-contained IIFE — content scripts run as classic scripts and can't use ES module `import`, so we inline every dependency
- **`@nowforge/core`** ships ESM + CJS + `.d.ts`, no runtime browser/node deps
- **Closed Shadow DOM** for the floating instance tag isolates our styles from ServiceNow's
- **Settings live in `chrome.storage.sync`** so they roam with your Chrome profile

## Contributing

NowForge is solo right now, but the door is open. If you've got an idea for a feature, file an issue. If you want to send a PR:

1. Fork → create a branch → make your changes
2. Run `pnpm lint` and `pnpm typecheck` — both must pass
3. Update `CHANGELOG.md` under an `## [Unreleased]` section
4. Open a PR with a clear description of what you changed and why

Bug reports are welcome. Include the SN instance type (Tokyo / Utah / Vancouver / etc.), the page type, and any console output.

## License

MIT — see [LICENSE](./LICENSE).
