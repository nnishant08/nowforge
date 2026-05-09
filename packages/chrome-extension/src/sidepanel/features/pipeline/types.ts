/** Persisted pipeline definition. Stored in chrome.storage.local. */

export type CheckId = 'scan' | 'lint' | 'atf' | 'diff';

export interface PipelineStage {
  id: string;
  name: string;
  /** URL of the SN instance for this stage. */
  instanceUrl: string;
  checks: CheckId[];
  autoPromote: boolean;
  /** Optional list of approver usernames (informational; not enforced). */
  approvers?: string[];
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  /** ms epoch */
  updatedAt: number;
}

export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  message: string;
  /** Detailed payload — varies per check (e.g. scan results, lint findings). */
  detail?: unknown;
}

export type StageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'awaiting_approval' | 'rejected';

export interface StageRun {
  stageId: string;
  status: StageStatus;
  checks: CheckResult[];
  startedAt?: number;
  completedAt?: number;
  approvedBy?: string;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  pipelineName: string;
  /** What's being deployed — free-form description (update set name, etc.). */
  payload: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  stages: StageRun[];
}
