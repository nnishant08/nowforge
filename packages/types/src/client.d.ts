/**
 * ServiceNow client-side type declarations. Available in Client Scripts,
 * UI Policies, and any browser-side code injected by SN.
 *
 * Modern JavaScript (ES2015+) is fine on the client side.
 */

// ── g_form ───────────────────────────────────────────────────────────────────

declare const g_form: GlideForm;

declare class GlideForm {
  /** Get the value of a field. Returns the underlying value, not the display value. */
  getValue(fieldName: string): string;
  /** Set the value of a field. Triggers onChange handlers. */
  setValue(fieldName: string, value: string, displayValue?: string): void;
  /** Get the display value (for references, returns the referenced record's label). */
  getDisplayValue(fieldName: string): string;
  /** Get a value of a reference field. */
  getReference(fieldName: string, callback: (gr: GlideRecord) => void): void;

  // Visibility / behaviour
  setVisible(fieldName: string, visible: boolean): void;
  setReadOnly(fieldName: string, readOnly: boolean): void;
  setMandatory(fieldName: string, mandatory: boolean): void;
  setSectionDisplay(sectionName: string, display: boolean): void;

  // Form metadata
  getUniqueValue(): string;
  getTableName(): string;
  getFieldNames(): string[];
  getLabelOf(fieldName: string): string;

  // Decorations / messages
  addDecoration(fieldName: string, icon: string, title?: string): void;
  removeDecoration(fieldName: string, icon: string, title?: string): void;
  flash(fieldName: string, color: string, count: number): void;
  addInfoMessage(message: string): void;
  addErrorMessage(message: string): void;
  clearMessages(): void;

  // Persistence
  save(): void;
  submit(verb?: string): void;

  // Choice fields
  addOption(fieldName: string, value: string, label: string, index?: number): void;
  removeOption(fieldName: string, value: string): void;
  clearOptions(fieldName: string): void;
  clearValue(fieldName: string): void;

  // Change tracking
  isModified(): boolean;
  isNewRecord(): boolean;
}

// ── g_list ───────────────────────────────────────────────────────────────────

declare const g_list: GlideList;

declare class GlideList {
  getTableName(): string;
  getQuery(urlFormat?: boolean): string;
  refresh(): void;
  refreshWithNewQuery(query?: string): void;
  getTitle(): string;
  setOrderBy(field: string): void;
}

// ── g_user ───────────────────────────────────────────────────────────────────

declare const g_user: GlideUserClient;

declare class GlideUserClient {
  readonly userID: string;
  readonly userName: string;
  readonly fullName: string;
  readonly firstName: string;
  readonly lastName: string;
  hasRole(role: string): boolean;
  hasRoleExactly(role: string): boolean;
  hasRoleFromList(roles: string): boolean;
  isMemberOf(group: string): boolean;
}

// ── g_navigation ─────────────────────────────────────────────────────────────

declare const g_navigation: GlideNavigation;

declare class GlideNavigation {
  open(url: string): void;
  openRecord(table: string, sysId: string): void;
  reload(): void;
}

// ── GlideAjax ────────────────────────────────────────────────────────────────

/**
 * Client-to-server bridge. The server-side counterpart is a Script Include
 * that extends `AbstractAjaxProcessor`.
 *
 * @example
 *   var ga = new GlideAjax('MyScriptInclude');
 *   ga.addParam('sysparm_name', 'doSomething');
 *   ga.addParam('sysparm_user', 'abel.tuter');
 *   ga.getXMLAnswer(function (answer) {
 *     g_form.addInfoMessage(answer);
 *   });
 */
declare class GlideAjax {
  constructor(scriptIncludeName: string);
  addParam(name: string, value: string): void;
  /**
   * Async — preferred. Receives the `answer` element value as a string.
   */
  getXMLAnswer(callback: (answer: string) => void): void;
  /** Async — receives the full XML response document. */
  getXML(callback: (response: XMLDocument) => void): void;
  /** @deprecated Synchronous — blocks the UI thread. Use getXMLAnswer instead. */
  getXMLWait(): void;
  getAnswer(): string;
}

// ── GlideRecord (CLIENT — different from server!) ───────────────────────────

/**
 * **Client-side** GlideRecord. Has limited capabilities and is mostly used
 * for simple lookups. **Avoid** in client scripts — prefer GlideAjax to a
 * server-side Script Include for performance and security.
 */
declare class GlideRecordClient {
  constructor(tableName: string);
  addQuery(field: string, value: unknown): unknown;
  query(callback?: (gr: GlideRecordClient) => void): void;
  next(): boolean;
  getValue(field: string): string;
  getDisplayValue(field: string): string;
}

// ── Service Portal globals ──────────────────────────────────────────────────

/** Service Portal client-side utilities. Available in widget client scripts. */
declare const spUtil: {
  addInfoMessage(message: string): void;
  addErrorMessage(message: string): void;
  refresh(): void;
  recordWatch(scope: unknown, table: string, filter: string, callback: () => void): unknown;
  update(scope: unknown): Promise<unknown>;
  get(name: string, options?: Record<string, unknown>): Promise<unknown>;
};

declare const $sp: {
  log: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
};

// ── Modals / Dialogs ─────────────────────────────────────────────────────────

declare class GlideDialogWindow {
  constructor(id: string, readOnly?: boolean, width?: number, height?: number);
  render(): void;
  setTitle(title: string): void;
  setPreference(name: string, value: string): void;
  destroy(): void;
}

declare class GlideModal {
  constructor(id: string, readOnly?: boolean, width?: number);
  render(): void;
  renderWithContent(content: HTMLElement): void;
  setTitle(title: string): void;
  setPreference(name: string, value: string): void;
  setBody(body: HTMLElement): void;
  destroy(): void;
}
