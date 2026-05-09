import { readEditorValue } from './editorBridge.js';

/**
 * Detect a script-bearing editor at or above an event target, and return:
 *   - the host element the user right-clicked into
 *   - the kind of editor (so the menu can label / disable accordingly)
 *   - a reader fn that returns the script content
 */

export type EditorKind = 'monaco' | 'codemirror' | 'textarea' | 'unknown';

export interface DetectedScript {
  kind: EditorKind;
  host: HTMLElement;
  /** Resolves to the script content, or null if we can't read it. */
  read: () => Promise<string | null>;
}

const TEXTAREA_NAME_HINTS = /script|condition|code|template|css|html|controller/i;
const SCRIPT_TABLES = new Set([
  'sys_script', 'sys_script_client', 'sys_script_include', 'sys_script_fix',
  'sys_ui_action', 'sys_ui_policy', 'sys_ui_script',
  'sysauto_script', 'sp_widget', 'sys_ws_operation',
]);

/** Walk up from `start` and return the first detected script editor. */
export function detectScriptAtTarget(
  start: EventTarget | null,
  pageTable: string | null
): DetectedScript | null {
  let node = start as Element | null;

  for (let i = 0; node && i < 12; i++, node = node.parentElement) {
    // Monaco: look for the canonical class
    if (node.classList?.contains('monaco-editor')) {
      const host = node as HTMLElement;
      return {
        kind: 'monaco',
        host,
        read: () => readEditorValue(host),
      };
    }
    // CodeMirror 5
    if (node.classList?.contains('CodeMirror')) {
      const host = node as HTMLElement;
      return {
        kind: 'codemirror',
        host,
        read: () => readEditorValue(host),
      };
    }
    // Textarea fallback
    if (node.tagName === 'TEXTAREA') {
      const ta = node as HTMLTextAreaElement;
      const name = ta.name ?? '';
      const id = ta.id ?? '';
      const tableHint = pageTable && SCRIPT_TABLES.has(pageTable);
      const looksScripty = TEXTAREA_NAME_HINTS.test(name) || TEXTAREA_NAME_HINTS.test(id);
      if (tableHint || looksScripty) {
        return {
          kind: 'textarea',
          host: ta,
          read: () => Promise.resolve(ta.value),
        };
      }
    }
  }
  return null;
}

/**
 * Extract the table this form is targeting, used by "Show all scripts on
 * this table" and the GlideRecord template generator.
 *
 * Strategy depends on which form we're on:
 *   - Business Rule (sys_script): read `collection` field
 *   - Client Script / UI Action / UI Policy: read `table` field
 *   - Otherwise: null
 */
export function detectFormTable(pageTable: string | null): string | null {
  if (!pageTable) return null;

  // Build a list of input-name candidates per host table
  let candidates: string[] = [];
  switch (pageTable) {
    case 'sys_script':
      candidates = ['sys_script.collection', 'collection'];
      break;
    case 'sys_script_client':
    case 'sys_ui_action':
    case 'sys_ui_policy':
      candidates = [`${pageTable}.table`, 'table'];
      break;
    default:
      return null;
  }

  for (const name of candidates) {
    const sel = `[name="${CSS.escape(name)}"]`;
    const input = document.querySelector<HTMLInputElement>(sel);
    if (input?.value) return input.value;
  }
  return null;
}
