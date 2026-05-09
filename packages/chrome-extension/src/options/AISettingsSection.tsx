import { useEffect, useState } from 'react';
import { callAI, DEFAULT_MODELS, type AIProvider } from '@nowforge/core';

const KEYS = {
  provider: 'nowforge_ai_provider',
  apiKey: 'nowforge_ai_api_key',
  model: 'nowforge_ai_model',
};

export function AISettingsSection() {
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([KEYS.provider, KEYS.apiKey, KEYS.model], (r) => {
      const p = (r[KEYS.provider] as AIProvider | undefined) ?? 'anthropic';
      setProvider(p);
      setApiKey((r[KEYS.apiKey] as string | undefined) ?? '');
      setModel((r[KEYS.model] as string | undefined) ?? DEFAULT_MODELS[p]);
    });
  }, []);

  const onProviderChange = (next: AIProvider): void => {
    setProvider(next);
    setModel(DEFAULT_MODELS[next]);
  };

  const save = async (): Promise<void> => {
    await chrome.storage.local.set({
      [KEYS.provider]: provider,
      [KEYS.apiKey]: apiKey.trim(),
      [KEYS.model]: model.trim(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const testConnection = async (): Promise<void> => {
    if (!apiKey.trim()) {
      setTestStatus('fail');
      setTestMessage('Enter an API key first.');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    const res = await callAI({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      userPrompt: 'Reply with a single word: OK',
      maxTokens: 8,
    });
    if (res.ok) {
      setTestStatus('ok');
      setTestMessage(res.text.trim().slice(0, 40));
    } else {
      setTestStatus('fail');
      setTestMessage(res.error ?? 'Unknown error');
    }
  };

  return (
    <section className="options__section">
      <div className="section-header">
        <div>
          <h2 className="section-heading">AI Assistant (BYOK)</h2>
          <p className="section-desc">
            Bring your own Anthropic or OpenAI API key. The key is stored in chrome.storage.local
            and is sent only to the provider you choose. NowForge does not proxy or log requests.
          </p>
        </div>
      </div>

      <div className="ai-settings">
        <label className="ai-settings__row">
          <span className="ai-settings__label">Provider</span>
          <select
            className="select"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as AIProvider)}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </label>

        <label className="ai-settings__row">
          <span className="ai-settings__label">Model</span>
          <input
            type="text"
            className="input input--mono"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODELS[provider]}
          />
        </label>

        <label className="ai-settings__row">
          <span className="ai-settings__label">API key</span>
          <input
            type="password"
            className="input input--mono"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
            autoComplete="off"
          />
        </label>

        <div className="ai-settings__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void testConnection()}
            disabled={testStatus === 'testing' || !apiKey.trim()}
          >
            {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void save()}
          >
            {saved ? '✓ Saved' : 'Save AI settings'}
          </button>
        </div>

        {testStatus === 'ok' && <div className="ai-settings__ok">✓ Connected — got "{testMessage}"</div>}
        {testStatus === 'fail' && <div className="ai-settings__err">✗ {testMessage}</div>}
      </div>
    </section>
  );
}
