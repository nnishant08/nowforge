import type { Pipeline, PipelineExecution } from './types.js';

const PIPELINES_KEY = 'nowforge_pipelines';
const EXECUTIONS_KEY = 'nowforge_pipeline_executions';
const EXEC_LIMIT = 20;

export async function loadPipelines(): Promise<Pipeline[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(PIPELINES_KEY, (r) => {
      resolve((r[PIPELINES_KEY] as Pipeline[] | undefined) ?? []);
    });
  });
}

export async function savePipelines(list: Pipeline[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [PIPELINES_KEY]: list }, () => resolve());
  });
}

export async function loadExecutions(): Promise<PipelineExecution[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(EXECUTIONS_KEY, (r) => {
      resolve((r[EXECUTIONS_KEY] as PipelineExecution[] | undefined) ?? []);
    });
  });
}

export async function appendExecution(exec: PipelineExecution): Promise<void> {
  const existing = await loadExecutions();
  const next = [exec, ...existing].slice(0, EXEC_LIMIT);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [EXECUTIONS_KEY]: next }, () => resolve());
  });
}

export async function updateExecution(exec: PipelineExecution): Promise<void> {
  const existing = await loadExecutions();
  const next = existing.map((e) => (e.id === exec.id ? exec : e));
  return new Promise((resolve) => {
    chrome.storage.local.set({ [EXECUTIONS_KEY]: next }, () => resolve());
  });
}

/** Pre-built pipeline templates. */
export function pipelineTemplates(): Pipeline[] {
  const id = (): string => Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  return [
    {
      id: id(),
      name: 'Simple — Dev → Prod',
      updatedAt: now,
      stages: [
        { id: id(), name: 'Dev',  instanceUrl: '', checks: ['scan', 'lint'], autoPromote: true },
        { id: id(), name: 'Prod', instanceUrl: '', checks: ['scan', 'lint', 'diff'], autoPromote: false, approvers: ['admin'] },
      ],
    },
    {
      id: id(),
      name: 'Standard — Dev → Test → Prod',
      updatedAt: now,
      stages: [
        { id: id(), name: 'Dev',  instanceUrl: '', checks: ['scan', 'lint'],          autoPromote: true },
        { id: id(), name: 'Test', instanceUrl: '', checks: ['scan', 'lint', 'atf'],   autoPromote: false, approvers: ['admin'] },
        { id: id(), name: 'Prod', instanceUrl: '', checks: ['scan', 'lint', 'atf', 'diff'], autoPromote: false, approvers: ['admin'] },
      ],
    },
    {
      id: id(),
      name: 'Enterprise — Dev → Test → Stage → Prod',
      updatedAt: now,
      stages: [
        { id: id(), name: 'Dev',   instanceUrl: '', checks: ['scan', 'lint'],          autoPromote: true },
        { id: id(), name: 'Test',  instanceUrl: '', checks: ['scan', 'lint', 'atf'],   autoPromote: false, approvers: ['admin'] },
        { id: id(), name: 'Stage', instanceUrl: '', checks: ['scan', 'lint', 'atf', 'diff'], autoPromote: false, approvers: ['admin'] },
        { id: id(), name: 'Prod',  instanceUrl: '', checks: ['scan', 'lint', 'atf', 'diff'], autoPromote: false, approvers: ['admin', 'manager'] },
      ],
    },
  ];
}
