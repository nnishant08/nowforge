import { getClient } from '../tools/safety.js';

/**
 * Read-only resources the AI client can dereference. Each function
 * returns a JSON-serialisable object that the MCP server wraps in a
 * resource response.
 */

export async function tablesResource(): Promise<unknown> {
  const { client } = await getClient();
  return client.getRecords('sys_db_object', {
    fields: ['name', 'label', 'super_class.name'],
    limit: 1000,
  });
}

export async function tableSchemaResource(table: string): Promise<unknown> {
  const { client } = await getClient();
  return client.getRecords('sys_dictionary', {
    query: `name=${table}^ORDERBYelement`,
    fields: ['element', 'column_label', 'internal_type', 'reference', 'mandatory'],
    limit: 500,
  });
}

export async function scopesResource(): Promise<unknown> {
  const { client } = await getClient();
  return client.getRecords('sys_app', {
    fields: ['name', 'scope', 'version', 'sys_id'],
    limit: 200,
  });
}

export async function updateSetsResource(): Promise<unknown> {
  const { client } = await getClient();
  return client.getRecords('sys_update_set', {
    query: 'state=in progress^ORDERBYDESCsys_updated_on',
    fields: ['name', 'sys_id', 'state'],
    limit: 50,
  });
}

export async function currentContextResource(): Promise<unknown> {
  const { creds, client } = await getClient();
  const versionRow = await client.getRecords('sys_properties', {
    query: 'name=instance_name', fields: ['value'], limit: 1,
  });
  return {
    instanceUrl: creds.url,
    user: creds.username,
    environment: creds.environment ?? 'unknown',
    instanceName: (versionRow[0] as { value?: string } | undefined)?.value ?? null,
  };
}
