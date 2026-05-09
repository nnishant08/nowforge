# Plugin Format

Plugins are JSON. They live in chrome.storage.local and (optionally) on the marketplace. Every plugin is just a single document with metadata + content sections.

## Structure

```json
{
  "id": "com.author.plugin-name",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": { "name": "Jane Developer", "email": "jane@example.com" },
  "description": "Adds 10 commands and 3 quality rules.",
  "category": "mixed",
  "tags": ["hrsd", "commands"],
  "license": "MIT",
  "minNowForgeVersion": "1.0.0",
  "contents": {
    "commands": [],
    "qualityRules": [],
    "snippets": [],
    "aiPrompts": [],
    "pipelineTemplates": [],
    "tips": []
  }
}
```

Every section is optional. A plugin can ship just commands, just rules, or any combination.

## Section: commands

Adds entries to the Command Bar.

```json
{
  "id": "hrsd-cases",
  "label": "HRSD Cases",
  "description": "Open the HR Case list",
  "icon": "🏢",
  "slash": "/hrsd",
  "keywords": ["hr", "cases"],
  "action": {
    "type": "navigate",
    "url": "/now/nav/ui/classic/params/target/sn_hr_core_case_list.do"
  }
}
```

Action types:
- `navigate` — set `url`. Replaces the current tab.
- `runScript` — set `script`. Sends to the Background Script Runner.

## Section: qualityRules

Each rule is a regex-based check.

```json
{
  "ruleId": "no-deprecated-helper",
  "description": "Disallow LegacyHelper usage; use V2Helper instead.",
  "severity": "warning",
  "category": "upgradeability",
  "pattern": "\\bLegacyHelper\\b",
  "message": "LegacyHelper is deprecated. Use V2Helper."
}
```

The pattern is compiled with `gi` flags. Findings include line numbers automatically.

## Section: snippets

Surfaced in the Script Runner's snippets overlay.

```json
{
  "name": "Encrypted property",
  "description": "Read an encrypted property",
  "script": "var v = gs.getProperty('x_my_app.api_key');",
  "category": "Properties"
}
```

## Section: aiPrompts

Custom user-prompt templates for the AI Assistant. Use `${script}` and `${description}` placeholders.

```json
{
  "id": "convert-to-flow",
  "label": "Convert to Flow Designer",
  "template": "Convert this script to a Flow Designer flow...\n\n${script}"
}
```

## Section: pipelineTemplates

Pre-built deployment pipelines.

## Section: tips

Learning-mode entries. Each gets surfaced in the "How do I..." command.

```json
{
  "id": "hr-case-state",
  "question": "What are the HR case state values?",
  "answer": "1=New, 2=In Progress, 3=Closed Complete...",
  "category": "HRSD",
  "tags": ["hrsd", "case", "state"]
}
```

## Validation

Plugins are validated client-side before install — see `validatePlugin` in `@nowforge/core`. Marketplace submissions go through additional review.
