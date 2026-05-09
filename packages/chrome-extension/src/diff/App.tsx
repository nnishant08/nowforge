import { useMemo, useState } from 'react';
import { ServiceNowApiClient, diffLines, type DiffOp } from '@nowforge/core';

/**
 * Two-instance diff tool. Opens in its own tab. The user enters URL +
 * basic-auth credentials for each side (kept in component state — never
 * persisted, since these are admin-level creds for arbitrary instances).
 *
 * Records are matched across instances by (name, scope) since sys_ids
 * differ. Each table can have a different "primary script field" — see
 * SCRIPT_FIELDS below.
 */

interface InstanceCreds {
  url: string;
  username: string;
  password: string;
}

interface SnRecord {
  sysId: string;
  name: string;
  scope: string;
  script: string;
  updatedOn: string;
}

interface ComparedRow {
  /** Match key: name + scope. */
  key: string;
  name: string;
  scope: string;
  table: string;
  a: SnRecord | null;
  b: SnRecord | null;
}

const TABLES: Array<{ id: string; label: string; field: string }> = [
  { id: 'sys_script',         label: 'Business Rules',        field: 'script' },
  { id: 'sys_script_client',  label: 'Client Scripts',        field: 'script' },
  { id: 'sys_script_include', label: 'Script Includes',       field: 'script' },
  { id: 'sys_ui_action',      label: 'UI Actions',            field: 'script' },
  { id: 'sys_ui_policy',      label: 'UI Policies',           field: 'script' },
  { id: 'sys_security_acl',   label: 'ACLs',                  field: 'script' },
  { id: 'sysauto_script',     label: 'Scheduled Jobs',        field: 'script' },
  { id: 'sys_ws_operation',   label: 'Scripted REST',         field: 'operation_script' },
  { id: 'sys_properties',     label: 'System Properties',     field: 'value' },
];

interface DvField { value?: string; display_value?: string; }

export default function App() {
  const [a, setA] = useState<InstanceCreds>({ url: '', username: '', password: '' });
  const [b, setB] = useState<InstanceCreds>({ url: '', username: '', password: '' });
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(['sys_script', 'sys_script_include', 'sys_script_client'])
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<ComparedRow[]>([]);
  const [activeTab, setActiveTab] = useState<'a' | 'b' | 'diff'>('diff');
  const [selectedRow, setSelectedRow] = useState<ComparedRow | null>(null);

  // ── Fetch & compare ───────────────────────────────────────────────────
  const fetchTable = async (
    creds: InstanceCreds,
    table: string,
    field: string
  ): Promise<SnRecord[]> => {
    const client = new ServiceNowApiClient({
      instanceUrl: creds.url,
      auth: { type: 'basic', username: creds.username, password: creds.password },
    });
    const rows = await client.getRecords(table, {
      fields: ['sys_id', 'name', 'sys_name', 'sys_scope.scope', 'sys_updated_on', field],
      limit: 1000,
      displayValue: 'all',
    }) as unknown as Array<Record<string, DvField>>;

    return rows.map((r): SnRecord => ({
      sysId: r.sys_id?.value ?? '',
      name: (r.name?.value ?? r.sys_name?.value ?? '').trim(),
      scope: (r['sys_scope.scope']?.value ?? 'global'),
      script: r[field]?.value ?? '',
      updatedOn: r.sys_updated_on?.value ?? '',
    }));
  };

  const compare = async (): Promise<void> => {
    if (!a.url || !b.url) { setError('Both instance URLs are required.'); return; }
    if (selectedTables.size === 0) { setError('Pick at least one table.'); return; }

    setBusy(true);
    setError(null);
    setResults([]);
    setSelectedRow(null);

    const all: ComparedRow[] = [];
    try {
      for (const tbl of TABLES) {
        if (!selectedTables.has(tbl.id)) continue;
        setProgress(`Fetching ${tbl.label}…`);
        const [aRows, bRows] = await Promise.all([
          fetchTable(a, tbl.id, tbl.field),
          fetchTable(b, tbl.id, tbl.field),
        ]);
        const map = new Map<string, ComparedRow>();
        for (const r of aRows) {
          const key = `${r.scope}::${r.name}`;
          map.set(key, { key, name: r.name, scope: r.scope, table: tbl.id, a: r, b: null });
        }
        for (const r of bRows) {
          const key = `${r.scope}::${r.name}`;
          const ex = map.get(key);
          if (ex) ex.b = r;
          else map.set(key, { key, name: r.name, scope: r.scope, table: tbl.id, a: null, b: r });
        }
        all.push(...map.values());
      }
      setResults(all);
      setProgress('');
    } catch (err) {
      setError(`Fetch failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Categorise ────────────────────────────────────────────────────────
  const onlyA = useMemo(() => results.filter((r) => r.a && !r.b), [results]);
  const onlyB = useMemo(() => results.filter((r) => !r.a && r.b), [results]);
  const different = useMemo(
    () => results.filter((r) => r.a && r.b && r.a.script !== r.b.script),
    [results]
  );

  const visibleRows: ComparedRow[] =
    activeTab === 'a' ? onlyA :
    activeTab === 'b' ? onlyB :
    different;

  // ── Export ────────────────────────────────────────────────────────────
  const exportCsv = (): void => {
    const headers = ['Table', 'Name', 'Scope', 'Status'];
    const lines = [headers.join(',')];
    for (const r of results) {
      const status = !r.b ? 'Only in A' : !r.a ? 'Only in B' : (r.a.script === r.b.script ? 'Same' : 'Different');
      lines.push([r.table, csv(r.name), csv(r.scope), status].join(','));
    }
    download('instance-diff.csv', lines.join('\n'));
  };

  return (
    <div className="diff-app">
      <header className="diff-app__head">
        <h1>NowForge — Instance Diff</h1>
        <p>Compare configuration tables across two ServiceNow instances. Credentials never leave this page.</p>
      </header>

      <section className="diff-form">
        <div className="diff-form__cols">
          <CredsPanel label="Instance A" creds={a} onChange={setA} />
          <CredsPanel label="Instance B" creds={b} onChange={setB} />
        </div>

        <div className="diff-tables">
          <div className="diff-tables__head">Tables to compare</div>
          <div className="diff-tables__grid">
            {TABLES.map((t) => (
              <label key={t.id} className="diff-table-pick">
                <input
                  type="checkbox"
                  checked={selectedTables.has(t.id)}
                  onChange={(e) => {
                    setSelectedTables((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(t.id);
                      else next.delete(t.id);
                      return next;
                    });
                  }}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="diff-form__actions">
          <button
            type="button"
            className="diff-btn diff-btn--primary"
            onClick={() => void compare()}
            disabled={busy}
          >
            {busy ? `${progress || 'Comparing…'}` : 'Compare'}
          </button>
          {results.length > 0 && (
            <button type="button" className="diff-btn diff-btn--secondary" onClick={exportCsv}>
              Export CSV
            </button>
          )}
        </div>
        {error && <div className="diff-error">{error}</div>}
      </section>

      {results.length > 0 && (
        <section className="diff-results">
          <nav className="diff-tabs">
            <Tab id="a"    active={activeTab} onClick={setActiveTab} label={`Only in A (${onlyA.length})`} />
            <Tab id="b"    active={activeTab} onClick={setActiveTab} label={`Only in B (${onlyB.length})`} />
            <Tab id="diff" active={activeTab} onClick={setActiveTab} label={`Different (${different.length})`} />
          </nav>

          <div className="diff-split">
            <ul className="diff-list">
              {visibleRows.map((r) => (
                <li key={r.table + r.key}>
                  <button
                    type="button"
                    className={`diff-list__item${selectedRow === r ? ' diff-list__item--active' : ''}`}
                    onClick={() => setSelectedRow(r)}
                  >
                    <span className="diff-list__name">{r.name || '(unnamed)'}</span>
                    <span className="diff-list__sub">
                      <code>{r.table}</code> · {r.scope}
                    </span>
                  </button>
                </li>
              ))}
              {visibleRows.length === 0 && <li className="diff-list__empty">No records in this category.</li>}
            </ul>

            <div className="diff-detail">
              {selectedRow && activeTab === 'diff' && selectedRow.a && selectedRow.b ? (
                <SideBySideDiff a={selectedRow.a.script} b={selectedRow.b.script} aLabel={shortHost(a.url)} bLabel={shortHost(b.url)} />
              ) : selectedRow && (selectedRow.a || selectedRow.b) ? (
                <pre className="diff-only-pre">
                  {(selectedRow.a ?? selectedRow.b)!.script || '(empty)'}
                </pre>
              ) : (
                <div className="diff-empty">Pick a record on the left to inspect it.</div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function CredsPanel({
  label, creds, onChange,
}: { label: string; creds: InstanceCreds; onChange: (c: InstanceCreds) => void }) {
  return (
    <div className="diff-creds">
      <h3>{label}</h3>
      <input type="text" placeholder="https://instance.service-now.com" value={creds.url}
             onChange={(e) => onChange({ ...creds, url: e.target.value.trim() })} />
      <input type="text" placeholder="username" value={creds.username}
             onChange={(e) => onChange({ ...creds, username: e.target.value })} />
      <input type="password" placeholder="password" value={creds.password}
             onChange={(e) => onChange({ ...creds, password: e.target.value })} />
    </div>
  );
}

function Tab({ id, active, label, onClick }: {
  id: 'a' | 'b' | 'diff'; active: 'a' | 'b' | 'diff'; label: string; onClick: (id: 'a' | 'b' | 'diff') => void;
}) {
  return (
    <button
      type="button"
      className={`diff-tab${active === id ? ' diff-tab--active' : ''}`}
      onClick={() => onClick(id)}
    >
      {label}
    </button>
  );
}

function SideBySideDiff({ a, b, aLabel, bLabel }: { a: string; b: string; aLabel: string; bLabel: string }) {
  const ops = useMemo<DiffOp[]>(() => diffLines(a, b), [a, b]);
  return (
    <div className="diff-sbs">
      <div className="diff-sbs__head">
        <div>{aLabel}</div>
        <div>{bLabel}</div>
      </div>
      <div className="diff-sbs__body">
        {ops.map((op, i) => renderOp(op, i))}
      </div>
    </div>
  );
}

function renderOp(op: DiffOp, i: number) {
  if (op.kind === 'equal') {
    return op.leftLines.map((ln, j) => (
      <div key={`${i}-${j}`} className="diff-row diff-row--eq">
        <pre className="diff-cell">{ln}</pre>
        <pre className="diff-cell">{ln}</pre>
      </div>
    ));
  }
  if (op.kind === 'add') {
    return op.rightLines.map((ln, j) => (
      <div key={`${i}-${j}`} className="diff-row diff-row--add">
        <pre className="diff-cell"></pre>
        <pre className="diff-cell">+ {ln}</pre>
      </div>
    ));
  }
  if (op.kind === 'remove') {
    return op.leftLines.map((ln, j) => (
      <div key={`${i}-${j}`} className="diff-row diff-row--rem">
        <pre className="diff-cell">- {ln}</pre>
        <pre className="diff-cell"></pre>
      </div>
    ));
  }
  // change — pair lines up
  const max = Math.max(op.leftLines.length, op.rightLines.length);
  const rows: JSX.Element[] = [];
  for (let k = 0; k < max; k++) {
    rows.push(
      <div key={`${i}-${k}`} className="diff-row diff-row--chg">
        <pre className="diff-cell">{op.leftLines[k] !== undefined ? `- ${op.leftLines[k]}` : ''}</pre>
        <pre className="diff-cell">{op.rightLines[k] !== undefined ? `+ ${op.rightLines[k]}` : ''}</pre>
      </div>
    );
  }
  return rows;
}

function shortHost(url: string): string {
  try { return new URL(url).host.split('.')[0]; } catch { return url || 'instance'; }
}

function csv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function download(filename: string, data: string): void {
  const blob = new Blob([data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
