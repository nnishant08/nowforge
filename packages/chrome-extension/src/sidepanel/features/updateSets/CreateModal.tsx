import { useEffect, useRef, useState } from 'react';

export interface CreateModalProps {
  defaultAppName: string;
  defaultAppSysId: string;
  onCancel: () => void;
  onSubmit: (name: string, appSysId: string) => Promise<void>;
}

export function CreateModal({
  defaultAppName, defaultAppSysId, onCancel, onSubmit,
}: CreateModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!defaultAppSysId) {
      setError('Could not detect current scope — refresh the SN page and try again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim(), defaultAppSysId);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="us-modal" role="dialog" aria-modal="true">
      <div className="us-modal__sheet">
        <div className="us-modal__head">
          <h2 className="us-modal__title">Create update set</h2>
          <button type="button" className="us-modal__close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <form className="us-modal__body" onSubmit={(e) => void submit(e)}>
          <label className="us-field">
            <span className="us-field__label">Name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PRJ-1234 — incident form tweaks"
              required
              maxLength={120}
            />
          </label>

          <label className="us-field">
            <span className="us-field__label">Scope</span>
            <input
              type="text"
              value={defaultAppName || 'Global'}
              disabled
              title="Scope is taken from the current ServiceNow tab. Switch scope on the SN page first to change."
            />
          </label>

          {error && <div className="us-modal__error">{error}</div>}

          <div className="us-modal__actions">
            <button
              type="button"
              className="us-btn us-btn--secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="us-btn us-btn--primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
