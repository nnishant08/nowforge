import type { ToolDef } from './core.js';
import { getClient, logAndRun, textResult, errorResult, type ConfirmableArgs } from './safety.js';

/**
 * Platform Developer persona — adds business-rule / client-script / script-include
 * scaffolding, ATF runners, table introspection, and table-scoped script listings.
 */

export const PLATFORM_DEV_TOOLS: Record<string, ToolDef> = {
  create_business_rule: {
    schema: {
      name: 'create_business_rule',
      description: 'Create a new Business Rule. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          name: { type: 'string' },
          when: { type: 'string', enum: ['before', 'after', 'async', 'display'] },
          script: { type: 'string' },
          active: { type: 'boolean' },
          confirm: { type: 'boolean' },
        },
        required: ['table', 'name', 'when', 'script'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'create_business_rule',
      args: args as ConfirmableArgs,
      description: `create Business Rule "${String(args.name)}" on ${String(args.table)} (${String(args.when)})`,
      run: async () => {
        const { client } = await getClient();
        return client.createRecord('sys_script', {
          collection: args.table,
          name: args.name,
          when: args.when,
          script: args.script,
          active: args.active ?? true,
        });
      },
    }),
  },

  create_client_script: {
    schema: {
      name: 'create_client_script',
      description: 'Create a new Client Script. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['onLoad', 'onChange', 'onSubmit', 'onCellEdit'] },
          script: { type: 'string' },
          field_name: { type: 'string', description: 'Required for onChange/onCellEdit.' },
          confirm: { type: 'boolean' },
        },
        required: ['table', 'name', 'type', 'script'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'create_client_script',
      args: args as ConfirmableArgs,
      description: `create Client Script "${String(args.name)}" on ${String(args.table)} (${String(args.type)})`,
      run: async () => {
        const { client } = await getClient();
        return client.createRecord('sys_script_client', {
          table: args.table,
          name: args.name,
          type: args.type,
          script: args.script,
          field_name: args.field_name ?? '',
          active: true,
        });
      },
    }),
  },

  create_script_include: {
    schema: {
      name: 'create_script_include',
      description: 'Create a new Script Include. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          script: { type: 'string' },
          client_callable: { type: 'boolean' },
          confirm: { type: 'boolean' },
        },
        required: ['name', 'script'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'create_script_include',
      args: args as ConfirmableArgs,
      description: `create Script Include "${String(args.name)}"`,
      run: async () => {
        const { client } = await getClient();
        return client.createRecord('sys_script_include', {
          name: args.name,
          api_name: `global.${String(args.name)}`,
          script: args.script,
          client_callable: args.client_callable ?? false,
          active: true,
        });
      },
    }),
  },

  get_table_schema: {
    schema: {
      name: 'get_table_schema',
      description: 'Get the field definitions of a table.',
      inputSchema: {
        type: 'object',
        properties: { table: { type: 'string' } },
        required: ['table'],
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_dictionary', {
          query: `name=${String(args.table)}^ORDERBYelement`,
          fields: ['element', 'column_label', 'internal_type', 'max_length', 'mandatory', 'reference'],
          limit: 500,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  get_dictionary: {
    schema: {
      name: 'get_dictionary',
      description: 'Alias for get_table_schema.',
      inputSchema: { type: 'object', properties: { table: { type: 'string' } }, required: ['table'] },
    },
    handler: async (args) => PLATFORM_DEV_TOOLS.get_table_schema.handler(args),
  },

  get_table_hierarchy: {
    schema: {
      name: 'get_table_hierarchy',
      description: 'Walk parent / child table relationships.',
      inputSchema: {
        type: 'object',
        properties: { table: { type: 'string' } },
        required: ['table'],
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const me = await client.getRecords('sys_db_object', {
          query: `name=${String(args.table)}`, fields: ['name', 'label', 'super_class'], limit: 1,
        }) as unknown as Array<{ name: string; label: string; super_class?: { value?: string; display_value?: string } | string }>;
        const children = await client.getRecords('sys_db_object', {
          query: `super_class.name=${String(args.table)}`, fields: ['name', 'label'], limit: 200,
        });
        return textResult(`Self:\n${JSON.stringify(me, null, 2)}\n\nDirect children:\n${JSON.stringify(children, null, 2)}`);
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  list_scripts_on_table: {
    schema: {
      name: 'list_scripts_on_table',
      description: 'List business rules, client scripts, UI policies, UI actions on a given table.',
      inputSchema: {
        type: 'object',
        properties: { table: { type: 'string' } },
        required: ['table'],
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const t = String(args.table);
        const [brs, cs, up, ua] = await Promise.all([
          client.getRecords('sys_script',         { query: `collection=${t}`, fields: ['name', 'when', 'sys_id'], limit: 100 }),
          client.getRecords('sys_script_client',  { query: `table=${t}`,      fields: ['name', 'type', 'sys_id'], limit: 100 }),
          client.getRecords('sys_ui_policy',      { query: `table=${t}`,      fields: ['short_description', 'sys_id'], limit: 100 }),
          client.getRecords('sys_ui_action',      { query: `table=${t}`,      fields: ['name', 'sys_id'], limit: 100 }),
        ]);
        return textResult(JSON.stringify({ business_rules: brs, client_scripts: cs, ui_policies: up, ui_actions: ua }, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  get_acls_for_table: {
    schema: {
      name: 'get_acls_for_table',
      description: 'List ACL rules for a given table.',
      inputSchema: {
        type: 'object',
        properties: { table: { type: 'string' } },
        required: ['table'],
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_security_acl', {
          query: `name=${String(args.table)}`,
          fields: ['name', 'operation', 'roles', 'condition', 'script', 'active'],
          limit: 200,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) { return errorResult((e as Error).message); }
    },
  },

  run_atf_test: {
    schema: {
      name: 'run_atf_test',
      description: 'Run a single ATF test. Returns the runner record.',
      inputSchema: {
        type: 'object',
        properties: { test_sys_id: { type: 'string' }, confirm: { type: 'boolean' } },
        required: ['test_sys_id'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'run_atf_test',
      args: args as ConfirmableArgs,
      description: `run ATF test ${String(args.test_sys_id)}`,
      run: async () => {
        const { client } = await getClient();
        return client.createRecord('sys_atf_test_runner', { test: args.test_sys_id });
      },
    }),
  },

  create_fix_script: {
    schema: {
      name: 'create_fix_script',
      description: 'Create a Fix Script. If `run: true`, also kicks it off. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          script: { type: 'string' },
          run: { type: 'boolean' },
          confirm: { type: 'boolean' },
        },
        required: ['name', 'script'],
      },
    },
    handler: (args) => logAndRun({
      toolName: 'create_fix_script',
      args: args as ConfirmableArgs,
      description: `create${args.run ? ' + run' : ''} Fix Script "${String(args.name)}"`,
      run: async () => {
        const { client } = await getClient();
        const created = await client.createRecord('sys_script_fix', {
          name: args.name, script: args.script, active: true,
        });
        return { created, ranImmediately: !!args.run };
      },
    }),
  },
};
