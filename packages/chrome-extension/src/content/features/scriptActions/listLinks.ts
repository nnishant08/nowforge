/**
 * "Show all scripts on this table" → table-aware URL builder. The mapping
 * key is the SN page's table (the form we're currently editing); each entry
 * decides which list to navigate to and how to filter it.
 */

interface ListSpec {
  /** Path relative to the instance base URL. Function form gets the target table. */
  build: (table: string | null) => string;
  /** Whether the action is meaningful when no table can be detected. */
  needsTable: boolean;
}

export const SCRIPT_LIST_BUILDERS: Record<string, ListSpec> = {
  sys_script: {
    needsTable: true,
    build: (t) => `/sys_script_list.do?sysparm_query=collection=${encodeURIComponent(t ?? '')}`,
  },
  sys_script_client: {
    needsTable: true,
    build: (t) => `/sys_script_client_list.do?sysparm_query=table=${encodeURIComponent(t ?? '')}`,
  },
  sys_ui_action: {
    needsTable: true,
    build: (t) => `/sys_ui_action_list.do?sysparm_query=table=${encodeURIComponent(t ?? '')}`,
  },
  sys_ui_policy: {
    needsTable: true,
    build: (t) => `/sys_ui_policy_list.do?sysparm_query=table=${encodeURIComponent(t ?? '')}`,
  },
  sys_script_include: { needsTable: false, build: () => `/sys_script_include_list.do` },
  sys_script_fix:     { needsTable: false, build: () => `/sys_script_fix_list.do` },
  sysauto_script:     { needsTable: false, build: () => `/sysauto_script_list.do` },
  sp_widget:          { needsTable: false, build: () => `/sp_widget_list.do` },
  sys_ws_operation:   { needsTable: false, build: () => `/sys_ws_operation_list.do` },
  sys_ui_script:      { needsTable: false, build: () => `/sys_ui_script_list.do` },
};

export function buildScriptListUrl(
  pageTable: string,
  formTable: string | null
): string | null {
  const spec = SCRIPT_LIST_BUILDERS[pageTable];
  if (!spec) return null;
  if (spec.needsTable && !formTable) return null;
  return spec.build(formTable);
}
