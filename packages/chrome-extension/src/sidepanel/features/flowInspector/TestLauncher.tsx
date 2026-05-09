import { useState } from 'react';
import { runTest, getActiveTabBaseUrl } from './api.js';
import { isSysId } from '../../../shared/navigation.js';

export interface TestLauncherProps {
  flowSysId: string;
  triggerTable: string;
  onTestStarted: () => void;
}

interface Input { id: number; key: string; value: string; }

let nextId = 1;

export function TestLauncher({ flowSysId, triggerTable, onTestStarted }: TestLauncherProps) {
  const [open, setOpen] = useState(false);
  const [recordSysId, setRecordSysId] = useState('');
  const [inputs, setInputs] = useState<Input[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean; message: string; fallbackUrl?: string;
  } | null>(null);

  const addInput = () => setInputs((i) => [...i, { id: nextId++, key: '', value: '' }]);
  const updateInput = (id: number, patch: Partial<Input>) =>
    setInputs((i) => i.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeInput = (id: number) => setInputs((i) => i.filter((x) => x.id !== id));

  const sysIdValid = !recordSysId || isSysId(recordSysId);

  const submit = async () => {
    if (!sysIdValid) {
      setLastResult({ ok: false, message: 'Trigger record sys_id is not a 32-char hex string.' });
      return;
    }
    setBusy(true);
    setLastResult(null);
    const res = await runTest(
      flowSysId,
      recordSysId.trim(),
      triggerTable,
      inputs.filter((i) => i.key.trim())
    );
    setBusy(false);

    if (res.ok && !res.error) {
      setLastResult({ ok: true, message: `Started. Context: ${res.contextSysId?.slice(0, 8) ?? ''}…` });
      onTestStarted();
    } else {
      setLastResult({
        ok: false,
        message: res.error ?? 'Could not start test.',
        fallbackUrl: res.fallbackUrl,
      });
    }
  };

  const openFallback = async () => {
    if (!lastResult?.fallbackUrl) return;
    const base = await getActiveTabBaseUrl();
    if (!base) return;
    void chrome.tabs.create({ url: base + lastResult.fallbackUrl });
  };

  return (
    <section className="fl-test">
      <button
        type="button"
        className="fl-test__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="fl-test__chev" aria-hidden>{open ? '▾' : '▸'}</span>
        <span className="fl-test__title">Test This Flow</span>
      </button>

      {open && (
        <div className="fl-test__body">
          <label className="fl-field">
            <span className="fl-field__label">Trigger record (sys_id)</span>
            <input
              type="text"
              value={recordSysId}
              onChange={(e) => setRecordSysId(e.target.value)}
              placeholder={triggerTable ? `${triggerTable} sys_id (optional)` : '32-char hex sys_id (optional)'}
              spellCheck={false}
              autoComplete="off"
              className={!sysIdValid ? 'fl-field__input--err' : ''}
            />
            {triggerTable && (
              <span className="fl-field__hint">
                Table: <code>{triggerTable}</code>
              </span>
            )}
          </label>

          <div className="fl-test__inputs">
            <div className="fl-test__inputs-head">
              <span>Inputs</span>
              <button type="button" className="fl-btn fl-btn--ghost fl-btn--sm" onClick={addInput}>
                + Add
              </button>
            </div>
            {inputs.length === 0 && (
              <div className="fl-test__inputs-empty">No inputs.</div>
            )}
            {inputs.map((i) => (
              <div key={i.id} className="fl-test__input-row">
                <input
                  type="text"
                  placeholder="key"
                  value={i.key}
                  onChange={(e) => updateInput(i.id, { key: e.target.value })}
                  className="fl-test__input-k"
                />
                <input
                  type="text"
                  placeholder="value"
                  value={i.value}
                  onChange={(e) => updateInput(i.id, { value: e.target.value })}
                  className="fl-test__input-v"
                />
                <button
                  type="button"
                  className="fl-btn fl-btn--ghost fl-btn--sm"
                  onClick={() => removeInput(i.id)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="fl-test__actions">
            <button
              type="button"
              className="fl-btn fl-btn--primary"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? 'Running…' : '▶ Run Test'}
            </button>
          </div>

          {lastResult && (
            <div className={`fl-test__result fl-test__result--${lastResult.ok ? 'ok' : 'err'}`}>
              {lastResult.message}
              {lastResult.fallbackUrl && (
                <button
                  type="button"
                  className="fl-btn fl-btn--secondary fl-btn--sm fl-test__fallback"
                  onClick={() => void openFallback()}
                >
                  Open SN test panel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
