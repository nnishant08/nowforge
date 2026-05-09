#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CORE_TOOLS } from './tools/core.js';
import { PLATFORM_DEV_TOOLS } from './tools/platformDev.js';
import { INTEGRATION_TOOLS } from './tools/integrationEngineer.js';
import { ADMIN_TOOLS } from './tools/admin.js';
import {
  tablesResource,
  tableSchemaResource,
  scopesResource,
  updateSetsResource,
  currentContextResource,
} from './resources/context.js';

/**
 * NowForge MCP server. Communicates over stdio with whichever AI client
 * launches it (Claude Desktop, Cursor, Windsurf, VS Code MCP, etc).
 *
 * Tool packages: core (always on) + platformDev + integration + admin.
 * Persona filtering can be added later via env vars; for now we expose all.
 *
 * Resources: read-only metadata about the active SN instance.
 */

const ALL_TOOLS = {
  ...CORE_TOOLS,
  ...PLATFORM_DEV_TOOLS,
  ...INTEGRATION_TOOLS,
  ...ADMIN_TOOLS,
};

const server = new Server(
  { name: 'nowforge', version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// ── Tools ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, () =>
  Promise.resolve({ tools: Object.values(ALL_TOOLS).map((t) => t.schema) })
);

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
server.setRequestHandler(CallToolRequestSchema, (async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
  const { name, arguments: args } = request.params;
  const tool = ALL_TOOLS[name];
  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }
  try {
    return await tool.handler(args ?? {});
  } catch (e) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool ${name} threw: ${(e as Error).message}` }],
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any);

// ── Resources ────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, () =>
  Promise.resolve({
    resources: [
      { uri: 'servicenow://tables',          name: 'Tables',           description: 'List of tables on the active instance' },
      { uri: 'servicenow://scopes',          name: 'Scopes',           description: 'Application scopes' },
      { uri: 'servicenow://update-sets',     name: 'Update Sets',      description: 'Recent in-progress update sets' },
      { uri: 'servicenow://current-context', name: 'Current Context',  description: 'Active instance + user info' },
    ],
  })
);

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  let payload: unknown;

  if (uri === 'servicenow://tables') payload = await tablesResource();
  else if (uri === 'servicenow://scopes') payload = await scopesResource();
  else if (uri === 'servicenow://update-sets') payload = await updateSetsResource();
  else if (uri === 'servicenow://current-context') payload = await currentContextResource();
  else if (uri.startsWith('servicenow://tables/') && uri.endsWith('/schema')) {
    const table = uri.slice('servicenow://tables/'.length, -'/schema'.length);
    payload = await tableSchemaResource(table);
  } else {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  return {
    contents: [
      { uri, mimeType: 'application/json', text: JSON.stringify(payload, null, 2) },
    ],
  };
});

// ── Boot ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
// The SDK keeps the process alive while the transport is open.
