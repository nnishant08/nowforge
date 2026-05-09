/**
 * ServiceNow server-side type declarations.
 *
 * Server scripts run in Mozilla Rhino — ES5 syntax only. No arrow functions,
 * no const/let in scoped runtimes (allowed in newer global scripts), no
 * template literals, no destructuring. All examples below use ES5.
 */

// ── Tagged template type for table-name typing ───────────────────────────────

/** Common SN tables. Used as the generic for `GlideRecord<T>` so TS can hint. */
type CommonTable =
  | 'incident' | 'change_request' | 'problem' | 'task'
  | 'sys_user' | 'sys_user_group' | 'cmdb_ci'
  | 'sys_script' | 'sys_script_client' | 'sys_script_include' | 'sys_ui_action' | 'sys_ui_policy'
  | 'sys_update_set' | 'sys_update_xml' | 'sys_properties'
  | 'sc_request' | 'sc_req_item' | 'sc_task' | 'sc_cat_item'
  | 'kb_knowledge' | 'sys_dictionary' | 'sys_db_object'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {}); // allow arbitrary strings

// ── GlideRecord ──────────────────────────────────────────────────────────────

/**
 * Server-side database access. Use to query, insert, update, and delete
 * records. **Never** use `new GlideRecord` in client scripts — use GlideAjax.
 *
 * @example
 *   var gr = new GlideRecord('incident');
 *   gr.addActiveQuery();
 *   gr.setLimit(10);
 *   gr.query();
 *   while (gr.next()) gs.info(gr.number + ': ' + gr.short_description);
 */
declare class GlideRecord<T extends CommonTable = string> {
  readonly sys_class_name: GlideElement;

  constructor(tableName: T);

  /**
   * Add a where-clause condition. Operator defaults to `=` if 2 args.
   * @example gr.addQuery('priority', '<=', 2);
   */
  addQuery(field: string, value: unknown): GlideQueryCondition;
  addQuery(field: string, operator: string, value: unknown): GlideQueryCondition;

  /** Add a raw encoded query string. */
  addEncodedQuery(query: string): void;

  /** Adds an OR condition to the most-recently-added query. */
  addOrCondition(field: string, value: unknown): GlideQueryCondition;
  addOrCondition(field: string, operator: string, value: unknown): GlideQueryCondition;

  /** Where field IS NOT NULL. */
  addNotNullQuery(field: string): GlideQueryCondition;
  /** Where field IS NULL. */
  addNullQuery(field: string): GlideQueryCondition;
  /** Equivalent to `addQuery('active', true)`. */
  addActiveQuery(): GlideQueryCondition;
  /** Equivalent to `addQuery('active', false)`. */
  addInactiveQuery(): GlideQueryCondition;

  /** Order results ascending. */
  orderBy(field: string): void;
  /** Order results descending. */
  orderByDesc(field: string): void;
  /** Cap result count. **Always set this when checking existence.** */
  setLimit(limit: number): void;

  /** Execute the query. */
  query(): void;
  /** Move to the next row. Returns false at end-of-results. */
  next(): boolean;
  /** Total matching rows. Call after `query()`. */
  getRowCount(): number;
  /** Whether there are more rows after the cursor. */
  hasNext(): boolean;

  /**
   * Fetch a single record by sys_id (1-arg) or by a key/value pair (2-arg).
   * Returns true if found.
   * @example if (gr.get(sysId)) gs.info(gr.short_description);
   */
  get(sysId: string): boolean;
  get(field: string, value: string): boolean;

  /** Insert a new record. Returns the new sys_id, or '0' on failure. */
  insert(): string;
  /** Update the current row. Returns the sys_id. */
  update(reason?: string): string;
  /** Delete the current row. */
  deleteRecord(): boolean;
  /**
   * Delete EVERY row matching the current query.
   * @warning Bypasses business rules unless setWorkflow(true) is called.
   */
  deleteMultiple(): void;

  /** Initialize a new (unsaved) record with default values. */
  initialize(): void;
  /** Whether the current cursor points at a valid row. */
  isValidRecord(): boolean;
  /** Whether the row is unsaved. */
  isNewRecord(): boolean;
  /** Whether the field exists on the table. */
  isValidField(field: string): boolean;
  /** Whether `setAbortAction(true)` was called. */
  isActionAborted(): boolean;

  /** Get a field value as a string. */
  getValue(field: string): string;
  /** Set a field value. */
  setValue(field: string, value: string | number | boolean): void;
  /** Get the display value of a field (resolves references). */
  getDisplayValue(field: string): string;
  /** Get the sys_id of the current row. */
  getUniqueValue(): string;
  /** Get the table name. */
  getTableName(): string;
  /** Get the user-readable record label. */
  getLabel(): string;
  /** Build the encoded query string for the current conditions. */
  getEncodedQuery(): string;
  /** Get the GlideElement for a field — useful for `.getDisplayValue()` etc. */
  getElement(field: string): GlideElement;

  /** Disable business rules / workflows for this insert/update. */
  setWorkflow(enable: boolean): void;
  /** Abort the current insert/update. */
  setAbortAction(abort: boolean): void;

  // Permission checks — useful in security-conscious code
  canRead(): boolean;
  canWrite(): boolean;
  canCreate(): boolean;
  canDelete(): boolean;

  /** Pagination — only return rows in [start, end). */
  chooseWindow(start: number, end: number): void;

  /** GlideRecord acts as an indexer over its fields. */
  [field: string]: unknown;
}

// ── GlideQueryCondition ──────────────────────────────────────────────────────

declare class GlideQueryCondition {
  addCondition(field: string, value: unknown): GlideQueryCondition;
  addCondition(field: string, operator: string, value: unknown): GlideQueryCondition;
  addOrCondition(field: string, value: unknown): GlideQueryCondition;
  addOrCondition(field: string, operator: string, value: unknown): GlideQueryCondition;
}

// ── GlideElement ─────────────────────────────────────────────────────────────

/**
 * Wraps a single field on a GlideRecord. Returned by `gr.getElement(name)`
 * and via `gr.fieldName`.
 */
declare class GlideElement {
  getValue(): string;
  getDisplayValue(): string;
  getName(): string;
  getTableName(): string;
  getED(): GlideElementDescriptor;
  /** Whether the value has changed in the current transaction. */
  changes(): boolean;
  /** Whether the value used to equal the given value. */
  changesFrom(value: string): boolean;
  /** Whether the value is changing to the given value. */
  changesTo(value: string): boolean;
  /** Whether the field has no value. Equivalent to `gs.nil(...)` for this element. */
  nil(): boolean;
  /** For reference fields: get the referenced record. */
  getRefRecord(): GlideRecord;
  setValue(value: string | number | boolean): void;
  toString(): string;
}

declare class GlideElementDescriptor {
  getInternalType(): string;
  getLabel(): string;
  getName(): string;
  getPlural(): string;
}

// ── GlideAggregate ───────────────────────────────────────────────────────────

/**
 * COUNT/SUM/AVG/MIN/MAX queries.
 * @example
 *   var ga = new GlideAggregate('incident');
 *   ga.addAggregate('COUNT');
 *   ga.query();
 *   if (ga.next()) gs.info('Total: ' + ga.getAggregate('COUNT'));
 */
declare class GlideAggregate {
  constructor(tableName: string);
  addAggregate(type: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX', field?: string): void;
  addEncodedQuery(query: string): void;
  addQuery(field: string, value: unknown): GlideQueryCondition;
  addQuery(field: string, operator: string, value: unknown): GlideQueryCondition;
  groupBy(field: string): void;
  orderByAggregate(type: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX', field?: string): void;
  query(): void;
  next(): boolean;
  hasNext(): boolean;
  getAggregate(type: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX', field?: string): string;
  getValue(field: string): string;
  getDisplayValue(field: string): string;
}

// ── GlideDateTime / GlideDate / GlideDuration / GlideTime ────────────────────

declare class GlideDateTime {
  constructor(value?: string | GlideDateTime);
  getValue(): string;
  getDisplayValue(): string;
  getDate(): GlideDate;
  getTime(): GlideTime;
  add(milliseconds: number): void;
  addDaysLocalTime(days: number): void;
  addDaysUTC(days: number): void;
  addMonthsLocalTime(months: number): void;
  addMonthsUTC(months: number): void;
  addSeconds(seconds: number): void;
  addWeeksLocalTime(weeks: number): void;
  addWeeksUTC(weeks: number): void;
  addYearsLocalTime(years: number): void;
  addYearsUTC(years: number): void;
  after(other: GlideDateTime): boolean;
  before(other: GlideDateTime): boolean;
  compareTo(other: GlideDateTime): number;
  equals(other: GlideDateTime): boolean;
  subtract(other: GlideDateTime | number): GlideDuration;
  setDisplayValue(value: string, format?: string): void;
  setValue(value: string, format?: string): void;
  setNumericValue(ms: number): void;
  getNumericValue(): number;
  toString(): string;
}

declare class GlideDate {
  constructor(value?: string);
  getValue(): string;
  getDisplayValue(): string;
  setValue(value: string): void;
}

declare class GlideTime {
  constructor(value?: string);
  getValue(): string;
  getDisplayValue(): string;
}

declare class GlideDuration {
  constructor(milliseconds?: number);
  getValue(): string;
  getDisplayValue(): string;
  getDurationSeconds(): number;
}

// ── GlideUser ────────────────────────────────────────────────────────────────

/** Returned by `gs.getUser()`. */
declare class GlideUser {
  getID(): string;
  getName(): string;
  getFullName(): string;
  getFirstName(): string;
  getLastName(): string;
  getEmail(): string;
  getRoles(): string[];
  getMyGroups(): string[];
  hasRole(role: string): boolean;
  hasRoleExactly(role: string): boolean;
  isMemberOf(group: string): boolean;
  getDomainID(): string;
  getCompanyID(): string;
}

// ── GlideFilter / Schedule / Etc ─────────────────────────────────────────────

declare class GlideFilter {
  static checkRecord(gr: GlideRecord, encodedQuery: string): boolean;
}

declare class GlideSchedule {
  constructor(sysId: string, timezone?: string);
  isInSchedule(date: GlideDateTime): boolean;
  duration(start: GlideDateTime, end: GlideDateTime): GlideDuration;
}

// ── gs (GlideSystem) ─────────────────────────────────────────────────────────

declare const gs: GlideSystem;

declare class GlideSystem {
  // Logging
  log(message: string, source?: string): void;
  info(message: string, ...params: unknown[]): void;
  debug(message: string, ...params: unknown[]): void;
  warn(message: string, ...params: unknown[]): void;
  error(message: string, ...params: unknown[]): void;
  /** Background-script output. Use info/debug for production. */
  print(message: string): void;

  // Session messages
  addInfoMessage(message: string): void;
  addErrorMessage(message: string): void;

  // Identity
  getUserID(): string;
  getUserName(): string;
  getUserDisplayName(): string;
  getUser(): GlideUser;
  hasRole(role: string): boolean;
  isLoggedIn(): boolean;

  // Properties
  getProperty(key: string, defaultValue?: string): string;
  setProperty(key: string, value: string, description: string): void;

  // Time
  /** Current date+time in user's timezone, "yyyy-MM-dd HH:mm:ss". */
  now(): string;
  /** Current date+time in UTC. */
  nowDateTime(): string;
  /** GlideDateTime "n days ago at start-of-day". */
  daysAgo(days: number): string;
  beginningOfToday(): string;
  endOfToday(): string;
  beginningOfLastMonth(): string;
  endOfLastMonth(): string;

  // Helpers
  /** True if value is null/undefined/empty/whitespace. Use this instead of == null. */
  nil(value: unknown): boolean;
  tableExists(tableName: string): boolean;
  sleep(milliseconds: number): void;
  /** Queue an event. Picked up by event registry. */
  eventQueue(name: string, current: GlideRecord, parm1?: string, parm2?: string): void;
  /** Current scope name. */
  getCurrentScopeName(): string;
  /** Load a script include by name. */
  include(scriptIncludeName: string): void;

  // Transactions
  beginTransaction(): void;
  commitTransaction(): void;
  rollbackTransaction(): void;

  // URLs
  getUrlOnStack(): string;
}

// ── sn_ws — Outbound + Inbound REST ──────────────────────────────────────────

declare namespace sn_ws {
  /**
   * Outbound REST. Wrap calls in try/catch.
   * @example
   *   var r = new sn_ws.RESTMessageV2();
   *   r.setHttpMethod('GET');
   *   r.setEndpoint('https://api.example.com/x');
   *   var resp = r.execute();
   *   gs.info(resp.getBody());
   */
  class RESTMessageV2 {
    constructor(name?: string, methodName?: string);
    setHttpMethod(method: string): void;
    setEndpoint(endpoint: string): void;
    setRequestHeader(name: string, value: string): void;
    setBasicAuth(username: string, password: string): void;
    setAuthentication(type: string, profileId: string): void;
    setRequestBody(body: string): void;
    setQueryParameter(name: string, value: string): void;
    execute(): RESTResponseV2;
    executeAsync(): RESTResponseV2;
  }

  class RESTResponseV2 {
    getBody(): string;
    getHeader(name: string): string;
    getHeaders(): Record<string, string>;
    getStatusCode(): number;
    haveError(): boolean;
    getErrorMessage(): string;
  }

  /**
   * Outbound SOAP. Less common; mostly for legacy systems.
   */
  class SOAPMessageV2 {
    constructor(soapMessageName?: string, methodName?: string);
    setBasicAuth(username: string, password: string): void;
    setStringParameterNoEscape(name: string, value: string): void;
    execute(): SOAPResponseV2;
    executeAsync(): SOAPResponseV2;
  }
  class SOAPResponseV2 {
    getBody(): string;
    getStatusCode(): number;
    haveError(): boolean;
    getErrorMessage(): string;
  }

  // Scripted REST API request/response
  const request: RESTAPIRequest;
  const response: RESTAPIResponse;

  class RESTAPIRequest {
    readonly body: RESTAPIRequestBody;
    readonly pathParams: Record<string, string>;
    readonly queryParams: Record<string, string[]>;
    readonly headers: Record<string, string>;
    getQueryParameter(name: string): string;
    getPathParameter(name: string): string;
    getHeader(name: string): string;
  }
  class RESTAPIRequestBody {
    readonly dataString: string;
    readonly data: unknown;
  }
  class RESTAPIResponse {
    setBody(body: unknown): void;
    setStatus(status: number): void;
    setHeader(name: string, value: string): void;
    setContentType(contentType: string): void;
    setError(error: { status: number; message: string }): void;
  }
}

// ── sn_fd — Flow Designer API ───────────────────────────────────────────────

declare namespace sn_fd {
  class FlowAPI {
    static startFlow(flowName: string, currentRecord?: GlideRecord, operation?: string, inputs?: Record<string, unknown>): void;
    static startSubflow(subflowName: string, inputs?: Record<string, unknown>): Record<string, unknown>;
    static executeAction(actionName: string, inputs?: Record<string, unknown>): Record<string, unknown>;
  }
}

// ── Globals available in business rules ─────────────────────────────────────

/** Current record (the row being inserted/updated). Available in business rules. */
declare const current: GlideRecord;
/** Previous values (before the change). Available in business rules. */
declare const previous: GlideRecord;
