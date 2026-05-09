import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

/**
 * ServiceNow server-side API completions.
 *
 * Two layers:
 *   1. Top-level identifiers (gs, GlideRecord, GlideQuery, GlideAggregate,
 *      GlideDateTime) — completed when the cursor is at the start of an
 *      identifier with no preceding `.`.
 *   2. Method completions on those identifiers — completed when the prefix
 *      ends with one of those identifiers followed by `.`.
 */

interface MethodSpec {
  name: string;
  signature: string;
  doc: string;
}

const GLIDE_RECORD_METHODS: MethodSpec[] = [
  { name: 'addQuery',           signature: '(field, value)',                doc: 'Add a query condition.' },
  { name: 'addEncodedQuery',    signature: '(query)',                       doc: 'Add an encoded query string.' },
  { name: 'addOrCondition',     signature: '(field, operator?, value)',     doc: 'OR condition added to last addQuery.' },
  { name: 'addNotNullQuery',    signature: '(field)',                       doc: 'Where field IS NOT NULL.' },
  { name: 'addNullQuery',       signature: '(field)',                       doc: 'Where field IS NULL.' },
  { name: 'addActiveQuery',     signature: '()',                            doc: 'Where active=true.' },
  { name: 'addInactiveQuery',   signature: '()',                            doc: 'Where active=false.' },
  { name: 'query',              signature: '()',                            doc: 'Execute the query.' },
  { name: 'next',               signature: '()',                            doc: 'Move to the next result row.' },
  { name: 'hasNext',            signature: '()',                            doc: 'True if more rows are available.' },
  { name: 'get',                signature: '(sysIdOrField, value?)',        doc: 'Fetch a single record by sys_id or field=value.' },
  { name: 'insert',             signature: '()',                            doc: 'Insert the current record. Returns sys_id.' },
  { name: 'update',             signature: '(reason?)',                     doc: 'Update the current record.' },
  { name: 'deleteRecord',       signature: '()',                            doc: 'Delete the current record.' },
  { name: 'setLimit',           signature: '(n)',                           doc: 'Limit results to n rows.' },
  { name: 'orderBy',            signature: '(field)',                       doc: 'Order ascending by field.' },
  { name: 'orderByDesc',        signature: '(field)',                       doc: 'Order descending by field.' },
  { name: 'setWorkflow',        signature: '(enable)',                      doc: 'Enable/disable business rules and workflows.' },
  { name: 'setValue',           signature: '(field, value)',                doc: 'Set a field value.' },
  { name: 'getValue',           signature: '(field)',                       doc: 'Get a field value as string.' },
  { name: 'getDisplayValue',    signature: '(field?)',                      doc: 'Get the display value (for references etc).' },
  { name: 'getUniqueValue',     signature: '()',                            doc: 'Get the sys_id of the current row.' },
  { name: 'getRowCount',        signature: '()',                            doc: 'Count of rows in the result.' },
  { name: 'getTableName',       signature: '()',                            doc: 'Name of the table.' },
  { name: 'canRead',            signature: '()',                            doc: 'Whether current user can read.' },
  { name: 'canWrite',           signature: '()',                            doc: 'Whether current user can write.' },
  { name: 'canCreate',          signature: '()',                            doc: 'Whether current user can create.' },
  { name: 'canDelete',          signature: '()',                            doc: 'Whether current user can delete.' },
  { name: 'setAbortAction',     signature: '(abort)',                       doc: 'Abort current insert/update.' },
  { name: 'getEncodedQuery',    signature: '()',                            doc: 'Build the encoded query string.' },
  { name: 'getElement',         signature: '(field)',                       doc: 'Get the GlideElement for a field.' },
  { name: 'isValid',            signature: '()',                            doc: 'Is this a valid record reference.' },
  { name: 'isValidField',       signature: '(field)',                       doc: 'Does the field exist on the table.' },
  { name: 'isNewRecord',        signature: '()',                            doc: 'Was this record just initialized.' },
  { name: 'isActionAborted',    signature: '()',                            doc: 'Was setAbortAction called.' },
  { name: 'chooseWindow',       signature: '(start, end)',                  doc: 'Pagination — only return rows [start, end).' },
];

const GS_METHODS: MethodSpec[] = [
  { name: 'log',                  signature: '(message, source?)', doc: 'Log a message at INFO level.' },
  { name: 'info',                 signature: '(message, ...params)',doc: 'Info-level log.' },
  { name: 'debug',                signature: '(message, ...params)',doc: 'Debug-level log.' },
  { name: 'warn',                 signature: '(message, ...params)',doc: 'Warning-level log.' },
  { name: 'error',                signature: '(message, ...params)',doc: 'Error-level log.' },
  { name: 'print',                signature: '(message)',           doc: 'Print to script output (used by background scripts).' },
  { name: 'addInfoMessage',       signature: '(message)',           doc: 'Show a session info message.' },
  { name: 'addErrorMessage',      signature: '(message)',           doc: 'Show a session error message.' },
  { name: 'getUserID',            signature: '()',                  doc: 'Current session user sys_id.' },
  { name: 'getUserName',          signature: '()',                  doc: 'Current session user_name.' },
  { name: 'getUser',              signature: '()',                  doc: 'Current GlideUser.' },
  { name: 'nil',                  signature: '(value)',             doc: 'True if value is null/empty/undefined.' },
  { name: 'tableExists',          signature: '(tableName)',         doc: 'Whether the table exists.' },
  { name: 'getProperty',          signature: '(name, defaultValue?)',doc: 'Read a system property.' },
  { name: 'setProperty',          signature: '(name, value, description?)', doc: 'Write a system property.' },
  { name: 'sleep',                signature: '(milliseconds)',      doc: 'Pause execution.' },
  { name: 'eventQueue',           signature: '(name, current, parm1?, parm2?)', doc: 'Queue an event.' },
  { name: 'getCurrentScopeName',  signature: '()',                  doc: 'Current application scope.' },
  { name: 'include',              signature: '(scriptIncludeName)', doc: 'Load a script include.' },
  { name: 'isLoggedIn',           signature: '()',                  doc: 'Is the current user logged in.' },
  { name: 'hasRole',              signature: '(role)',              doc: 'Does the current user have a role.' },
  { name: 'now',                  signature: '()',                  doc: 'Current date+time as string.' },
  { name: 'nowDateTime',          signature: '()',                  doc: 'Current date+time as GlideDateTime string.' },
  { name: 'beginningOfToday',     signature: '()',                  doc: 'Today at 00:00:00.' },
  { name: 'beginningOfLastMonth', signature: '()',                  doc: 'First day of last month, 00:00:00.' },
  { name: 'endOfLastMonth',       signature: '()',                  doc: 'Last day of last month, 23:59:59.' },
  { name: 'daysAgo',              signature: '(days)',              doc: 'GlideDateTime n days ago.' },
];

const GLIDE_QUERY_METHODS: MethodSpec[] = [
  { name: 'where',           signature: '(field, operator?, value)',     doc: 'Add a where condition (chainable).' },
  { name: 'whereNull',       signature: '(field)',                       doc: 'Where field IS NULL.' },
  { name: 'whereNotNull',    signature: '(field)',                       doc: 'Where field IS NOT NULL.' },
  { name: 'orWhere',         signature: '(field, operator?, value)',     doc: 'OR clause.' },
  { name: 'select',          signature: '(...fields)',                   doc: 'Select fields. Returns Stream.' },
  { name: 'selectOne',       signature: '(...fields)',                   doc: 'Get a single result. Returns Optional.' },
  { name: 'insert',          signature: '(values, ...returnFields)',     doc: 'Insert and return the new record.' },
  { name: 'update',          signature: '(values, ...returnFields)',     doc: 'Update first matching row.' },
  { name: 'updateMultiple',  signature: '(values)',                      doc: 'Update all matching rows.' },
  { name: 'deleteMultiple',  signature: '()',                            doc: 'Delete all matching rows.' },
  { name: 'get',             signature: '(sysId, ...fields)',            doc: 'Get a record by sys_id.' },
  { name: 'aggregate',       signature: '(aggregate, field?)',           doc: 'Aggregate query (COUNT, SUM, AVG, MIN, MAX).' },
  { name: 'avg',             signature: '(field)',                       doc: 'Average of a numeric field.' },
  { name: 'count',           signature: '()',                            doc: 'Row count.' },
  { name: 'max',             signature: '(field)',                       doc: 'Max of a numeric field.' },
  { name: 'min',             signature: '(field)',                       doc: 'Min of a numeric field.' },
  { name: 'sum',             signature: '(field)',                       doc: 'Sum of a numeric field.' },
  { name: 'limit',           signature: '(n)',                           doc: 'Cap the result count.' },
  { name: 'orderBy',         signature: '(field)',                       doc: 'Order ascending.' },
  { name: 'orderByDesc',     signature: '(field)',                       doc: 'Order descending.' },
  { name: 'disableWorkflow', signature: '()',                            doc: 'Skip business rules and workflows.' },
  { name: 'forceUpdate',     signature: '()',                            doc: 'Update even if no fields changed.' },
  { name: 'toArray',         signature: '(maxLength?)',                  doc: 'Materialise the stream to an Array.' },
];

const GLIDE_AGGREGATE_METHODS: MethodSpec[] = [
  { name: 'addAggregate',    signature: "(aggregate, field?)", doc: "Aggregate type ('COUNT'|'SUM'|'AVG'|'MIN'|'MAX')." },
  { name: 'getAggregate',    signature: "(aggregate, field?)", doc: 'Get the aggregate value (call after next).' },
  { name: 'groupBy',         signature: '(field)',             doc: 'Group results by field.' },
  { name: 'orderByAggregate',signature: "(aggregate, field?)", doc: 'Order by an aggregate.' },
  { name: 'query',           signature: '()',                  doc: 'Execute the aggregate query.' },
  { name: 'next',            signature: '()',                  doc: 'Move to next group.' },
  { name: 'hasNext',         signature: '()',                  doc: 'More groups available?' },
  { name: 'addQuery',        signature: '(field, op?, value)', doc: 'Add a filter condition.' },
  { name: 'addEncodedQuery', signature: '(query)',             doc: 'Add an encoded query string.' },
];

const GLIDE_DATE_TIME_METHODS: MethodSpec[] = [
  { name: 'add', signature: '(milliseconds)', doc: 'Add milliseconds.' },
  { name: 'addDaysLocalTime', signature: '(days)', doc: 'Add days in local timezone.' },
  { name: 'addDaysUTC', signature: '(days)', doc: 'Add days in UTC.' },
  { name: 'addMonthsLocalTime', signature: '(months)', doc: 'Add months in local timezone.' },
  { name: 'addMonthsUTC', signature: '(months)', doc: 'Add months in UTC.' },
  { name: 'addSeconds', signature: '(seconds)', doc: 'Add seconds.' },
  { name: 'addWeeksLocalTime', signature: '(weeks)', doc: 'Add weeks in local timezone.' },
  { name: 'addWeeksUTC', signature: '(weeks)', doc: 'Add weeks in UTC.' },
  { name: 'addYearsLocalTime', signature: '(years)', doc: 'Add years in local timezone.' },
  { name: 'addYearsUTC', signature: '(years)', doc: 'Add years in UTC.' },
  { name: 'after', signature: '(other)', doc: 'Is this date after other?' },
  { name: 'before', signature: '(other)', doc: 'Is this date before other?' },
  { name: 'compareTo', signature: '(other)', doc: 'Compare two dates: -1, 0, or 1.' },
  { name: 'equals', signature: '(other)', doc: 'Are two dates equal?' },
  { name: 'getDate', signature: '()', doc: 'Get the date part (yyyy-MM-dd).' },
  { name: 'getDayOfMonthLocalTime', signature: '()', doc: 'Day of month in local time.' },
  { name: 'getDayOfMonthUTC', signature: '()', doc: 'Day of month in UTC.' },
  { name: 'getDayOfWeekLocalTime', signature: '()', doc: 'Day of week in local time (1=Mon..7=Sun).' },
  { name: 'getDayOfWeekUTC', signature: '()', doc: 'Day of week in UTC.' },
  { name: 'getDisplayValue', signature: '()', doc: 'Display value in user format.' },
  { name: 'getDisplayValueInternal', signature: '()', doc: 'Internal display value.' },
  { name: 'getDSTOffset', signature: '()', doc: 'DST offset in milliseconds.' },
  { name: 'getErrorMsg', signature: '()', doc: 'Error message from last operation.' },
  { name: 'getLocalDate', signature: '()', doc: 'Local date.' },
  { name: 'getLocalTime', signature: '()', doc: 'Local time.' },
  { name: 'getMonthLocalTime', signature: '()', doc: 'Month in local time (1-12).' },
  { name: 'getMonthUTC', signature: '()', doc: 'Month in UTC.' },
  { name: 'getNumericValue', signature: '()', doc: 'Unix epoch ms.' },
  { name: 'getTime', signature: '()', doc: 'Get the time-of-day part.' },
  { name: 'getTZOffset', signature: '()', doc: 'Timezone offset in ms.' },
  { name: 'getValue', signature: '()', doc: 'Internal yyyy-MM-dd HH:mm:ss representation.' },
  { name: 'getWeekOfYearLocalTime', signature: '()', doc: 'Week of year in local time.' },
  { name: 'getWeekOfYearUTC', signature: '()', doc: 'Week of year in UTC.' },
  { name: 'getYearLocalTime', signature: '()', doc: 'Year in local time.' },
  { name: 'getYearUTC', signature: '()', doc: 'Year in UTC.' },
  { name: 'hasDate', signature: '()', doc: 'Does it have a date component?' },
  { name: 'setDayOfMonthLocalTime', signature: '(day)', doc: 'Set day of month, local time.' },
  { name: 'setDayOfMonthUTC', signature: '(day)', doc: 'Set day of month, UTC.' },
  { name: 'setDisplayValue', signature: '(value, format?)', doc: 'Set from display value.' },
  { name: 'setDisplayValueInternal', signature: '(value)', doc: 'Set from internal display value.' },
  { name: 'setGlideDateTime', signature: '(other)', doc: 'Copy from another GlideDateTime.' },
  { name: 'setMonthLocalTime', signature: '(month)', doc: 'Set month, local time.' },
  { name: 'setMonthUTC', signature: '(month)', doc: 'Set month, UTC.' },
  { name: 'setNumericValue', signature: '(ms)', doc: 'Set from Unix epoch ms.' },
  { name: 'setValue', signature: '(value, format?)', doc: 'Set from internal value.' },
  { name: 'setValueUTC', signature: '(value, format?)', doc: 'Set from UTC value.' },
  { name: 'setYearLocalTime', signature: '(year)', doc: 'Set year, local time.' },
  { name: 'setYearUTC', signature: '(year)', doc: 'Set year, UTC.' },
  { name: 'subtract', signature: '(other|ms)', doc: 'Subtract another GlideDateTime or ms.' },
  { name: 'toString', signature: '()', doc: 'String representation.' },
];

const METHOD_TABLE: Record<string, MethodSpec[]> = {
  GlideRecord: GLIDE_RECORD_METHODS,
  gs: GS_METHODS,
  GlideQuery: GLIDE_QUERY_METHODS,
  GlideAggregate: GLIDE_AGGREGATE_METHODS,
  GlideDateTime: GLIDE_DATE_TIME_METHODS,
};

const TOP_LEVEL: Completion[] = [
  {
    label: 'GlideRecord',
    type: 'class',
    info: 'Constructor: new GlideRecord(tableName)',
    apply: 'GlideRecord',
    boost: 100,
  },
  { label: 'GlideQuery',     type: 'class',    info: 'Modern query builder.',           boost: 95 },
  { label: 'GlideAggregate', type: 'class',    info: 'COUNT/SUM/AVG/MIN/MAX queries.', boost: 90 },
  { label: 'GlideDateTime',  type: 'class',    info: 'Date+time manipulation.',         boost: 85 },
  { label: 'gs',             type: 'variable', info: 'GlideSystem global.',             boost: 100 },
];

function buildMethodCompletion(spec: MethodSpec): Completion {
  return {
    label: spec.name,
    type: 'method',
    detail: spec.signature,
    info: spec.doc,
    apply: `${spec.name}(`,
  };
}

const METHOD_COMPLETIONS: Record<string, Completion[]> = Object.fromEntries(
  Object.entries(METHOD_TABLE).map(([key, methods]) => [
    key,
    methods.map(buildMethodCompletion),
  ])
);

// ── Reverse lookup for hover tooltips ───────────────────────────────────────
// Built once at module load. For a given identifier (gs, GlideRecord, etc.)
// + method name, returns the full spec for hover tooltip rendering.

export interface MethodLookup {
  base: string;
  spec: MethodSpec;
}

const METHOD_INDEX: Record<string, Record<string, MethodSpec>> = {};
for (const [base, methods] of Object.entries(METHOD_TABLE)) {
  METHOD_INDEX[base] = {};
  for (const m of methods) METHOD_INDEX[base][m.name] = m;
}

/**
 * Look up a (base, method) pair and return the full spec for hover.
 * Returns null if not in our index.
 */
export function findMethod(base: string, method: string): MethodSpec | null {
  return METHOD_INDEX[base]?.[method] ?? null;
}

/**
 * Look up the description of a top-level identifier (gs, GlideRecord, etc.).
 */
export function findTopLevel(name: string): { kind: string; doc: string } | null {
  const c = TOP_LEVEL.find((x) => x.label === name);
  if (!c) return null;
  return {
    kind: c.type === 'class' ? 'class' : 'global',
    doc: typeof c.info === 'string' ? c.info : '',
  };
}

/** CodeMirror completion source. */
export function snowCompletions(context: CompletionContext): CompletionResult | null {
  // Method completions: <identifier>.<token>
  const dotMatch = context.matchBefore(/(GlideRecord|GlideQuery|GlideAggregate|GlideDateTime|gs)\.([\w]*)/);
  if (dotMatch) {
    const m = /^(\w+)\.(\w*)$/.exec(dotMatch.text);
    if (!m) return null;
    const base = m[1];
    const list = METHOD_COMPLETIONS[base];
    if (list) {
      return {
        from: dotMatch.from + base.length + 1,
        options: list,
        validFor: /^\w*$/,
      };
    }
  }

  // Top-level identifiers
  const idMatch = context.matchBefore(/[\w$]+/);
  if (!idMatch) return null;
  if (idMatch.from === idMatch.to && !context.explicit) return null;
  return {
    from: idMatch.from,
    options: TOP_LEVEL,
    validFor: /^[\w$]*$/,
  };
}
