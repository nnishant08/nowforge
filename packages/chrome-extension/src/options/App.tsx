import { useEffect, useState } from 'react';
import { detectEnvironmentType } from '@nowforge/core';
import type { EnvironmentType } from '@nowforge/core';
import {
  DEFAULT_SETTINGS as DEFAULT_F1,
  type Feature1Settings,
  type CustomRule,
  type TagCorner,
  getSettings as getFeature1Settings,
  saveSettings as saveFeature1Settings,
} from '../shared/settings.js';
import { AISettingsSection } from './AISettingsSection.js';
import './App.css';

// ── Existing per-instance config (kept from Phase 1) ────────────────────────

export interface InstanceConfig {
  id: string;
  name: string;
  url: string;
  environmentType: EnvironmentType;
  color: string;
}

export interface AppSettings {
  instances: InstanceConfig[];
  theme: 'light' | 'dark' | 'system';
}

const DEFAULT_INSTANCE_SETTINGS: AppSettings = { instances: [], theme: 'system' };
const INSTANCE_SETTINGS_KEY = 'nowforge_settings';

const generateId = () => Math.random().toString(36).slice(2, 10);
const normalizeUrl = (url: string) => {
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed && !trimmed.startsWith('http')) return `https://${trimmed}`;
  return trimmed;
};

// ── Subcomponents ────────────────────────────────────────────────────────────

function InstanceRow({
  instance, onUpdate, onDelete,
}: {
  instance: InstanceConfig;
  onUpdate: (updated: InstanceConfig) => void;
  onDelete: () => void;
}) {
  const autoDetect = () => {
    try {
      const url = new URL(normalizeUrl(instance.url));
      const host = url.hostname.replace('.service-now.com', '');
      const envType = detectEnvironmentType(host);
      onUpdate({ ...instance, environmentType: envType });
    } catch { /* bad URL */ }
  };
  return (
    <div className="instance-row">
      <div className="instance-row__color-dot" style={{ background: instance.color }} />
      <div className="instance-row__fields">
        <input className="input" placeholder="Name (e.g. My Dev Instance)"
          value={instance.name}
          onChange={(e) => onUpdate({ ...instance, name: e.target.value })} />
        <input className="input input--mono" placeholder="URL (e.g. https://mydev.service-now.com)"
          value={instance.url}
          onChange={(e) => onUpdate({ ...instance, url: e.target.value })} />
        <div className="instance-row__bottom">
          <select className="select" value={instance.environmentType}
            onChange={(e) => onUpdate({ ...instance, environmentType: e.target.value as EnvironmentType })}>
            <option value="dev">Dev</option><option value="test">Test</option>
            <option value="uat">UAT</option><option value="staging">Staging</option>
            <option value="prod">Prod</option><option value="unknown">Unknown</option>
          </select>
          <input type="color" className="color-input" value={instance.color}
            onChange={(e) => onUpdate({ ...instance, color: e.target.value })} title="Badge color" />
          <button className="btn btn--secondary btn--sm" onClick={autoDetect}>Auto-detect</button>
          <button className="btn btn--danger btn--sm" onClick={onDelete}>Remove</button>
        </div>
      </div>
    </div>
  );
}

function CustomRuleRow({
  rule, envColors, onUpdate, onDelete,
}: {
  rule: CustomRule;
  envColors: Feature1Settings['envColors'];
  onUpdate: (r: CustomRule) => void;
  onDelete: () => void;
}) {
  let regexValid = true;
  try { new RegExp(rule.pattern); } catch { regexValid = false; }

  return (
    <div className="rule-row">
      <input
        className={`input input--mono ${!regexValid ? 'input--error' : ''}`}
        placeholder="Pattern (regex, e.g. ^acme-uat\d+$)"
        value={rule.pattern}
        onChange={(e) => onUpdate({ ...rule, pattern: e.target.value })}
      />
      <select className="select" value={rule.envType}
        onChange={(e) => onUpdate({ ...rule, envType: e.target.value as EnvironmentType })}>
        <option value="dev">Dev</option><option value="test">Test</option>
        <option value="uat">UAT</option><option value="staging">Staging</option>
        <option value="prod">Prod</option><option value="unknown">Unknown</option>
      </select>
      <input className="input input--sm" placeholder="Label (optional)"
        value={rule.label ?? ''}
        onChange={(e) => onUpdate({ ...rule, label: e.target.value || undefined })} />
      <input type="color" className="color-input"
        value={rule.color ?? envColors[rule.envType]}
        onChange={(e) => onUpdate({ ...rule, color: e.target.value })} title="Override color" />
      <button className="btn btn--danger btn--sm" onClick={onDelete}>Remove</button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [instanceSettings, setInstanceSettings] = useState<AppSettings>(DEFAULT_INSTANCE_SETTINGS);
  const [f1, setF1] = useState<Feature1Settings>(DEFAULT_F1);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      new Promise<AppSettings>((resolve) => {
        chrome.storage.sync.get(INSTANCE_SETTINGS_KEY, (r) =>
          resolve((r[INSTANCE_SETTINGS_KEY] as AppSettings) ?? DEFAULT_INSTANCE_SETTINGS));
      }),
      getFeature1Settings(),
    ]).then(([inst, feat]) => {
      setInstanceSettings(inst);
      setF1(feat);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    const normalizedInstances = {
      ...instanceSettings,
      instances: instanceSettings.instances.map((i) => ({ ...i, url: normalizeUrl(i.url) })),
    };
    await new Promise<void>((resolve) =>
      chrome.storage.sync.set({ [INSTANCE_SETTINGS_KEY]: normalizedInstances }, () => resolve()));
    await saveFeature1Settings(f1);
    setInstanceSettings(normalizedInstances);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Instance list helpers
  const addInstance = () => setInstanceSettings((s) => ({
    ...s,
    instances: [...s.instances, {
      id: generateId(), name: '', url: '',
      environmentType: 'unknown', color: f1.envColors.unknown,
    }],
  }));
  const updateInstance = (id: string, updated: InstanceConfig) =>
    setInstanceSettings((s) => ({ ...s, instances: s.instances.map((i) => i.id === id ? updated : i) }));
  const deleteInstance = (id: string) =>
    setInstanceSettings((s) => ({ ...s, instances: s.instances.filter((i) => i.id !== id) }));

  // ── Custom rule helpers
  const addRule = () => setF1((s) => ({
    ...s,
    customRules: [...s.customRules, {
      id: generateId(), pattern: '', envType: 'dev',
    }],
  }));
  const updateRule = (id: string, r: CustomRule) =>
    setF1((s) => ({ ...s, customRules: s.customRules.map((x) => x.id === id ? r : x) }));
  const deleteRule = (id: string) =>
    setF1((s) => ({ ...s, customRules: s.customRules.filter((x) => x.id !== id) }));

  if (loading) {
    return <div className="options-loading"><div className="loading__spinner" /></div>;
  }

  return (
    <div className="options">
      <header className="options__header">
        <div className="options__logo">
          <span className="logo-mark">NF</span>
          <div>
            <h1 className="options__title">NowForge</h1>
            <p className="options__subtitle">Developer Tools for ServiceNow</p>
          </div>
        </div>
      </header>

      <main className="options__body">
        {/* ── Features ── */}
        <section className="options__section">
          <div className="section-header">
            <div>
              <h2 className="section-heading">Features</h2>
              <p className="section-desc">Toggle individual NowForge features on or off.</p>
            </div>
          </div>
          <div className="toggle-list">
            {([
              ['faviconBadge', 'Favicon badge', 'Replace the tab icon with a colored circle showing the instance initials.'],
              ['instanceTag', 'Instance tag', 'Floating, expandable badge showing the instance name and environment.'],
              ['tabTitlePrefix', 'Tab title prefix', 'Prepend [DEV], [PROD], etc. to the browser tab title.'],
              ['fieldTooltips', 'Field tooltips', 'Show the technical field name when hovering over field labels.'],
            ] as const).map(([key, title, desc]) => (
              <label key={key} className="toggle-row">
                <input type="checkbox" checked={f1.features[key]}
                  onChange={(e) => setF1((s) => ({ ...s, features: { ...s.features, [key]: e.target.checked } }))} />
                <span className="toggle-row__main">
                  <span className="toggle-row__title">{title}</span>
                  <span className="toggle-row__desc">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* ── Environment colors ── */}
        <section className="options__section">
          <div className="section-header">
            <div>
              <h2 className="section-heading">Environment colors</h2>
              <p className="section-desc">Customize the color used for each environment type across the favicon, tag, and toolbar icon.</p>
            </div>
            <button className="btn btn--secondary btn--sm"
              onClick={() => setF1((s) => ({ ...s, envColors: DEFAULT_F1.envColors }))}>
              Reset
            </button>
          </div>
          <div className="env-colors">
            {(Object.entries(f1.envColors) as Array<[EnvironmentType, string]>).map(([env, color]) => (
              <div key={env} className="env-color">
                <div className="env-color__swatch" style={{ background: color }}>
                  {env.toUpperCase()}
                </div>
                <input type="color" className="color-input"
                  value={color}
                  onChange={(e) => setF1((s) => ({ ...s, envColors: { ...s.envColors, [env]: e.target.value } }))} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Tag position ── */}
        <section className="options__section">
          <div className="section-header">
            <div>
              <h2 className="section-heading">Instance tag position</h2>
              <p className="section-desc">Default screen corner for the floating tag. (You can also drag it anywhere on the page — that overrides this until you reset.)</p>
            </div>
          </div>
          <div className="corner-grid">
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as TagCorner[]).map((c) => (
              <label key={c} className={`corner-cell${f1.tagPosition === c ? ' corner-cell--active' : ''}`}>
                <input type="radio" name="corner" value={c}
                  checked={f1.tagPosition === c}
                  onChange={() => setF1((s) => ({ ...s, tagPosition: c }))} />
                <span>{c.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ── Custom rules ── */}
        <section className="options__section">
          <div className="section-header">
            <div>
              <h2 className="section-heading">Custom rules</h2>
              <p className="section-desc">Override env detection with your own regex patterns. The first matching rule wins; if none match, the built-in keyword detection is used.</p>
            </div>
            <button className="btn btn--primary" onClick={addRule}>+ Add Rule</button>
          </div>
          {f1.customRules.length === 0 ? (
            <div className="empty-block">No custom rules. Built-in detection ({'`dev`'}, {'`test`'}, {'`uat`'}, {'`staging`'}) will apply to instance names.</div>
          ) : (
            <div className="rules-list">
              {f1.customRules.map((r) => (
                <CustomRuleRow key={r.id} rule={r} envColors={f1.envColors}
                  onUpdate={(u) => updateRule(r.id, u)} onDelete={() => deleteRule(r.id)} />
              ))}
            </div>
          )}
        </section>

        {/* ── Instances (Phase 1, kept) ── */}
        <section className="options__section">
          <div className="section-header">
            <div>
              <h2 className="section-heading">Instances</h2>
              <p className="section-desc">Configure known ServiceNow instances. Auto-detected on visit; add custom labels/colors here.</p>
            </div>
            <button className="btn btn--primary" onClick={addInstance}>+ Add Instance</button>
          </div>
          {instanceSettings.instances.length === 0 ? (
            <div className="empty-block">No instances configured. They'll auto-populate as you browse SN sites.</div>
          ) : (
            <div className="instances-list">
              {instanceSettings.instances.map((inst) => (
                <InstanceRow key={inst.id} instance={inst}
                  onUpdate={(u) => updateInstance(inst.id, u)} onDelete={() => deleteInstance(inst.id)} />
              ))}
            </div>
          )}
        </section>

        {/* ── AI Assistant (BYOK) ── */}
        <AISettingsSection />

        {/* ── Appearance ── */}
        <section className="options__section">
          <div className="section-header">
            <div>
              <h2 className="section-heading">Appearance</h2>
              <p className="section-desc">Theme for popup and side panel.</p>
            </div>
          </div>
          <div className="theme-options">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <label key={t} className={`theme-option${instanceSettings.theme === t ? ' theme-option--active' : ''}`}>
                <input type="radio" name="theme" value={t}
                  checked={instanceSettings.theme === t}
                  onChange={() => setInstanceSettings((s) => ({ ...s, theme: t }))} />
                <span className="theme-option__label">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
              </label>
            ))}
          </div>
        </section>
      </main>

      <footer className="options__footer">
        <span className="options__version">NowForge v0.1.0</span>
        <button className="btn btn--primary" onClick={() => void save()}>{saved ? '✓ Saved' : 'Save Settings'}</button>
      </footer>
    </div>
  );
}
