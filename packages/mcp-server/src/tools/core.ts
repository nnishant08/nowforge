import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, setActiveInstance, type InstanceCreds } from '../config.js';
import { getClient, logAndRun, textResult, errorResult, type ToolResult, type ConfirmableArgs } from './safety.js';

/**
 * 15 core tools always available regardless of persona package.
 *
 * Each tool exports two things: a JSON-schema definition (registered via
 * ListToolsRequestSchema) and a handler (called via CallToolRequestSchema).
 * A small dispatcher in src/index.ts wires them together by name.
 */

export interface ToolDef {
  schema: Tool;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

const required = (s: string[]): string[] => s;

export const CORE_TOOLS: Record<string, ToolDef> = {
  // ── Instance management ─────────────────────────────────────────────────

  list_instances: {
    schema: {
      name: 'list_instances',
      description: 'List configured ServiceNow instances and which one is active.',
      inputSchema: { type: 'object', properties: {} },
    },
    handler: async () => {
      const cfg = await loadConfig();
      const lines = Object.entries(cfg.instances).map(
        ([name, c]) => `${name === cfg.activeInstance ? '★' : ' '} ${name}  ${c.url}  ${c.environment ?? ''}`
      );
      if (lines.length === 0) return textResult('No instances configured.');
      return textResult(lines.join('\n'));
    },
  },

  switch_instance: {
    schema: {
      name: 'switch_instance',
      description: 'Switch the active ServiceNow instance.',
      inputSchema: {
        type: 'object',
        properties: { instance: { type: 'string', description: 'Instance name from list_instances' } },
        required: required(['instance']),
      },
    },
    handler: async (args) => {
      try {
        await setActiveInstance(String(args.instance));
        return textResult(`Active instance is now "${String(args.instance)}".`);
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  instance_info: {
    schema: {
      name: 'instance_info',
      description: 'Get info about the current SN instance — version, current user, current scope, current update set.',
      inputSchema: { type: 'object', properties: {} },
    },
    handler: async () => {
      try {
        const { creds, client } = await getClient();
        const ver = await client.getRecords('sys_properties', {
          query: 'name=instance_name',
          fields: ['value'],
          limit: 1,
        }) as unknown as Array<{ value: { value?: string } | string }>;
        const versionRow = ver[0];
        const versionVal = typeof versionRow?.value === 'string' ? versionRow.value : (versionRow?.value as { value?: string } | undefined)?.value;
        const tag = creds.environment ?? '(untagged)';
        return textResult(
          `Instance: ${creds.url}\n` +
          `User:     ${creds.username}\n` +
          `Tag:      ${tag}\n` +
          `Name property: ${versionVal ?? '(could not read)'}`
        );
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  // ── Record CRUD ─────────────────────────────────────────────────────────

  get_record: {
    schema: {
      name: 'get_record',
      description: 'Get a single record by sys_id.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          sys_id: { type: 'string' },
          fields: { type: 'string', description: 'Comma-separated. Empty = all fields.' },
        },
        required: required(['table', 'sys_id']),
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const fieldsStr = (args.fields as string | undefined) ?? '';
        const row = await client.getRecord(String(args.table), String(args.sys_id), {
          fields: fieldsStr ? fieldsStr.split(',').map((f) => f.trim()) : undefined,
        });
        return textResult(JSON.stringify(row, null, 2));
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  query_records: {
    schema: {
      name: 'query_records',
      description: 'Query records using an encoded query string.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          query: { type: 'string', description: 'Encoded query, e.g. active=true^priority=1' },
          fields: { type: 'string', description: 'Comma-separated.' },
          limit: { type: 'number', description: 'Default 50; max 500.' },
        },
        required: required(['table', 'query']),
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const fieldsStr = (args.fields as string | undefined) ?? '';
        const limit = Math.min(500, Math.max(1, Number(args.limit ?? 50)));
        const rows = await client.getRecords(String(args.table), {
          query: String(args.query),
          fields: fieldsStr ? fieldsStr.split(',').map((f) => f.trim()) : undefined,
          limit,
        });
        return textResult(`Found ${rows.length} record(s).\n\n${JSON.stringify(rows, null, 2).slice(0, 8000)}`);
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  create_record: {
    schema: {
      name: 'create_record',
      description: 'Create a new record. Requires `confirm: true` to actually run.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          data: { type: 'object', description: 'Field/value map.' },
          confirm: { type: 'boolean' },
        },
        required: required(['table', 'data']),
      },
    },
    handler: (args) => logAndRun({
      toolName: 'create_record',
      args: args as ConfirmableArgs,
      description: `create a ${String(args.table)} record`,
      run: async () => {
        const { client } = await getClient();
        return client.createRecord(String(args.table), args.data as Record<string, unknown>);
      },
    }),
  },

  update_record: {
    schema: {
      name: 'update_record',
      description: 'Update an existing record. Requires `confirm: true` to actually run.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          sys_id: { type: 'string' },
          data: { type: 'object' },
          confirm: { type: 'boolean' },
        },
        required: required(['table', 'sys_id', 'data']),
      },
    },
    handler: (args) => logAndRun({
      toolName: 'update_record',
      args: args as ConfirmableArgs,
      description: `update ${String(args.table)}/${String(args.sys_id)}`,
      capturePrevious: async () => {
        const { client } = await getClient();
        try { return await client.getRecord(String(args.table), String(args.sys_id)); }
        catch { return null; }
      },
      run: async () => {
        const { client } = await getClient();
        return client.updateRecord(String(args.table), String(args.sys_id), args.data as Record<string, unknown>);
      },
    }),
  },

  delete_record: {
    schema: {
      name: 'delete_record',
      description: 'Delete a record. Requires `confirm: true` to actually run.',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          sys_id: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: required(['table', 'sys_id']),
      },
    },
    handler: (args) => logAndRun({
      toolName: 'delete_record',
      args: args as ConfirmableArgs,
      description: `DELETE ${String(args.table)}/${String(args.sys_id)}`,
      capturePrevious: async () => {
        const { client } = await getClient();
        try { return await client.getRecord(String(args.table), String(args.sys_id)); }
        catch { return null; }
      },
      run: async () => {
        const { client } = await getClient();
        await client.deleteRecord(String(args.table), String(args.sys_id));
        return { deleted: args.sys_id };
      },
    }),
  },

  // ── Script execution ────────────────────────────────────────────────────

  run_script: {
    schema: {
      name: 'run_script',
      description: 'Execute a background script. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          script: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: required(['script']),
      },
    },
    handler: (args) => logAndRun({
      toolName: 'run_script',
      args: args as ConfirmableArgs,
      description: 'run a background script',
      run: async () => runBackgroundScript(String(args.script)),
    }),
  },

  // ── Search ──────────────────────────────────────────────────────────────

  search_scripts: {
    schema: {
      name: 'search_scripts',
      description: 'Search for scripts containing a pattern across script tables.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Substring to look for in the script field.' },
          tables: { type: 'array', items: { type: 'string' }, description: 'Default: BR, Client Script, Script Include, UI Action.' },
        },
        required: required(['pattern']),
      },
    },
    handler: async (args) => {
      const tables = (args.tables as string[] | undefined) ?? ['sys_script', 'sys_script_client', 'sys_script_include', 'sys_ui_action'];
      const pattern = String(args.pattern);
      try {
        const { client } = await getClient();
        const results: Array<{ table: string; name: string; sys_id: string }> = [];
        for (const t of tables) {
          const rows = await client.getRecords(t, {
            query: `scriptLIKE${pattern}`,
            fields: ['sys_id', 'name'],
            limit: 50,
          }) as unknown as Array<{ sys_id: string; name: string }>;
          for (const r of rows) results.push({ table: t, name: r.name, sys_id: r.sys_id });
        }
        return textResult(`Found ${results.length} match(es):\n\n${results.map((r) => `${r.table}/${r.name}  ${r.sys_id}`).join('\n')}`);
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  search_tables: {
    schema: {
      name: 'search_tables',
      description: 'Search for SN tables by name.',
      inputSchema: {
        type: 'object',
        properties: { pattern: { type: 'string' } },
        required: required(['pattern']),
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const rows = await client.getRecords('sys_db_object', {
          query: `nameLIKE${String(args.pattern)}`,
          fields: ['name', 'label', 'sys_id'],
          limit: 100,
        }) as unknown as Array<{ name: string; label: string; sys_id: string }>;
        return textResult(rows.map((r) => `${r.name}  ${r.label}`).join('\n') || '(no matches)');
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  // ── Update sets ─────────────────────────────────────────────────────────

  get_current_update_set: {
    schema: {
      name: 'get_current_update_set',
      description: "Get the user's current update set name and recent contents.",
      inputSchema: { type: 'object', properties: {} },
    },
    handler: async () => {
      try {
        const { client } = await getClient();
        // user pref → set sys_id
        const userRow = await client.getRecords('sys_user', {
          query: `user_name=${(await getClient()).creds.username}`,
          fields: ['sys_id'], limit: 1,
        }) as unknown as Array<{ sys_id: string }>;
        const userSysId = userRow[0]?.sys_id;
        if (!userSysId) return errorResult('Could not resolve current user.');
        const pref = await client.getRecords('sys_user_preference', {
          query: `name=sys_update_set^user=${userSysId}`,
          fields: ['value'], limit: 1,
        }) as unknown as Array<{ value: string }>;
        const setSysId = pref[0]?.value;
        if (!setSysId) return textResult('No active update set preference.');
        const set = await client.getRecord('sys_update_set', setSysId, {
          fields: ['name', 'state', 'is_default', 'application'],
        });
        const changes = await client.getRecords('sys_update_xml', {
          query: `update_set=${setSysId}`,
          fields: ['name', 'type', 'target_name'], limit: 50,
        });
        return textResult(`Current update set:\n${JSON.stringify(set, null, 2)}\n\nLast 50 changes:\n${JSON.stringify(changes, null, 2)}`);
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  list_update_sets: {
    schema: {
      name: 'list_update_sets',
      description: 'List recent in-progress update sets on the active instance.',
      inputSchema: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
    handler: async (args) => {
      try {
        const { client } = await getClient();
        const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)));
        const rows = await client.getRecords('sys_update_set', {
          query: 'state=in progress^ORDERBYDESCsys_updated_on',
          fields: ['name', 'sys_id', 'state', 'application.name'],
          limit,
        });
        return textResult(JSON.stringify(rows, null, 2));
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  },

  switch_update_set: {
    schema: {
      name: 'switch_update_set',
      description: 'Switch the user\'s active update set. Requires `confirm: true`.',
      inputSchema: {
        type: 'object',
        properties: {
          name_or_id: { type: 'string' },
          confirm: { type: 'boolean' },
        },
        required: required(['name_or_id']),
      },
    },
    handler: (args) => logAndRun({
      toolName: 'switch_update_set',
      args: args as ConfirmableArgs,
      description: `switch active update set to "${String(args.name_or_id)}"`,
      run: async () => {
        const { creds, client } = await getClient();
        // Resolve name → sys_id if needed
        const target = String(args.name_or_id);
        const isSysId = /^[a-f0-9]{32}$/i.test(target);
        let setSysId = target;
        if (!isSysId) {
          const found = await client.getRecords('sys_update_set', {
            query: `name=${target}`, fields: ['sys_id'], limit: 1,
          }) as unknown as Array<{ sys_id: string }>;
          if (!found[0]) throw new Error(`No update set named "${target}".`);
          setSysId = found[0].sys_id;
        }
        // user → pref → patch/post
        const userRow = await client.getRecords('sys_user', {
          query: `user_name=${creds.username}`, fields: ['sys_id'], limit: 1,
        }) as unknown as Array<{ sys_id: string }>;
        const userSysId = userRow[0]?.sys_id;
        if (!userSysId) throw new Error('Could not resolve current user.');
        const prefs = await client.getRecords('sys_user_preference', {
          query: `name=sys_update_set^user=${userSysId}`,
          fields: ['sys_id'], limit: 1,
        }) as unknown as Array<{ sys_id: string }>;
        if (prefs[0]) {
          await client.updateRecord('sys_user_preference', prefs[0].sys_id, { value: setSysId });
          return { switched: true, setSysId };
        }
        await client.createRecord('sys_user_preference', {
          name: 'sys_update_set', user: userSysId, value: setSysId, type: 'string',
        });
        return { switched: true, setSysId };
      },
    }),
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function runBackgroundScript(script: string): Promise<{ output: string }> {
  const { creds } = await getClient();
  const auth = 'Basic ' + Buffer.from(`${creds.username}:${creds.password}`).toString('base64');

  // Step 1: get CSRF token
  const pageRes = await fetch(`${creds.url}/sys.scripts.do`, {
    method: 'GET',
    headers: { Authorization: auth, Accept: 'text/html' },
  });
  if (!pageRes.ok) throw new Error(`/sys.scripts.do returned HTTP ${pageRes.status}`);
  const html = await pageRes.text();
  const ckMatch =
    html.match(/name="sysparm_ck"[^>]*value="([a-f0-9]+)"/i) ||
    html.match(/g_ck\s*=\s*['"]([a-f0-9]+)['"]/i);
  if (!ckMatch) throw new Error('CSRF token not found on /sys.scripts.do.');

  // Step 2: POST the script
  const body = new URLSearchParams();
  body.append('script', script);
  body.append('sysparm_ck', ckMatch[1]);
  body.append('runscript', 'Run script');
  body.append('quota_managed_transaction', 'on');
  body.append('sys_scope', '');

  const runRes = await fetch(`${creds.url}/sys.scripts.do`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!runRes.ok) throw new Error(`HTTP ${runRes.status}`);
  const out = await runRes.text();
  const blocks: string[] = [];
  const re = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out)) !== null) blocks.push(decodeEntities(m[1]).trimEnd());
  return { output: blocks.join('\n').trim() || '(no output)' };
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Used by core.ts to signal "the active creds object" from within nested closures. */
export type { InstanceCreds };
