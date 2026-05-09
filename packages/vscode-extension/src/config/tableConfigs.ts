/**
 * Per-table sync configuration. Each entry tells us:
 *   - the script field on the table
 *   - the folder name to use under {scope}/
 *   - the file extension (most are .script.js; widgets use multiple files)
 *   - additional fields to fetch (for widgets: client, body, css, etc.)
 *
 * To add a new syncable table, add an entry here. The rest of the system
 * reads from this config — no other file needs to change.
 */

export interface TableConfig {
  table: string;
  /** Display name shown in the explorer. */
  label: string;
  /** Subfolder inside {scope}/. */
  folder: string;
  /**
   * Field map: local-file-name → server field.
   * Most tables use a single entry: { 'script': 'script' }.
   * Widgets have several files mapped to columns (server, client, template, etc).
   */
  files: Array<{
    /** Local filename relative to the record's folder, e.g. "script.js" or "client.js". */
    filename: string;
    /** Field name on the SN record (e.g. "script", "client_script", "template"). */
    field: string;
    /** Useful for the metadata comment + push payloads. */
    isPrimary?: boolean;
  }>;
  /** True if we create a folder per record (e.g. widgets); false = single file. */
  multiFile?: boolean;
}

export const TABLE_CONFIGS: Record<string, TableConfig> = {
  sys_script: {
    table: 'sys_script',
    label: 'Business Rules',
    folder: 'Business Rules',
    files: [{ filename: 'script.js', field: 'script', isPrimary: true }],
  },
  sys_script_client: {
    table: 'sys_script_client',
    label: 'Client Scripts',
    folder: 'Client Scripts',
    files: [{ filename: 'script.js', field: 'script', isPrimary: true }],
  },
  sys_script_include: {
    table: 'sys_script_include',
    label: 'Script Includes',
    folder: 'Script Includes',
    files: [{ filename: 'script.js', field: 'script', isPrimary: true }],
  },
  sys_ui_script: {
    table: 'sys_ui_script',
    label: 'UI Scripts',
    folder: 'UI Scripts',
    files: [{ filename: 'script.js', field: 'script', isPrimary: true }],
  },
  sys_ui_action: {
    table: 'sys_ui_action',
    label: 'UI Actions',
    folder: 'UI Actions',
    files: [{ filename: 'script.js', field: 'script', isPrimary: true }],
  },
  sys_script_fix: {
    table: 'sys_script_fix',
    label: 'Fix Scripts',
    folder: 'Fix Scripts',
    files: [{ filename: 'script.js', field: 'script', isPrimary: true }],
  },
  sp_widget: {
    table: 'sp_widget',
    label: 'Widgets',
    folder: 'Widgets',
    multiFile: true,
    files: [
      { filename: 'server.js',     field: 'script',          isPrimary: true },
      { filename: 'client.js',     field: 'client_script' },
      { filename: 'link.js',       field: 'link' },
      { filename: 'template.html', field: 'template' },
      { filename: 'style.scss',    field: 'css' },
    ],
  },
  sys_ws_operation: {
    table: 'sys_ws_operation',
    label: 'Scripted REST',
    folder: 'Scripted REST',
    files: [{ filename: 'script.js', field: 'operation_script', isPrimary: true }],
  },
};

/** Build a complete list of fields to request for a single record fetch. */
export function fieldsForTable(cfg: TableConfig): string[] {
  const fields = new Set([
    'sys_id',
    'name',
    'sys_name',
    'sys_updated_on',
    'sys_scope',
    'sys_scope.name',
    'sys_scope.scope',
  ]);
  for (const f of cfg.files) fields.add(f.field);
  return Array.from(fields);
}

/** Sanitise a record name for use as a filename. */
export function sanitiseName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'unnamed';
}
