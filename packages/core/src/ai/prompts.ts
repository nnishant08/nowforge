/**
 * Per-action user-prompt templates. The system prompt is constant (see
 * systemPrompt.ts); the user prompt frames the specific request.
 */

export type AIAction =
  | 'explain'
  | 'refactor'
  | 'generate'
  | 'convertToGlideQuery'
  | 'generateAtfTest'
  | 'document'
  | 'explainError';

export interface PromptContext {
  /** The full script text (for explain/refactor/convert/test/document). */
  script?: string;
  /** Natural-language description of what to generate. */
  description?: string;
  /** Optional script type — Business Rule / Client Script / Script Include / etc. */
  scriptType?: string;
  /** Optional table name. */
  table?: string;
  /** For explain-error. */
  errorMessage?: string;
}

export function buildPrompt(action: AIAction, ctx: PromptContext): string {
  switch (action) {
    case 'explain':
      return [
        'Explain this ServiceNow script in plain English. Include:',
        '  1. What table it operates on (if applicable)',
        '  2. When it runs (load/change/submit/before/after/etc.)',
        '  3. What it does, step by step',
        '  4. Any potential issues or anti-patterns',
        '',
        '```javascript',
        ctx.script ?? '',
        '```',
      ].join('\n');

    case 'refactor':
      return [
        'Refactor this ServiceNow script following best practices. Improve performance, security, readability.',
        'Explain each change you make.',
        '',
        '```javascript',
        ctx.script ?? '',
        '```',
      ].join('\n');

    case 'generate':
      return [
        `Generate a ServiceNow ${ctx.scriptType ?? 'server-side'} script that does the following:`,
        '',
        ctx.description ?? '',
        '',
        ctx.table ? `Context: The script will run on the \`${ctx.table}\` table.` : '',
        'Use ES5 syntax for server-side code. Include comments. Follow ServiceNow best practices.',
      ].join('\n');

    case 'convertToGlideQuery':
      return [
        'Convert this GlideRecord code to use the modern GlideQuery API. Keep the same logic and results.',
        'Explain why each transformation is an improvement.',
        '',
        '```javascript',
        ctx.script ?? '',
        '```',
      ].join('\n');

    case 'generateAtfTest':
      return [
        'Generate an ATF (Automated Test Framework) test for this ServiceNow script.',
        'Include test setup, execution, assertions, and cleanup steps.',
        'Provide the test step JSON or step-by-step instructions to recreate the test in the ATF UI.',
        '',
        ctx.scriptType ? `Script type: ${ctx.scriptType}` : '',
        ctx.table ? `Table: ${ctx.table}` : '',
        '',
        '```javascript',
        ctx.script ?? '',
        '```',
      ].join('\n');

    case 'document':
      return [
        'Generate JSDoc documentation for this ServiceNow Script Include.',
        'For each function, include @param, @returns, @example, and a one-line @description.',
        'Output the entire script with JSDoc inserted above each function.',
        '',
        '```javascript',
        ctx.script ?? '',
        '```',
      ].join('\n');

    case 'explainError':
      return [
        'Explain this ServiceNow error and suggest fixes:',
        '',
        '```',
        ctx.errorMessage ?? '',
        '```',
        '',
        ctx.scriptType ? `Context: This error occurred in a ${ctx.scriptType}.` : '',
        ctx.table ? `On the ${ctx.table} table.` : '',
      ].join('\n');
  }
}
