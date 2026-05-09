import { useState } from 'react';
import type { FlowExecution, FlowStep } from '../../../shared/messaging.js';

export interface StepInspectorProps {
  execution: FlowExecution;
  steps: FlowStep[];
  loading: boolean;
  error: string | null;
  permissionsHint: boolean;
  onClose: () => void;
}

function stepIcon(state: string): { icon: string; tone: string } {
  const s = state.toUpperCase();
  if (s === 'FINISHED' || s === 'COMPLETE' || s === 'COMPLETED' || s === 'SUCCESS')
    return { icon: '✓', tone: 'green' };
  if (s === 'ERROR' || s === 'FAILED') return { icon: '✕', tone: 'red' };
  if (s === 'CANCELLED' || s === 'CANCELED' || s === 'SKIPPED')
    return { icon: '⊝', tone: 'gray' };
  if (s === 'RUNNING' || s === 'IN_PROGRESS') return { icon: '⏵', tone: 'blue' };
  if (s === 'WAITING') return { icon: '⏸', tone: 'yellow' };
  return { icon: '·', tone: 'gray' };
}

function elementBadge(elementType: string): string {
  const t = elementType.toLowerCase();
  if (t.includes('trigger')) return 'Trigger';
  if (t === 'if' || t.includes('condition')) return 'If';
  if (t === 'else' || t === 'elseif') return 'Else';
  if (t === 'end') return 'End';
  if (t.includes('subflow')) return 'Subflow';
  if (t.includes('action') || t.includes('operation')) return 'Action';
  if (t.includes('try') || t.includes('catch')) return 'Try/Catch';
  if (t.includes('loop') || t.includes('foreach')) return 'Loop';
  return elementType || 'Step';
}

function fmtMs(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface ParsedField {
  key: string;
  value: string;
}

function parseJsonObj(s: string): ParsedField[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (parsed === null || typeof parsed !== 'object') return [];
    return Object.entries(parsed as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      value: typeof v === 'string' ? v : JSON.stringify(v),
    }));
  } catch {
    return [];
  }
}

function StepRow({ step, idx }: { step: FlowStep; idx: number }) {
  const [open, setOpen] = useState(false);
  const m = stepIcon(step.state);
  const inputs = parseJsonObj(step.inputsJson);
  const outputs = parseJsonObj(step.outputsJson);

  return (
    <li className={`fl-step fl-step--${m.tone}`}>
      <button
        type="button"
        className="fl-step__head"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`fl-step__icon fl-step__icon--${m.tone}`}>{m.icon}</span>
        <span className="fl-step__num">Step {idx + 1}</span>
        <span className="fl-step__type">{elementBadge(step.elementType)}</span>
        <span className="fl-step__name" title={step.name}>{step.name || '(unnamed)'}</span>
        <span className="fl-step__dur">{fmtMs(step.durationMs)}</span>
        <span className="fl-step__chev" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="fl-step__body">
          {step.errorMessage && (
            <div className="fl-step__error">{step.errorMessage}</div>
          )}
          {inputs.length > 0 && (
            <FieldList title="Inputs" fields={inputs} />
          )}
          {outputs.length > 0 && (
            <FieldList title="Outputs" fields={outputs} />
          )}
          {!step.errorMessage && inputs.length === 0 && outputs.length === 0 && (
            <div className="fl-step__empty">No inputs or outputs recorded.</div>
          )}
        </div>
      )}
    </li>
  );
}

function FieldList({ title, fields }: { title: string; fields: ParsedField[] }) {
  return (
    <div className="fl-step__fields">
      <div className="fl-step__fields-title">{title}</div>
      <ul>
        {fields.map((f, i) => (
          <li key={i}>
            <span className="fl-step__fkey">{f.key}</span>
            <span className="fl-step__fval">
              {f.value.length > 120 ? f.value.slice(0, 117) + '…' : f.value || '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StepInspector({
  execution, steps, loading, error, permissionsHint, onClose,
}: StepInspectorProps) {
  return (
    <section className="fl-steps">
      <header className="fl-steps__head">
        <button
          type="button"
          className="fl-steps__back"
          onClick={onClose}
          title="Back to list"
        >
          ← Back
        </button>
        <div className="fl-steps__title">
          <span>Execution</span>
          <span className="fl-steps__sub">
            {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : ''}
            {execution.durationMs > 0 && ` · ${fmtMs(execution.durationMs)}`}
          </span>
        </div>
      </header>

      {execution.triggerDisplay && (
        <div className="fl-steps__trigger">
          Trigger: <span className="fl-info__mono">{execution.triggerDisplay}</span>
        </div>
      )}

      {loading && steps.length === 0 ? (
        <div className="fl-empty">Loading steps…</div>
      ) : permissionsHint ? (
        <div className="fl-empty fl-empty--err">
          {error}
          <br /><span className="fl-empty__hint">
            sys_flow_log is typically restricted to admin / flow_designer roles.
          </span>
        </div>
      ) : error && steps.length === 0 ? (
        <div className="fl-empty fl-empty--err">{error}</div>
      ) : steps.length === 0 ? (
        <div className="fl-empty">No step records found for this execution.</div>
      ) : (
        <ol className="fl-steps__list">
          {steps.map((s, i) => <StepRow key={s.sysId} step={s} idx={i} />)}
        </ol>
      )}
    </section>
  );
}
