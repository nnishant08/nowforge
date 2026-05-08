/** Resolved metadata for a single field, after dictionary lookup. */
export interface FieldMetadata {
  sysId: string;
  /** Internal column name, e.g. "assigned_to". */
  element: string;
  /** Human-readable label, e.g. "Assigned to". */
  columnLabel: string;
  /** Internal type token, e.g. "reference", "string", "integer", "glide_date_time". */
  internalType: string;
  /** Pretty-printed type for the UI, e.g. "Reference → sys_user", "String", "Date/Time". */
  prettyType: string;
  maxLength: string;
  mandatory: boolean;
  readOnly: boolean;
  /** For reference fields: the target table's name (e.g. "sys_user"). */
  referenceTable: string | null;
}

/** Result of pointing at a label and resolving (table, field). */
export interface FieldRef {
  table: string;
  field: string;
}
