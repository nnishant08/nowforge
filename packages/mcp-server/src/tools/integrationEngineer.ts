import type { ToolDef } from './core.js';
import { getClient, logAndRun, textResult, errorResult, type ConfirmableArgs } from './safety.js';

export const INTEGRATION_TOOLS: Record<string, ToolDef> = {
  list_rest_messages: {
    schema: {
      name: 'list_rest_messages',
      description: 'List sys_rest_message records.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_rest_message', {
          query: String(args.query ?? ''),
          fields: ['name', 'rest_endpoint', 'sys_id'], limit: 100,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  list_transform_maps: {
    schema: {
      name: 'list_transform_maps',
      description: 'List sys_transform_map records.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_transform_map', {
          query: String(args.query ?? ''),
          fields: ['name', 'source_table', 'target_table', 'sys_id'], limit: 100,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  list_import_sets: {
    schema: {
      name: 'list_import_sets',
      description: 'List recent import sets.',
      inputSchema: { type: 'object', properties: { table: { type: 'string' } } },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const q = args.table ? `table_name=${String(args.table)}` : '';
        const rows = await client.getRecords('sys_import_set', {
          query: `${q}^ORDERBYDESCsys_created_on`,
          fields: ['number', 'state', 'mode', 'table_name', 'sys_created_on'], limit: 50,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  create_scripted_rest_resource: {
    schema: {
      name: 'create_scripted_rest_resource',
      description: 'Create a Scripted REST resource. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          api_name: { type: 'string', description: 'e.g. "x_my_app/v1"' },
          name: { type: 'string' },
          http_method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
          script: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: ['api_name', 'name', 'http_method', 'script'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'create_scripted_rest_resource',
      args: args as ConfirmableArgs,
      description: `create Scripted REST ${String(args.http_method)} resource "${String(args.name)}"`,
      run: async () => {
        const { client } = await getClient();
        return client.createRecord('sys_ws_operation', {
          name: args.name,
          http_method: args.http_method,
          operation_script: args.script,
        });
      },
    }),
  },

  get_integration_errors: {
    schema: {
      name: 'get_integration_errors',
      description: 'Recent integration-related errors from syslog.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const limit = Math.min(200, Math.max(1, Number(args.limit ?? 50)));
        const rows = await client.getRecords('syslog', {
          query: 'level=2^messageLIKErest^ORORDERBYDESCsys_created_on',
          fields: ['source', 'message', 'sys_created_on'], limit,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },
};
