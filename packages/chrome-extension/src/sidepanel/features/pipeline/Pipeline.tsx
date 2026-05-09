import { useEffect, useMemo, useState } from 'react';
import type { Pipeline as PipelineDef, PipelineExecution, StageRun } from './types.js';
import { loadPipelines, savePipelines, loadExecutions, appendExecution, updateExecution, pipelineTemplates } from './storage.js';
import { runPipeline } from './runner.js';
import './styles.css';

const newId = (): string => Math.random().toString(36).slice(2, 10);

export function Pipeline() {
  const [pipelines, setPipelines] = useState<PipelineDef[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [execution, setExecution] = useState<PipelineExecution | null>(null);
  const [history, setHistory] = useState<PipelineExecution[]>([]);
  const [payload, setPayload] = useState('Q2 Changes');
  const [approvalResolver, setApprovalResolver] = useState<((ok: boolean) => void) | null>(null);

  const active = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) ?? null,
    [pipelines, activePipelineId]
  );

  useEffect(() => {
    void loadPipelines().then((p) => {
      setPipelines(p);
      setActivePipelineId(p[0]?.id ?? null);
    });
    void loadExecutions().then(setHistory);
  }, []);

  const persist = async (next: PipelineDef[]): Promise<void> => {
    setPipelines(next);
    await savePipelines(next);
  };

  const startRun = async (): Promise<void> => {
    if (!active) return;
    if (active.stages.length === 0) return;
    const exec = await runPipeline(active, payload, {
      onUpdate: (e) => setExecution({ ...e, stages: e.stages.map((s) => ({ ...s, checks: s.checks.map((c) => ({ ...c })) })) }),
      onApproveNeeded: () => new Promise<boolean>((resolve) => setApprovalResolver(() => resolve)),
    });
    await appendExecution(exec);
    await updateExecution(exec);
    setHistory(await loadExecutions());
  };

  const useTemplate = async (template: PipelineDef): Promise<void> => {
    const fresh: PipelineDef = { ...template, id: newId(), updatedAt: Date.now() };
    await persist([fresh, ...pipelines]);
    setActivePipelineId(fresh.id);
    setEditing(true);
  };

  const addStage = async (): Promise<void> => {
    if (!active) return;
    const next: PipelineDef = {
      ...active,
      stages: [...active.stages, { id: newId(), name: `Stage ${active.stages.length + 1}`, instanceUrl: '', checks: ['scan', 'lint'], autoPromote: false }],
    };
    await persist(pipelines.map((p) => (p.id === active.id ? next : p)));
  };

  const updateActive = async (mut: (p: PipelineDef) => PipelineDef): Promise<void> => {
    if (!active) return;
    const updated = mut({ ...active, updatedAt: Date.now() });
    await persist(pipelines.map((p) => (p.id === active.id ? updated : p)));
  };

  return (
    <div className="dp-root">
      <header className="dp-head">
        <select
          className="dp-pick"
          value={activePipelineId ?? ''}
          onChange={(e) => setActivePipelineId(e.target.value)}
        >
          {pipelines.length === 0 && <option value="">— No pipelines yet —</option>}
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="dp-btn dp-btn--ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      </header>

      {pipelines.length === 0 && (
        <section className="dp-card">
          <h3 className="dp-card__title">Pick a template to start</h3>
          <ul className="dp-templates">
            {pipelineTemplates().map((t) => (
              <li key={t.name}>
                <button className="dp-template" onClick={() => void useTemplate(t)}>
                  <strong>{t.name}</strong>
                  <span>{t.stages.map((s) => s.name).join(' → ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active && !editing && (
        <>
          <section className="dp-card">
            <label className="dp-field">
              <span>Deploying</span>
              <input type="text" value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="Update set name" />
            </label>
            <button className="dp-btn dp-btn--primary" onClick={() => void startRun()} disabled={!!execution && execution.status === 'running'}>
              {execution?.status === 'running' ? 'Running…' : '▶ Start'}
            </button>
          </section>

          {execution && (
            <section className="dp-card">
              <StagesProgress execution={execution} />
              <StageDetails execution={execution} approvalResolver={approvalResolver} setApprovalResolver={setApprovalResolver} />
            </section>
          )}
        </>
      )}

      {active && editing && (
        <section className="dp-card">
          <label className="dp-field">
            <span>Pipeline name</span>
            <input type="text" value={active.name} onChange={(e) => void updateActive((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <ol className="dp-stages">
            {active.stages.map((s, i) => (
              <li key={s.id} className="dp-stage-edit">
                <input
                  type="text" value={s.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    void updateActive((p) => ({ ...p, stages: p.stages.map((x, j) => (j === i ? { ...x, name } : x)) }));
                  }}
                  placeholder="Stage name"
                />
                <input
                  type="text" value={s.instanceUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    void updateActive((p) => ({ ...p, stages: p.stages.map((x, j) => (j === i ? { ...x, instanceUrl: url } : x)) }));
                  }}
                  placeholder="https://instance.service-now.com"
                />
                <div className="dp-checks">
                  {(['scan', 'lint', 'atf', 'diff'] as const).map((c) => (
                    <label key={c}>
                      <input
                        type="checkbox" checked={s.checks.includes(c)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          void updateActive((p) => ({
                            ...p,
                            stages: p.stages.map((x, j) => j === i
                              ? { ...x, checks: checked ? [...x.checks, c] : x.checks.filter((y) => y !== c) }
                              : x),
                          }));
                        }}
                      />
                      {c}
                    </label>
                  ))}
                </div>
                <label className="dp-auto">
                  <input
                    type="checkbox" checked={s.autoPromote}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      void updateActive((p) => ({ ...p, stages: p.stages.map((x, j) => (j === i ? { ...x, autoPromote: checked } : x)) }));
                    }}
                  /> Auto-promote
                </label>
              </li>
            ))}
          </ol>
          <button className="dp-btn dp-btn--ghost" onClick={() => void addStage()}>+ Add stage</button>
        </section>
      )}

      {history.length > 0 && (
        <section className="dp-card">
          <h3 className="dp-card__title">History</h3>
          <ul className="dp-history">
            {history.slice(0, 5).map((h) => (
              <li key={h.id}>
                <span className={`dp-status dp-status--${h.status}`}>{h.status}</span>
                <span>{h.pipelineName}</span>
                <span className="dp-history__when">{new Date(h.startedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StagesProgress({ execution }: { execution: PipelineExecution }) {
  return (
    <div className="dp-progress">
      {execution.stages.map((s, i) => (
        <span key={s.stageId} className={`dp-progress__stage dp-progress__stage--${s.status}`}>
          {iconFor(s.status)} Stage {i + 1}
        </span>
      ))}
    </div>
  );
}

function iconFor(status: StageRun['status']): string {
  if (status === 'passed') return '✅';
  if (status === 'failed' || status === 'rejected') return '❌';
  if (status === 'running') return '⏳';
  if (status === 'awaiting_approval') return '⏸';
  return '○';
}

function StageDetails({
  execution, approvalResolver, setApprovalResolver,
}: {
  execution: PipelineExecution;
  approvalResolver: ((ok: boolean) => void) | null;
  setApprovalResolver: (r: ((ok: boolean) => void) | null) => void;
}) {
  const current = execution.stages.find((s) => s.status === 'running' || s.status === 'awaiting_approval' || s.status === 'failed');
  if (!current) return null;
  return (
    <div className="dp-stage-details">
      <ul className="dp-checks-list">
        {current.checks.map((c) => (
          <li key={c.id} className={`dp-check dp-check--${c.status}`}>
            <span>{c.id}</span>
            <span>{c.message || c.status}</span>
          </li>
        ))}
      </ul>
      {current.status === 'awaiting_approval' && approvalResolver && (
        <div className="dp-approve">
          <span>Awaiting approval to proceed.</span>
          <button className="dp-btn dp-btn--primary" onClick={() => { approvalResolver(true); setApprovalResolver(null); }}>Approve & continue</button>
          <button className="dp-btn dp-btn--ghost" onClick={() => { approvalResolver(false); setApprovalResolver(null); }}>Reject</button>
        </div>
      )}
    </div>
  );
}
