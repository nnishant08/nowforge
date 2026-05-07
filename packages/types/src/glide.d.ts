/**
 * ServiceNow server-side global type definitions.
 * Covers the most commonly used Glide classes and globals.
 */

declare class GlideRecord {
  /** Table name this GlideRecord queries. */
  readonly sys_class_name: GlideElement;

  constructor(tableName: string);

  /** Add an encoded query string. */
  addEncodedQuery(query: string): void;
  /** Add a query condition. Returns GlideQueryCondition for chaining. */
  addQuery(field: string, value: string): GlideQueryCondition;
  addQuery(field: string, operator: string, value: string): GlideQueryCondition;
  /** Order results ascending. */
  orderBy(field: string): void;
  /** Order results descending. */
  orderByDesc(field: string): void;
  /** Set max rows returned. */
  setLimit(limit: number): void;
  /** Execute the query. */
  query(): void;
  /** Advance to the next record. Returns false when exhausted. */
  next(): boolean;
  /** Total matching rows (call after query). */
  getRowCount(): number;
  /** Whether query returned any rows. */
  hasNext(): boolean;

  /** Get a field value as a string. */
  getValue(field: string): string;
  /** Set a field value. */
  setValue(field: string, value: string | number | boolean): void;
  /** Get the display value of a field. */
  getDisplayValue(field: string): string;
  /** Get sys_id of current record. */
  getUniqueValue(): string;
  /** Get table name. */
  getTableName(): string;
  /** Get the record display value. */
  getLabel(): string;

  /** Insert the record and return the new sys_id. */
  insert(): string;
  /** Update the current record. */
  update(reason?: string): string;
  /** Delete the current record. */
  deleteRecord(): boolean;
  /** Initialize a new record (sets defaults). */
  initialize(): void;
  /** Returns true if field is changed. */
  isValidField(field: string): boolean;
  /** Whether the current record is a new (unsaved) record. */
  isNewRecord(): boolean;
  /** Whether the query returned a valid record. */
  isValidRecord(): boolean;

  /** Get a GlideElement for a field. */
  getElement(field: string): GlideElement;

  [field: string]: unknown;
}

declare class GlideQueryCondition {
  addCondition(field: string, value: string): GlideQueryCondition;
  addCondition(field: string, operator: string, value: string): GlideQueryCondition;
  addOrCondition(field: string, value: string): GlideQueryCondition;
  addOrCondition(field: string, operator: string, value: string): GlideQueryCondition;
}

declare class GlideElement {
  /** Get the value as a string. */
  getValue(): string;
  /** Get the display value. */
  getDisplayValue(): string;
  /** Get the element name (field name). */
  getName(): string;
  /** Get the table name this element belongs to. */
  getTableName(): string;
  /** Get the element type (string, integer, reference, etc.). */
  getED(): GlideElementDescriptor;
  /** Whether the value has changed. */
  changes(): boolean;
  /** Get the previous value before changes. */
  changesFrom(value: string): boolean;
  /** Whether the value is changing to this value. */
  changesTo(value: string): boolean;
  /** Whether the element has a value. */
  nil(): boolean;
  /** Get the referenced GlideRecord (for reference fields). */
  getRefRecord(): GlideRecord;
  /** Set the value. */
  setValue(value: string | number | boolean): void;
  /** String representation. */
  toString(): string;
}

declare class GlideElementDescriptor {
  getInternalType(): string;
  getLabel(): string;
  getName(): string;
  getPlural(): string;
}

declare class GlideAggregate {
  constructor(tableName: string);
  addAggregate(aggregate: 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG', field?: string): void;
  addEncodedQuery(query: string): void;
  addQuery(field: string, value: string): GlideQueryCondition;
  addQuery(field: string, operator: string, value: string): GlideQueryCondition;
  groupBy(field: string): void;
  orderByAggregate(aggregate: 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG', field?: string): void;
  query(): void;
  next(): boolean;
  getAggregate(aggregate: 'COUNT' | 'SUM' | 'MIN' | 'MAX' | 'AVG', field?: string): string;
  getValue(field: string): string;
  getDisplayValue(field: string): string;
}

declare class GlideDateTime {
  constructor(value?: string);
  /** Get the value in internal format (yyyy-MM-dd HH:mm:ss). */
  getValue(): string;
  /** Get display value in user's timezone. */
  getDisplayValue(): string;
  /** Get the date portion as string. */
  getDate(): GlideDate;
  /** Add days to the date. */
  addDaysLocalTime(days: number): void;
  /** Add seconds. */
  addSeconds(seconds: number): void;
  /** Get difference in seconds between two GlideDateTime objects. */
  subtract(other: GlideDateTime): GlideDuration;
  /** Whether this date is before another. */
  before(other: GlideDateTime): boolean;
  /** Whether this date is after another. */
  after(other: GlideDateTime): boolean;
  /** Set from a display value string. */
  setDisplayValue(value: string): void;
  /** Set from an internal value string. */
  setValue(value: string): void;
  /** Get Unix timestamp in milliseconds. */
  getNumericValue(): number;
}

declare class GlideDate {
  constructor(value?: string);
  getValue(): string;
  getDisplayValue(): string;
  setValue(value: string): void;
}

declare class GlideDuration {
  constructor(milliseconds?: number);
  getValue(): string;
  getDisplayValue(): string;
  getDurationSeconds(): number;
}

declare class GlideFilter {
  /** Evaluate a filter against a GlideRecord. */
  static checkRecord(gr: GlideRecord, encodedQuery: string): boolean;
}

/** The GlideSystem global object. Available as `gs` in server-side scripts. */
declare const gs: GlideSystem;

declare class GlideSystem {
  /** Log an info-level message. */
  info(message: string, ...params: unknown[]): void;
  /** Log a warning-level message. */
  warn(message: string, ...params: unknown[]): void;
  /** Log an error-level message. */
  error(message: string, ...params: unknown[]): void;
  /** Log a debug-level message. */
  debug(message: string, ...params: unknown[]): void;
  /** Add a message to the current session. */
  addInfoMessage(message: string): void;
  addErrorMessage(message: string): void;

  /** Get the current user's sys_id. */
  getUserID(): string;
  /** Get the current user's login name. */
  getUserName(): string;
  /** Get a display name for the current user. */
  getUserDisplayName(): string;
  /** Whether the current user has a given role. */
  hasRole(role: string): boolean;

  /** Get a system property value. */
  getProperty(key: string, defaultValue?: string): string;
  /** Set a system property value. */
  setProperty(key: string, value: string, description: string): void;

  /** Get the current date/time as a GlideDateTime. */
  now(): string;
  /** Get the current date in UTC. */
  nowDateTime(): string;

  /** Begin a GlideTransaction. */
  beginTransaction(): void;
  /** Commit current transaction. */
  commitTransaction(): void;
  /** Rollback current transaction. */
  rollbackTransaction(): void;

  /** Get the instance URL base (e.g. https://myinstance.service-now.com). */
  getUrlOnStack(): string;
}
