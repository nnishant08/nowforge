import { useEffect, useRef, useState } from 'react';
import { callAI, buildPrompt, DEFAULT_MODELS, type AIAction, type AIProvider } from '@nowforge/core';

const STORAGE_KEYS = {
  provider: 'nowforge_ai_provider',
  apiKey: 'nowforge_ai_api_key',
  model: 'nowforge_ai_model',
};

export interface AIAssistantProps {
  /** Current script in the editor. */
  getScript: () => string;
  /** Optional table context, e.g. from PageContext. */
  table?: string | null;
  /** Optional script type — set when invoked from a known form. */
  scriptType?: string;
  onClose: () => void;
}

interface AIConfig { provider: AIProvider; apiKey: string; model: string; }

async function loadConfig(): Promise<AIConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.provider, STORAGE_KEYS.apiKey, STORAGE_KEYS.model],
      (r) => {
        const provider = (r[STORAGE_KEYS.provider] as AIProvider | undefined) ?? 'anthropic';
        const apiKey = (r[STORAGE_KEYS.apiKey] as string | undefined) ?? '';
        const model = (r[STORAGE_KEYS.model] as string | undefined) ?? DEFAULT_MODELS[provider];
        if (!apiKey) { resolve(null); return; }
        resolve({ provider, apiKey, model });
      }
    );
  });
}

const ACTIONS: Array<{ id: AIAction; label: string; needsScript: boolean }> = [
  { id: 'explain',             label: 'Explain this script',         needsScript: true  },
  { id: 'refactor',            label: 'Refactor this',                needsScript: true  },
  { id: 'generate',            label: 'Generate from description',    needsScript: false },
  { id: 'convertToGlideQuery', label: 'Convert to GlideQuery',        needsScript: true  },
  { id: 'generateAtfTest',     label: 'Generate ATF test',            needsScript: true  },
  { id: 'document',            label: 'Document this',                needsScript: true  },
];

export function AIAssistant({ getScript, table, scriptType, onClose }: AIAssistantProps) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [action, setAction] = useState<AIAction | null>(null);
  const [description, setDescription] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void loadConfig().then((c) => {
      setConfig(c);
      setConfigLoaded(true);
    });
  }, []);

  const run = async (id: AIAction): Promise<void> => {
    if (!config) {
      setError('Set an API key first (Options → AI Assistant).');
      return;
    }
    setAction(id);
    setBusy(true);
    setError(null);
    setOutput('');

    abortRef.current = new AbortController();
    const userPrompt = buildPrompt(id, {
      script: id === 'generate' ? undefined : getScript(),
      description,
      scriptType,
      table: table ?? undefined,
    });

    const res = await callAI({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      userPrompt,
      signal: abortRef.current.signal,
    });

    if (!res.ok) setError(res.error ?? 'AI call failed');
    else setOutput(res.text);
    setBusy(false);
  };

  const cancel = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  if (!configLoaded) {
    return <div className="ai-panel__loading">Loading…</div>;
  }

  if (!config) {
    return (
      <div className="ai-panel">
        <header className="ai-panel__head">
          <h3>AI Assistant</h3>
          <button type="button" className="ai-panel__close" onClick={onClose}>×</button>
        </header>
        <div className="ai-panel__body">
          <p className="ai-panel__notice">
            No API key configured. Open <b>Options → AI Assistant</b>, paste your Claude or
            OpenAI key, and reopen this panel.
          </p>
          <button
            type="button"
            className="ai-panel__primary"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            Open settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-panel">
      <header className="ai-panel__head">
        <h3>AI Assistant</h3>
        <span className="ai-panel__model">{config.model}</span>
        <button type="button" className="ai-panel__close" onClick={onClose}>×</button>
      </header>

      <div className="ai-panel__actions">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ai-panel__action${action === a.id ? ' ai-panel__action--active' : ''}`}
            onClick={() => void run(a.id)}
            disabled={busy}
          >
            {a.label}
          </button>
        ))}
      </div>

      {action === 'generate' && (
        <div className="ai-panel__describe">
          <textarea
            placeholder="Describe what to generate (e.g. 'Business rule that auto-assigns P1 incidents to the on-call group')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      )}

      <div className="ai-panel__body">
        {busy && (
          <div className="ai-panel__busy">
            Generating…
            <button type="button" className="ai-panel__cancel" onClick={cancel}>Cancel</button>
          </div>
        )}
        {error && <div className="ai-panel__error">{error}</div>}
        {output && (
          <div className="ai-panel__output-wrap">
            <button
              type="button"
              className="ai-panel__copy"
              onClick={() => void navigator.clipboard.writeText(output)}
            >
              Copy
            </button>
            <pre className="ai-panel__output">{output}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
