/**
 * Hover documentation for SN APIs. Keyed by `<base>.<method>` or just
 * `<identifier>`. The browser-side learning mode looks up the token under
 * the cursor and shows this content as a tooltip.
 */

export interface ApiDoc {
  signature: string;
  description: string;
  example?: string;
}

export const API_DOCS: Record<string, ApiDoc> = {
  // Top-level identifiers
  'GlideRecord': {
    signature: 'new GlideRecord(tableName)',
    description:
      'Primary API for querying and manipulating database records. Always add query conditions before .query() to avoid full table scans. Never use in client scripts — use GlideAjax instead.',
  },
  'GlideQuery': {
    signature: 'new GlideQuery(tableName)',
    description: 'Modern chainable query builder (Yokohama+). Returns Optional/Stream values. Preferred for new server code.',
  },
  'GlideAggregate': {
    signature: 'new GlideAggregate(tableName)',
    description: 'COUNT/SUM/AVG/MIN/MAX queries. Use addAggregate(\'COUNT\') then query() then next() then getAggregate().',
  },
  'gs': {
    signature: 'GlideSystem global',
    description: 'System utilities — gs.info, gs.nil, gs.getProperty, gs.eventQueue, gs.getUser, etc.',
  },
  'g_form': {
    signature: 'GlideForm — client-side',
    description: 'Form manipulation in client scripts. getValue, setValue, setVisible, setMandatory, addInfoMessage.',
  },
  'current': {
    signature: 'GlideRecord — implicit',
    description: 'The record being processed in a Business Rule. In before rules, changes commit automatically. In after rules, call current.update() to save.',
  },

  // GlideRecord methods
  'GlideRecord.addQuery': {
    signature: 'addQuery(field, value) | addQuery(field, op, value)',
    description: 'Adds an AND condition to the query. Op defaults to = if 2 args. Common ops: =, !=, >, <, IN, LIKE, STARTSWITH.',
    example: "gr.addQuery('priority', '<=', 2);",
  },
  'GlideRecord.addEncodedQuery': {
    signature: 'addEncodedQuery(query)',
    description: 'Adds a raw encoded-query string. Useful for copying queries from the SN list filter.',
    example: "gr.addEncodedQuery('active=true^priority=1');",
  },
  'GlideRecord.setLimit': {
    signature: 'setLimit(n)',
    description: 'Cap the result rows. Always set this when checking existence to avoid full table scans.',
    example: 'gr.setLimit(1);',
  },
  'GlideRecord.next': {
    signature: 'next()',
    description: 'Move the cursor to the next row. Returns false when exhausted.',
  },
  'GlideRecord.get': {
    signature: 'get(sysId) | get(field, value)',
    description: 'Fetch a single record. Returns true if found.',
    example: "if (gr.get(sysId)) gs.info(gr.short_description);",
  },
  'GlideRecord.insert': {
    signature: 'insert()',
    description: 'Insert the current row. Returns the new sys_id (or "0" on failure).',
  },
  'GlideRecord.update': {
    signature: 'update(reason?)',
    description: 'Update the current row. Returns the sys_id.',
  },
  'GlideRecord.deleteRecord': {
    signature: 'deleteRecord()',
    description: 'Delete the current row.',
  },

  // gs methods
  'gs.nil': {
    signature: 'gs.nil(value)',
    description: 'Returns true if value is null, undefined, empty, or whitespace. Preferred over == null because it handles SN\'s Java null edge cases.',
    example: "if (gs.nil(gr.assigned_to)) gs.info('Unassigned');",
  },
  'gs.info': {
    signature: 'gs.info(message, ...params)',
    description: 'Info-level log. Goes to syslog with source = the script name.',
  },
  'gs.error': {
    signature: 'gs.error(message)',
    description: 'Error-level log. Always include error context.',
  },
  'gs.print': {
    signature: 'gs.print(message)',
    description: 'Background-script output only. Use gs.info/debug/warn/error in production code.',
  },
  'gs.getProperty': {
    signature: 'gs.getProperty(name, default?)',
    description: 'Read a system property. Use this instead of hardcoded values.',
    example: "var key = gs.getProperty('x_my_app.api_key');",
  },
  'gs.eventQueue': {
    signature: 'gs.eventQueue(name, current, parm1?, parm2?)',
    description: 'Queue an event for async processing.',
  },

  // Client-side APIs
  'g_form.getValue': {
    signature: 'g_form.getValue(field)',
    description: 'Get the underlying value (not display value).',
  },
  'g_form.setValue': {
    signature: 'g_form.setValue(field, value, displayValue?)',
    description: 'Set a field value. Triggers onChange handlers.',
  },
  'GlideAjax': {
    signature: 'new GlideAjax(scriptIncludeName)',
    description:
      'Client-to-server bridge. Pair with a Script Include extending AbstractAjaxProcessor.',
    example:
      "var ga = new GlideAjax('MyAjax');\n" +
      "ga.addParam('sysparm_name', 'doSomething');\n" +
      'ga.getXMLAnswer(function (answer) { /* use answer */ });',
  },
};

/** Find a doc entry for a base+method or just identifier. */
export function lookupApi(base: string | null, name: string): ApiDoc | null {
  if (base) {
    const key = `${base}.${name}`;
    if (API_DOCS[key]) return API_DOCS[key];
  }
  return API_DOCS[name] ?? null;
}
