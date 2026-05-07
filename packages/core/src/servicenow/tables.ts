export const SERVICENOW_TABLES = {
  sys_script: 'Business Rule',
  sys_script_client: 'Client Script',
  sys_script_include: 'Script Include',
  sys_ui_script: 'UI Script',
  sys_ui_action: 'UI Action',
  sys_ui_policy: 'UI Policy',
  sp_widget: 'Widget',
  sys_ws_operation: 'Scripted REST Resource',
  sys_properties: 'System Property',
  sysauto_script: 'Scheduled Job',
  sys_update_xml: 'Update Set Change',
  sys_update_set: 'Update Set',
  incident: 'Incident',
  change_request: 'Change Request',
  problem: 'Problem',
  sc_request: 'Service Catalog Request',
  sc_req_item: 'Requested Item',
  sc_task: 'Catalog Task',
  task: 'Task',
  sys_user: 'User',
  sys_user_group: 'Group',
  cmdb_ci: 'Configuration Item',
  kb_knowledge: 'Knowledge Article',
  sys_app: 'Application',
  sys_scope: 'Application Scope',
  sys_dictionary: 'Dictionary Entry',
  sys_choice: 'Choice',
  sys_db_object: 'Table',
} as const;

export type ServiceNowTableName = keyof typeof SERVICENOW_TABLES;

/** Get the display name for a table, or the table name itself if unknown. */
export function getTableDisplayName(tableName: string): string {
  return (SERVICENOW_TABLES as Record<string, string>)[tableName] ?? tableName;
}

/** Check if a string is a known ServiceNow table name. */
export function isKnownTable(tableName: string): tableName is ServiceNowTableName {
  return tableName in SERVICENOW_TABLES;
}
