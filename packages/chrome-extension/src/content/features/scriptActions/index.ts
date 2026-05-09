import type { PageContext } from '../../../shared/messaging.js';
import { ScriptActionsMenu, type ActionItem } from './contextMenu.js';
import { detectScriptAtTarget, detectFormTable } from './scriptReader.js';
import { generateGlideRecordTemplate } from './templates.js';
import { buildScriptListUrl } from './listLinks.js';

const PENDING_SCRIPT_KEY = 'nowforge_pending_script';

export interface ScriptActionsHandle {
  setContext(ctx: PageContext): void;
}

export function initScriptActions(initialContext: PageContext): ScriptActionsHandle {
  let context = initialContext;
  const menu = new ScriptActionsMenu();

  document.addEventListener('contextmenu', (e) => {
    const detected = detectScriptAtTarget(e.target, context.tableName);
    if (!detected) return; // not on a script field — let the browser handle it

    e.preventDefault();
    e.stopPropagation();

    const formTable = detectFormTable(context.tableName);
    const items = buildItems({
      menu,
      context,
      formTable,
      readScript: detected.read,
    });
    menu.open(items, e.clientX, e.clientY);
  }, { capture: true });

  return {
    setContext(ctx) { context = ctx; },
  };
}

interface BuildArgs {
  menu: ScriptActionsMenu;
  context: PageContext;
  formTable: string | null;
  readScript: () => Promise<string | null>;
}

function buildItems({ menu, context, formTable, readScript }: BuildArgs): ActionItem[] {
  const items: ActionItem[] = [];
  const baseUrl = context.instanceInfo?.baseUrl ?? null;
  const pageTable = context.tableName;
  const sysId = context.sysId;

  // ── Copy actions ────────────────────────────────────────────────────────
  items.push({
    id: 'copy',
    icon: '✂️',
    label: 'Copy entire script',
    onClick: () => {
      void readScript().then((script) => {
        if (script == null) {
          menu.toast('Could not read script content');
          return;
        }
        void navigator.clipboard.writeText(script).then(
          () => menu.toast('✓ Script copied'),
          () => menu.toast('Copy failed')
        );
      });
    },
  });

  items.push({
    id: 'copy-md',
    icon: '📋',
    label: 'Copy as code block (Markdown)',
    onClick: () => {
      void readScript().then((script) => {
        if (script == null) {
          menu.toast('Could not read script content');
          return;
        }
        const md = '```javascript\n' + script + '\n```';
        void navigator.clipboard.writeText(md).then(
          () => menu.toast('✓ Copied as code block'),
          () => menu.toast('Copy failed')
        );
      });
    },
  });

  // ── Run / Generate ──────────────────────────────────────────────────────
  items.push({
    id: 'run',
    icon: '▶️',
    label: 'Open in Script Runner',
    newSection: true,
    onClick: () => {
      void readScript().then(async (script) => {
        if (script == null) {
          menu.toast('Could not read script content');
          return;
        }
        // Stage the script for the side panel to pick up
        try {
          await chrome.storage.local.set({
            [PENDING_SCRIPT_KEY]: { script, ts: Date.now() },
          });
        } catch { /* ignore */ }
        // Ask the background SW to open the side panel (gesture chain)
        try {
          const res: { ok?: boolean } = await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
          if (res?.ok) menu.toast('Loaded in Script Runner');
          else menu.toast('Open the side panel to see your script');
        } catch {
          menu.toast('Open the side panel to see your script');
        }
      });
    },
  });

  const tableForTemplate = formTable ?? pageTable;
  items.push({
    id: 'gen-template',
    icon: '📝',
    label: tableForTemplate
      ? `Generate GlideRecord template (${tableForTemplate})`
      : 'Generate GlideRecord template',
    disabled: !tableForTemplate,
    onClick: () => {
      if (!tableForTemplate) return;
      const template = generateGlideRecordTemplate(tableForTemplate);
      void navigator.clipboard.writeText(template).then(
        () => menu.toast(`✓ Template copied for: ${tableForTemplate}`),
        () => menu.toast('Copy failed')
      );
    },
  });

  // ── Navigation ──────────────────────────────────────────────────────────
  const listUrlPath = pageTable ? buildScriptListUrl(pageTable, formTable) : null;
  items.push({
    id: 'show-list',
    icon: '🔍',
    label: formTable
      ? `Show all scripts on ${formTable}`
      : 'Show all scripts on this table',
    disabled: !listUrlPath || !baseUrl,
    newSection: true,
    onClick: () => {
      if (!listUrlPath || !baseUrl) return;
      void chrome.tabs.create({ url: baseUrl + listUrlPath });
    },
  });

  items.push({
    id: 'open-record',
    icon: '📖',
    label: "Open this script's record",
    disabled: !pageTable || !sysId || !baseUrl,
    onClick: () => {
      if (!pageTable || !sysId || !baseUrl) return;
      void chrome.tabs.create({ url: `${baseUrl}/${pageTable}.do?sys_id=${sysId}` });
    },
  });

  // ── Pro placeholders ────────────────────────────────────────────────────
  items.push({
    id: 'explain',
    icon: '🤖',
    label: 'Explain this script',
    badge: 'Pro',
    disabled: true,
    newSection: true,
  });
  items.push({
    id: 'refactor',
    icon: '🔄',
    label: 'Refactor this script',
    badge: 'Pro',
    disabled: true,
  });

  return items;
}
