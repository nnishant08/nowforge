# Changelog

All notable changes to NowForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-08

### Added
- Project scaffold with monorepo structure (pnpm workspaces, project references, Vite + tsup build)
- Content script injection on ServiceNow pages (`https://*.service-now.com/*`)
- Page type detection (form, list, UI Builder, Flow Designer, Service Portal, Workspace, other)
- Instance Identity: color-coded favicon badges per environment (16×16 + 32×32, cached per env/color)
- Instance Identity: floating environment tag with instance details (Shadow DOM, draggable, expandable, top-level only)
- Instance Identity: tab title prefixing with environment type (`[DEV]`, `[PROD]`, …) with mutation observer for SPA navigation
- Background service worker: per-tab toolbar icon with instance initials, env-colored badge text
- ServiceNow REST helper for current user / scope / update set with 5-minute cache
- Custom regex rules for env classification (overrides built-in keyword detection)
- Options page with feature toggles, per-env color pickers, custom-rule editor, tag-corner picker, instance list, theme selector
- Typed `chrome.storage` wrapper in `@nowforge/core` (`defineStorageKey<T>`)
- Ambient TypeScript declarations for ServiceNow globals (`GlideRecord`, `g_form`, `sn_ws.RESTMessageV2`, …) in `@nowforge/types`
