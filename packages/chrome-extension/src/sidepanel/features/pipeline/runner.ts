import { scan as runQualityScan } from '@nowforge/core';
import type {
  Pipeline, PipelineExecution, StageRun, CheckResult, CheckId,
} from './types.js';

/**
 * Pipeline orchestration. Each check is a placeholder implementation in v1
 * — they return realistic mock results so the UI can be exercised end to
 * end. Real implementations:
 *   - scan: POST to /api/now/instance_scan/run on each stage's instance
 *   - lint: run @nowforge/core's scan() on the update set's scripts
 *   - atf:  run an ATF suite via sys_atf_test_runner
 *   - diff: call the diff helper from Feature 14
 *
 * The shape is what matters here — checks are async, return CheckResult,
 * and the runner walks stages sequentially with auto-promote / approval gates.
 */

interface Hooks {
  onUpdate: (exec: PipelineExecution) => void;
  onApproveNeeded: (stage: StageRun) => Promise<boolean>;
}

export async function runPipeline(
  pipeline: Pipeline,
  payload: string,
  hooks: Hooks
): Promise<PipelineExecution> {
  const exec: PipelineExecution = {
    id: Math.random().toString(36).slice(2, 12),
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    payload,
    startedAt: Date.now(),
    status: 'running',
    stages: pipeline.stages.map((s) => ({
      stageId: s.id, status: 'pending', checks: s.checks.map((c) => ({ id: c, status: 'pending', message: '' })),
    })),
  };

  for (let i = 0; i < pipeline.stages.length; i++) {
    const stageDef = pipeline.stages[i];
    const stage = exec.stages[i];
    stage.status = 'running';
    stage.startedAt = Date.now();
    hooks.onUpdate(exec);

    let allPassed = true;
    for (const check of stage.checks) {
      check.status = 'running';
      hooks.onUpdate(exec);
      const result = await runCheck(check.id, payload, stageDef.instanceUrl);
      check.status = result.status;
      check.message = result.message;
      check.detail = result.detail;
      if (result.status === 'failed') allPassed = false;
      hooks.onUpdate(exec);
    }

    if (!allPassed) {
      stage.status = 'failed';
      stage.completedAt = Date.now();
      exec.status = 'failed';
      exec.completedAt = Date.now();
      hooks.onUpdate(exec);
      return exec;
    }

    if (stageDef.autoPromote) {
      stage.status = 'passed';
      stage.completedAt = Date.now();
      hooks.onUpdate(exec);
      continue;
    }

    // Manual approval gate
    stage.status = 'awaiting_approval';
    hooks.onUpdate(exec);
    const approved = await hooks.onApproveNeeded(stage);
    if (!approved) {
      stage.status = 'rejected';
      stage.completedAt = Date.now();
      exec.status = 'cancelled';
      exec.completedAt = Date.now();
      hooks.onUpdate(exec);
      return exec;
    }
    stage.status = 'passed';
    stage.completedAt = Date.now();
    hooks.onUpdate(exec);
  }

  exec.status = 'passed';
  exec.completedAt = Date.now();
  hooks.onUpdate(exec);
  return exec;
}

// ── Individual checks ──────────────────────────────────────────────────────

async function runCheck(id: CheckId, payload: string, instanceUrl: string): Promise<CheckResult> {
  switch (id) {
    case 'scan':  return runScanCheck(instanceUrl);
    case 'lint':  return runLintCheck(payload);
    case 'atf':   return runAtfCheck(instanceUrl);
    case 'diff':  return runDiffCheck(instanceUrl, payload);
  }
}

async function runScanCheck(instanceUrl: string): Promise<CheckResult> {
  // Real implementation would POST to /api/now/instance_scan/run with the
  // appropriate scope and poll for completion. For v1, a placeholder.
  await new Promise((r) => setTimeout(r, 600));
  if (!instanceUrl) {
    return { id: 'scan', status: 'skipped', message: 'No instance URL configured for stage.' };
  }
  return { id: 'scan', status: 'passed', message: 'Instance scan: 0 critical, 2 warnings.' };
}

async function runLintCheck(payload: string): Promise<CheckResult> {
  // Treat `payload` as a script to lint — real impl would pull all scripts
  // from the update set. For v1, lint the payload directly. The await keeps
  // this signature consistent with the other (genuinely async) checks.
  await Promise.resolve();
  const result = runQualityScan(payload || 'gs.print("hello");');
  const errors = result.findings.filter((f) => f.severity === 'error').length;
  const status = errors > 0 ? 'failed' : 'passed';
  return {
    id: 'lint',
    status,
    message: `Quality grade: ${result.grade} (${result.score}/100) — ${result.findings.length} issue(s).`,
    detail: result,
  };
}

async function runAtfCheck(instanceUrl: string): Promise<CheckResult> {
  await new Promise((r) => setTimeout(r, 800));
  if (!instanceUrl) {
    return { id: 'atf', status: 'skipped', message: 'No instance URL configured for stage.' };
  }
  return { id: 'atf', status: 'passed', message: 'ATF suite: 7/7 tests passed.' };
}

async function runDiffCheck(instanceUrl: string, _payload: string): Promise<CheckResult> {
  await new Promise((r) => setTimeout(r, 500));
  if (!instanceUrl) {
    return { id: 'diff', status: 'skipped', message: 'No instance URL configured for stage.' };
  }
  return { id: 'diff', status: 'passed', message: 'Diff vs source: 14 records will change.' };
}
