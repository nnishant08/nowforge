import { useCallback, useEffect, useState } from 'react';
import type {
  FlowInfo as FlowInfoT,
  FlowExecution,
  FlowStep,
} from '../../../shared/messaging.js';
import { extractFlowSysId, isFlowDesignerUrl } from '../../../shared/flowDetector.js';
import { getActiveTabUrl, getFlowInfo, getExecutions, getSteps } from './api.js';
import { FlowInfo } from './FlowInfo.js';
import { ExecutionList } from './ExecutionList.js';
import { StepInspector } from './StepInspector.js';
import { TestLauncher } from './TestLauncher.js';
import './styles.css';

const PAGE_REFRESH_MS = 5000;
const PAGE_SIZE = 10;

type View = 'list' | 'steps';

export function FlowInspector() {
  const [flowSysId, setFlowSysId] = useState<string | null>(null);
  const [info, setInfo] = useState<FlowInfoT | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [executions, setExecutions] = useState<FlowExecution[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [view, setView] = useState<View>('list');
  const [selectedExec, setSelectedExec] = useState<FlowExecution | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [permsHint, setPermsHint] = useState(false);

  // ── Detect flow sys_id from active tab URL ────────────────────────────
  const detect = useCallback(async () => {
    const url = await getActiveTabUrl();
    if (!url || !isFlowDesignerUrl(url)) {
      setFlowSysId(null);
      return;
    }
    const id = extractFlowSysId(url);
    setFlowSysId((prev) => (prev === id ? prev : id));
  }, []);

  useEffect(() => {
    void detect();
    const t = window.setInterval(() => void detect(), PAGE_REFRESH_MS);
    return () => window.clearInterval(t);
  }, [detect]);

  // ── Load info + executions when flow sys_id changes ──────────────────
  const loadInfo = useCallback(async (id: string) => {
    setInfoLoading(true);
    const res = await getFlowInfo(id);
    setInfoLoading(false);
    if (res.ok) { setInfo(res.info); setInfoError(null); }
    else { setInfoError(res.error ?? 'Failed.'); setInfo(null); }
  }, []);

  const loadExecutions = useCallback(
    async (id: string, mode: 'replace' | 'append', offset = 0): Promise<FlowExecution[]> => {
      if (mode === 'replace') setExecLoading(true);
      else setLoadingMore(true);
      const res = await getExecutions(id, PAGE_SIZE, offset);
      if (mode === 'replace') setExecLoading(false);
      else setLoadingMore(false);
      if (!res.ok) {
        setExecError(res.error ?? 'Failed.');
        if (mode === 'replace') setExecutions([]);
        return [];
      }
      setExecError(null);
      setTotalAvailable(res.totalAvailable);
      if (mode === 'replace') {
        setExecutions(res.executions);
      } else {
        setExecutions((prev) => [...prev, ...res.executions]);
      }
      return res.executions;
    },
    []
  );

  useEffect(() => {
    if (!flowSysId) {
      setInfo(null); setExecutions([]); setSteps([]); setView('list'); setSelectedExec(null);
      return;
    }
    void loadInfo(flowSysId);
    void loadExecutions(flowSysId, 'replace');
  }, [flowSysId, loadInfo, loadExecutions]);

  // ── When an execution is selected, load steps ────────────────────────
  const handleSelectExec = useCallback(async (e: FlowExecution) => {
    setSelectedExec(e);
    setView('steps');
    setSteps([]);
    setStepsError(null);
    setPermsHint(false);
    setStepsLoading(true);
    const res = await getSteps(e.sysId);
    setStepsLoading(false);
    if (res.ok) {
      setSteps(res.steps);
    } else {
      setStepsError(res.error ?? 'Failed.');
      setPermsHint(Boolean(res.permissionsHint));
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────
  if (!flowSysId) {
    return (
      <div className="fl-empty fl-empty--centered">
        <div className="fl-empty__icon" aria-hidden>🪄</div>
        <p className="fl-empty__title">No flow selected.</p>
        <p className="fl-empty__hint">
          Open a Flow Designer page (URL with <code>/flow/&lt;sys_id&gt;</code>) to inspect it.
        </p>
        <button type="button" className="fl-btn fl-btn--secondary fl-btn--sm" onClick={() => void detect()}>
          Re-check
        </button>
      </div>
    );
  }

  return (
    <div className="fl-root">
      <FlowInfo info={info} loading={infoLoading} error={infoError} />

      {view === 'list' ? (
        <>
          <ExecutionList
            executions={executions}
            totalAvailable={totalAvailable}
            loading={execLoading}
            error={execError}
            selectedSysId={selectedExec?.sysId ?? null}
            onSelect={(e) => void handleSelectExec(e)}
            onRefresh={() => void loadExecutions(flowSysId, 'replace')}
            onLoadMore={() => void loadExecutions(flowSysId, 'append', executions.length)}
            loadingMore={loadingMore}
          />
          <TestLauncher
            flowSysId={flowSysId}
            triggerTable={info?.triggerTable ?? ''}
            onTestStarted={() => void loadExecutions(flowSysId, 'replace')}
          />
        </>
      ) : selectedExec ? (
        <StepInspector
          execution={selectedExec}
          steps={steps}
          loading={stepsLoading}
          error={stepsError}
          permissionsHint={permsHint}
          onClose={() => setView('list')}
        />
      ) : null}
    </div>
  );
}
