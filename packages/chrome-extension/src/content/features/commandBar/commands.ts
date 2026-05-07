import type { Command } from './types.js';
import type { PageContext } from '../../../shared/messaging.js';

// ── Navigation table ────────────────────────────────────────────────────────

interface NavSpec {
  slash: string;
  label: string;
  path: string;
  keywords?: string[];
}

const NAV_TABLE: NavSpec[] = [
  { slash: '/inc',         label: 'Incidents',           path: '/now/nav/ui/classic/params/target/incident_list.do', keywords: ['incident'] },
  { slash: '/chg',         label: 'Changes',             path: '/now/nav/ui/classic/params/target/change_request_list.do', keywords: ['change', 'change request'] },
  { slash: '/prb',         label: 'Problems',            path: '/now/nav/ui/classic/params/target/problem_list.do', keywords: ['problem'] },
  { slash: '/usr',         label: 'Users',               path: '/now/nav/ui/classic/params/target/sys_user_list.do', keywords: ['user', 'sys_user'] },
  { slash: '/grp',         label: 'Groups',              path: '/now/nav/ui/classic/params/target/sys_user_group_list.do', keywords: ['group', 'sys_user_group'] },
  { slash: '/kb',          label: 'Knowledge',           path: '/now/nav/ui/classic/params/target/kb_knowledge_list.do', keywords: ['knowledge', 'article'] },
  { slash: '/sc',          label: 'Service Catalog',     path: '/now/nav/ui/classic/params/target/sc_cat_item_list.do', keywords: ['catalog', 'sc_cat_item'] },
  { slash: '/req',         label: 'Requests',            path: '/now/nav/ui/classic/params/target/sc_request_list.do', keywords: ['request', 'sc_request'] },
  { slash: '/ritm',        label: 'Requested Items',     path: '/now/nav/ui/classic/params/target/sc_req_item_list.do', keywords: ['requested item', 'sc_req_item'] },
  { slash: '/task',        label: 'Tasks',               path: '/now/nav/ui/classic/params/target/task_list.do', keywords: ['task'] },
  { slash: '/cmdb',        label: 'CMDB CIs',            path: '/now/nav/ui/classic/params/target/cmdb_ci_list.do', keywords: ['cmdb', 'configuration item'] },
  { slash: '/studio',      label: 'Studio',              path: '/now/$studio.do', keywords: ['app studio', 'developer'] },
  { slash: '/uib',         label: 'UI Builder',          path: '/now/builder', keywords: ['ui builder'] },
  { slash: '/fd',          label: 'Flow Designer',       path: '/now/flow-designer', keywords: ['flow', 'workflow'] },
  { slash: '/bg',          label: 'Background Scripts',  path: '/now/nav/ui/classic/params/target/sys.scripts.do', keywords: ['background', 'script', 'execute'] },
  { slash: '/props',       label: 'System Properties',   path: '/now/nav/ui/classic/params/target/sys_properties_list.do', keywords: ['property', 'sys_properties'] },
  { slash: '/logs',        label: 'System Logs',         path: '/now/nav/ui/classic/params/target/syslog_list.do', keywords: ['log', 'syslog'] },
  { slash: '/dict',        label: 'Dictionary',          path: '/now/nav/ui/classic/params/target/sys_dictionary_list.do', keywords: ['dictionary', 'field', 'sys_dictionary'] },
  { slash: '/tables',      label: 'Tables',              path: '/now/nav/ui/classic/params/target/sys_db_object_list.do', keywords: ['table', 'sys_db_object'] },
  { slash: '/modules',     label: 'Modules',             path: '/now/nav/ui/classic/params/target/sys_app_module_list.do', keywords: ['module', 'application'] },
  { slash: '/scripts',     label: 'Script Includes',     path: '/now/nav/ui/classic/params/target/sys_script_include_list.do', keywords: ['script include', 'sys_script_include'] },
  { slash: '/br',          label: 'Business Rules',      path: '/now/nav/ui/classic/params/target/sys_script_list.do', keywords: ['business rule', 'sys_script'] },
  { slash: '/cs',          label: 'Client Scripts',      path: '/now/nav/ui/classic/params/target/sys_script_client_list.do', keywords: ['client script', 'sys_script_client'] },
  { slash: '/fix',         label: 'Fix Scripts',         path: '/now/nav/ui/classic/params/target/sys_script_fix_list.do', keywords: ['fix script', 'sys_script_fix'] },
  { slash: '/ui',          label: 'UI Actions',          path: '/now/nav/ui/classic/params/target/sys_ui_action_list.do', keywords: ['ui action', 'sys_ui_action', 'button'] },
  { slash: '/rest',        label: 'REST API Explorer',   path: '/now/nav/ui/classic/params/target/$restapi.do', keywords: ['rest', 'api'] },
  { slash: '/atf',         label: 'ATF Tests',           path: '/now/nav/ui/classic/params/target/sys_atf_test_list.do', keywords: ['atf', 'test', 'automated test'] },
  { slash: '/scan',        label: 'Instance Scan',       path: '/now/nav/ui/classic/params/target/scan_linter_check_list.do', keywords: ['lint', 'scan', 'check'] },
  { slash: '/updatesets',  label: 'Update Sets',         path: '/now/nav/ui/classic/params/target/sys_update_set_list.do', keywords: ['update set', 'sys_update_set'] },
  { slash: '/widgets',     label: 'Widgets',             path: '/now/nav/ui/classic/params/target/sp_widget_list.do', keywords: ['widget', 'service portal', 'sp_widget'] },
];

function navigate(ctx: PageContext, path: string, newTab: boolean): void {
  if (!ctx.instanceInfo) return;
  const url = ctx.instanceInfo.baseUrl + path;
  if (newTab) window.open(url, '_blank');
  else window.location.href = url;
}

const navCommands: Command[] = NAV_TABLE.map((n) => ({
  id: `nav:${n.slash.slice(1)}`,
  label: n.label,
  description: n.slash,
  category: 'navigation',
  icon: '🔗',
  slash: n.slash,
  keywords: n.keywords,
  shortcut: '↵',
  execute: (ctx, opts) => navigate(ctx, n.path, opts.newTab),
}));

// ── Action commands ─────────────────────────────────────────────────────────

interface ActionDeps {
  toast: (message: string) => void;
}

function buildActionCommands({ toast }: ActionDeps): Command[] {
  return [
    {
      id: 'action:copy-sysid',
      label: 'Copy sys_id',
      description: 'Copy the current record’s sys_id to the clipboard',
      category: 'action',
      icon: '⚡',
      keywords: ['sys id', 'identifier'],
      isAvailable: (ctx) => Boolean(ctx.sysId),
      execute: async (ctx) => {
        if (!ctx.sysId) { toast('No sys_id on this page'); return; }
        await navigator.clipboard.writeText(ctx.sysId);
        toast(`✓ Copied: ${ctx.sysId.slice(0, 8)}…`);
      },
    },
    {
      id: 'action:copy-url',
      label: 'Copy URL',
      description: 'Copy the current page URL to the clipboard',
      category: 'action',
      icon: '⚡',
      keywords: ['link', 'address'],
      execute: async () => {
        await navigator.clipboard.writeText(window.location.href);
        toast('✓ URL copied');
      },
    },
    {
      id: 'action:copy-link',
      label: 'Copy link',
      description: 'Copy the page as a markdown link [Title](URL)',
      category: 'action',
      icon: '⚡',
      keywords: ['markdown', 'md'],
      execute: async () => {
        const md = `[${document.title.replace(/[[\]]/g, '')}](${window.location.href})`;
        await navigator.clipboard.writeText(md);
        toast('✓ Markdown link copied');
      },
    },
    {
      id: 'action:technical-names',
      label: 'Technical names',
      description: 'Toggle the "Show technical field names" preference',
      category: 'action',
      icon: '⚡',
      keywords: ['field names', 'developer mode'],
      execute: async (ctx) => {
        if (!ctx.instanceInfo) return;
        // Use the user-preference REST endpoint to toggle
        const KEY = 'glide.ui.show_field_label';
        try {
          const cur = await fetch(`/api/now/ui/user_preference/${encodeURIComponent(KEY)}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }).then((r) => r.ok ? r.json() : null) as { result?: { value?: string } } | null;
          const next = cur?.result?.value === 'true' ? 'false' : 'true';
          await fetch(`/api/now/ui/user_preference/${encodeURIComponent(KEY)}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: next }),
          });
          toast(`Technical names: ${next === 'true' ? 'on' : 'off'} — reload to see`);
        } catch {
          toast('Could not toggle preference');
        }
      },
    },
    {
      id: 'action:open-xml',
      label: 'Open XML',
      description: 'View the current record as XML',
      category: 'action',
      icon: '⚡',
      keywords: ['raw', 'export'],
      isAvailable: (ctx) => Boolean(ctx.sysId && ctx.tableName),
      execute: (ctx, opts) => {
        if (!ctx.tableName || !ctx.sysId) return;
        navigate(ctx, `/${ctx.tableName}.do?XML&sys_id=${ctx.sysId}`, opts.newTab);
      },
    },
    {
      id: 'action:open-dictionary',
      label: 'Open dictionary',
      description: 'List dictionary entries for the current table',
      category: 'action',
      icon: '⚡',
      keywords: ['fields', 'columns'],
      isAvailable: (ctx) => Boolean(ctx.tableName),
      execute: (ctx, opts) => {
        if (!ctx.tableName) return;
        navigate(ctx, `/now/nav/ui/classic/params/target/sys_dictionary_list.do%3Fsysparm_query%3Dname%3D${encodeURIComponent(ctx.tableName)}`, opts.newTab);
      },
    },
    {
      id: 'action:open-schema',
      label: 'Open schema map',
      description: 'View the schema map for the current table',
      category: 'action',
      icon: '⚡',
      keywords: ['relationships', 'erd'],
      isAvailable: (ctx) => Boolean(ctx.tableName),
      execute: (ctx, opts) => {
        if (!ctx.tableName) return;
        navigate(ctx, `/now/nav/ui/classic/params/target/sys_schema_map.do%3Fsysparm_table_name%3D${encodeURIComponent(ctx.tableName)}`, opts.newTab);
      },
    },
  ];
}

// ── Dynamic search-prefix commands ──────────────────────────────────────────

const SEARCH_PREFIX_RE = /^(table|script|user|record):\s*(.+)$/i;

interface SearchSpec {
  kind: 'table' | 'script' | 'user' | 'record';
  /** Builds the URL path given the trailing query. */
  buildPath: (query: string) => string;
  describe: (query: string) => string;
}

const SEARCH_KINDS: Record<string, SearchSpec> = {
  table: {
    kind: 'table',
    describe: (q) => `Search tables matching "${q}"`,
    buildPath: (q) => `/now/nav/ui/classic/params/target/sys_db_object_list.do%3Fsysparm_query%3DnameLIKE${encodeURIComponent(q)}`,
  },
  script: {
    kind: 'script',
    describe: (q) => `Search script includes matching "${q}"`,
    buildPath: (q) => `/now/nav/ui/classic/params/target/sys_script_include_list.do%3Fsysparm_query%3DnameLIKE${encodeURIComponent(q)}`,
  },
  user: {
    kind: 'user',
    describe: (q) => `Search users matching "${q}"`,
    buildPath: (q) => `/now/nav/ui/classic/params/target/sys_user_list.do%3Fsysparm_query%3DnameLIKE${encodeURIComponent(q)}`,
  },
  record: {
    kind: 'record',
    /** "record: incident active=true" → incident_list with sysparm_query. */
    describe: (q) => {
      const [tbl, ...rest] = q.split(/\s+/);
      const enc = rest.join(' ');
      return enc ? `Search ${tbl} where ${enc}` : `Open ${tbl} list`;
    },
    buildPath: (q) => {
      const [tbl, ...rest] = q.split(/\s+/);
      const query = rest.join(' ');
      const encQuery = encodeURIComponent(query);
      return query
        ? `/now/nav/ui/classic/params/target/${tbl}_list.do%3Fsysparm_query%3D${encQuery}`
        : `/now/nav/ui/classic/params/target/${tbl}_list.do`;
    },
  },
};

/**
 * If the query starts with a known prefix, build a synthetic command.
 * Returns [] if no prefix matched.
 */
export function buildDynamicCommands(query: string): Command[] {
  const m = query.match(SEARCH_PREFIX_RE);
  if (!m) return [];
  const kind = m[1].toLowerCase();
  const rest = m[2].trim();
  if (!rest) return [];
  const spec = SEARCH_KINDS[kind];
  if (!spec) return [];
  return [{
    id: `search:${kind}:${rest}`,
    label: spec.describe(rest),
    description: `${kind}: ${rest}`,
    category: 'search',
    icon: '🔍',
    shortcut: '↵',
    execute: (ctx, opts) => navigate(ctx, spec.buildPath(rest), opts.newTab),
  }];
}

// ── Public builder ──────────────────────────────────────────────────────────

export function buildAllCommands(deps: ActionDeps): Command[] {
  return [...navCommands, ...buildActionCommands(deps)];
}
