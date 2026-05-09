import type { ToolDef } from './core.js';
import { getClient, logAndRun, textResult, errorResult, type ConfirmableArgs } from './safety.js';

export const ADMIN_TOOLS: Record<string, ToolDef> = {
  list_users: {
    schema: {
      name: 'list_users',
      description: 'List sys_user records matching a query.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number' } },
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_user', {
          query: String(args.query ?? ''),
          fields: ['user_name', 'name', 'email', 'active', 'sys_id'],
          limit: Math.min(500, Math.max(1, Number(args.limit ?? 50))),
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  get_user_roles: {
    schema: {
      name: 'get_user_roles',
      description: 'Get the roles assigned to a user (by sys_id or user_name).',
      inputSchema: {
        type: 'object',
        properties: { user: { type: 'string' } },
        required: ['user'],
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const userArg = String(args.user);
        const isSysId = /^[a-f0-9]{32}$/i.test(userArg);
        const rows = await client.getRecords('sys_user_has_role', {
          query: isSysId ? `user=${userArg}` : `user.user_name=${userArg}`,
          fields: ['role.name', 'inherited', 'inherited_from'],
          limit: 200,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  list_properties: {
    schema: {
      name: 'list_properties',
      description: 'List system properties.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_properties', {
          query: String(args.query ?? ''),
          fields: ['name', 'value', 'description', 'sys_id'],
          limit: 200,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  set_property: {
    schema: {
      name: 'set_property',
      description: 'Set a system property value. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: ['name', 'value'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'set_property',
      args: args as ConfirmableArgs,
      description: `set system property "${String(args.name)}" = "${String(args.value)}"`,
      run: async () => {
        const { client } = await getClient();
        const found = await client.getRecords('sys_properties', {
          query: `name=${String(args.name)}`, fields: ['sys_id'], limit: 1,
        }) as unknown as Array<{ sys_id: string }>;
        if (found[0]) {
          return client.updateRecord('sys_properties', found[0].sys_id, { value: args.value });
        }
        return client.createRecord('sys_properties', { name: args.name, value: args.value });
      },
    }),
  },

  list_scheduled_jobs: {
    schema: {
      name: 'list_scheduled_jobs',
      description: 'List scheduled jobs (sys_trigger).',
      inputSchema: {
        type: 'object',
        properties: { active_only: { type: 'boolean' } },
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const q = args.active_only ? 'active=true' : '';
        const rows = await client.getRecords('sys_trigger', {
          query: q,
          fields: ['name', 'next_action', 'state', 'trigger_type', 'sys_id'],
          limit: 200,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  get_system_logs: {
    schema: {
      name: 'get_system_logs',
      description: 'Read recent syslog entries.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Encoded query, e.g. levelIN1,2' },
          limit: { type: 'number' },
        },
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('syslog', {
          query: `${String(args.query ?? '')}^ORDERBYDESCsys_created_on`,
          fields: ['level', 'source', 'message', 'sys_created_on'],
          limit: Math.min(500, Math.max(1, Number(args.limit ?? 100))),
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },
};
