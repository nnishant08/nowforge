/**
 * ServiceNow client-side global type definitions.
 * Available in Client Scripts and UI Policies.
 */

/** The current form object. Available in Client Scripts as `g_form`. */
declare const g_form: GlideForm;

declare class GlideForm {
  /** Get the value of a field. */
  getValue(fieldName: string): string;
  /** Set the value of a field. */
  setValue(fieldName: string, value: string, displayValue?: string): void;
  /** Get the display value of a field. */
  getDisplayValue(fieldName: string): string;

  /** Show a field. */
  setVisible(fieldName: string, visible: boolean): void;
  /** Make a field read-only or editable. */
  setReadOnly(fieldName: string, readOnly: boolean): void;
  /** Make a field mandatory or optional. */
  setMandatory(fieldName: string, mandatory: boolean): void;

  /** Get the sys_id of the current record. */
  getUniqueValue(): string;
  /** Get the table name of the current form. */
  getTableName(): string;

  /** Add a decoration (icon) to a field label. */
  addDecoration(fieldName: string, icon: string, title?: string): void;
  /** Remove a decoration from a field label. */
  removeDecoration(fieldName: string, icon: string, title?: string): void;

  /** Flash a field a color briefly to draw attention. */
  flash(fieldName: string, color: string, count: number): void;

  /** Show an info message in the form header. */
  addInfoMessage(message: string): void;
  /** Show an error message in the form header. */
  addErrorMessage(message: string): void;
  /** Clear all messages from the form header. */
  clearMessages(): void;

  /** Get a reference value (sys_id) from a reference field. */
  getReference(fieldName: string, callback: (ref: GlideRecord) => void): void;

  /** Save the current form (equivalent to clicking Save). */
  save(): void;
  /** Submit the current form. */
  submit(): void;

  /** Enable/disable a section. */
  setSectionDisplay(sectionName: string, display: boolean): void;

  /** Add an option to a choice field. */
  addOption(fieldName: string, choiceValue: string, choiceLabel: string, choiceIndex?: number): void;
  /** Remove an option from a choice field. */
  removeOption(fieldName: string, choiceValue: string): void;
  /** Clear all options from a choice field. */
  clearOptions(fieldName: string): void;
}

/** The current list object. Available in List v2/v3 Client Scripts. */
declare const g_list: GlideList;

declare class GlideList {
  /** Get the table name. */
  getTableName(): string;
  /** Get the current query. */
  getQuery(urlFormat?: boolean): string;
  /** Refresh the list. */
  refresh(): void;
  /** Refresh the list with a new query. */
  refreshWithNewQuery(query?: string): void;
  /** Get list title. */
  getTitle(): string;
}

/** The current user object. Available globally in client scripts. */
declare const g_user: GlideUser;

declare class GlideUser {
  /** The current user's sys_id. */
  readonly userID: string;
  /** The current user's login name. */
  readonly userName: string;
  /** The current user's display name. */
  readonly fullName: string;
  /** Whether the current user has a role. */
  hasRole(role: string): boolean;
  /** Whether the current user has any of the given roles. */
  hasRoleExactly(role: string): boolean;
  /** Whether the user is in a given group. */
  isMemberOf(group: string): boolean;
}

declare class GlideAjax {
  constructor(processorName: string);
  /** Add a parameter to the AJAX request. */
  addParam(name: string, value: string): void;
  /** Execute the AJAX call. */
  getXML(callback: (response: XMLDocument) => void): void;
  /** Execute and return answer synchronously (deprecated, avoid). */
  getXMLWait(): void;
  /** Get the answer element value from the response XML. */
  getAnswer(): string;
}

declare class GlideDialogWindow {
  constructor(id: string, readOnly?: boolean, width?: number, height?: number);
  /** Render the dialog. */
  render(): void;
  /** Set a field value and refresh. */
  setTitle(title: string): void;
  /** Destroy the dialog. */
  destroy(): void;
}
