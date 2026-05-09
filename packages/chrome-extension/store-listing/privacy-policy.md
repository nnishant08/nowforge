# NowForge Privacy Policy

_Last updated: 2026-05-09_

NowForge is built around a simple principle: your data should stay where you put it. This policy explains what NowForge does and doesn't collect.

## What NowForge stores locally

The browser extension stores the following in your browser's local storage (`chrome.storage.local`) — never sent anywhere unless you explicitly trigger a feature that sends it:

- Configured ServiceNow instance URLs and metadata (env type, color)
- Recent records you visit (for the Smart Navigation feature)
- Background Script Runner history
- Background Script Runner editor draft
- Cached field-dictionary entries (1-hour TTL)
- AI provider preferences and your AI API key (encrypted at rest by Chrome)

Favorites and feature toggles sync via `chrome.storage.sync` so they roam across machines on which you're signed into Chrome. They are **not** sent to NowForge's servers.

## What NowForge sends, and where

- **ServiceNow REST calls**: NowForge calls your active SN instance's REST API directly using your existing browser session. No NowForge servers are involved.
- **AI Assistant (Pro)**: Your script, prompt, and API key are sent **directly** to Anthropic's or OpenAI's API — whichever provider you configured. NowForge does not proxy or log these requests.
- **Team Sync (Team)**: When signed in to NowForge cloud (Supabase), shared snippets, commands, bookmarks, and team metadata are sent to Supabase. Row-level security ensures you only see your own teams' data.
- **Plugin Marketplace (Optional)**: When you install a plugin, the plugin JSON is downloaded to your local storage. Plugin author profiles are public.

## What NowForge does NOT collect

- We don't track your browsing.
- We don't collect ServiceNow instance URLs or send them to NowForge.
- We don't ship telemetry without your explicit opt-in.
- We don't store your ServiceNow username or password (basic auth credentials, when used by the VS Code extension, live in your OS keychain via VS Code SecretStorage).

## Cookies

The extension does not set cookies. It uses `chrome.storage` for all persistence.

## GDPR / CCPA

Data subjects have the right to access, correct, and delete their data. Local browser storage can be cleared via the extension's options page. Cloud-synced data (Team Sync) can be deleted by contacting team@nowforge.dev — we will action requests within 30 days.

## Data retention

- Local storage: until you uninstall the extension or clear it manually
- Team Sync: until you delete the record, or 12 months after team disbandment, whichever comes first
- Plugin Marketplace: until you remove your plugin or delete your account

## Children

NowForge is a developer tool not directed at children under 13.

## Contact

Questions: privacy@nowforge.dev
