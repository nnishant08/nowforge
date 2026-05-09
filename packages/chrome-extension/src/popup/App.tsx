import { useEffect, useState } from 'react';
import type { PageContext } from '../shared/messaging.js';
import type { GetPageContextResponse } from '../shared/messaging.js';
import { getTableDisplayName } from '@nowforge/core';
import './App.css';

function usePageContext() {
  const [context, setContext] = useState<PageContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_PAGE_CONTEXT' })
      .then((res: GetPageContextResponse) => {
        setContext(res?.context ?? null);
      })
      .catch(() => setContext(null))
      .finally(() => setLoading(false));
  }, []);

  return { context, loading };
}

const ENV_LABELS: Record<string, string> = {
  dev: 'DEV',
  test: 'TEST',
  uat: 'UAT',
  staging: 'STAGING',
  prod: 'PROD',
  unknown: '?',
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  form: 'Form',
  list: 'List',
  'ui-builder': 'UI Builder',
  'flow-designer': 'Flow Designer',
  'service-portal': 'Service Portal',
  workspace: 'Workspace',
  other: 'Other',
};

function EnvBadge({ env }: { env: string }) {
  return (
    <span className={`env-badge env-badge--${env}`}>
      {ENV_LABELS[env] ?? env.toUpperCase()}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">⚡</div>
      <p className="empty-state__title">Not on a ServiceNow page</p>
      <p className="empty-state__subtitle">
        Navigate to a ServiceNow instance to see details here.
      </p>
    </div>
  );
}

function QuickLinks({ instanceUrl }: { instanceUrl: string }) {
  const links = [
    { label: 'Studio', path: '/$studio.do' },
    { label: 'Update Sets', path: '/sys_update_set_list.do' },
    { label: 'Script Editor', path: '/sys_script_list.do' },
    { label: 'Flow Designer', path: '/now/flow-designer' },
    { label: 'UI Builder', path: '/now/builder' },
    { label: 'System Logs', path: '/syslog_list.do' },
  ];

  return (
    <section className="quick-links">
      <h2 className="section-title">Quick Links</h2>
      <div className="quick-links__grid">
        {links.map((link) => (
          <a
            key={link.path}
            href={`${instanceUrl}${link.path}`}
            target="_blank"
            rel="noreferrer"
            className="quick-link"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const { context, loading } = usePageContext();

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  const openDiffTool = () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/diff/index.html') });
    window.close();
  };

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id }).catch(() => null);
      }
    });
    window.close();
  };

  return (
    <div className="popup">
      <header className="popup__header">
        <div className="popup__logo">
          <span className="popup__logo-mark">NF</span>
          <span className="popup__logo-text">NowForge</span>
        </div>
        <div className="popup__actions">
          <button className="icon-btn" title="Open Side Panel" onClick={openSidePanel}>
            ◫
          </button>
          <button className="icon-btn" title="Compare Instances" onClick={openDiffTool}>
            ⇄
          </button>
          <button className="icon-btn" title="Settings" onClick={openOptions}>
            ⚙
          </button>
        </div>
      </header>

      <main className="popup__body">
        {loading ? (
          <div className="loading">
            <div className="loading__spinner" />
          </div>
        ) : context?.instanceInfo == null ? (
          <EmptyState />
        ) : (
          <>
            <section className="instance-card">
              <div className="instance-card__row">
                <div className="instance-card__name">
                  {context.instanceInfo.instanceName}
                </div>
                <EnvBadge env={context.instanceInfo.environmentType} />
              </div>
              <div className="instance-card__url">
                {context.instanceInfo.baseUrl}
              </div>
            </section>

            <section className="page-info">
              <h2 className="section-title">Current Page</h2>
              <dl className="info-list">
                <div className="info-list__row">
                  <dt>Type</dt>
                  <dd>{PAGE_TYPE_LABELS[context.pageType] ?? context.pageType}</dd>
                </div>
                {context.tableName && (
                  <div className="info-list__row">
                    <dt>Table</dt>
                    <dd>
                      <span className="code">{context.tableName}</span>
                      <span className="info-list__label">
                        {getTableDisplayName(context.tableName)}
                      </span>
                    </dd>
                  </div>
                )}
                {context.sysId && (
                  <div className="info-list__row">
                    <dt>Sys ID</dt>
                    <dd>
                      <span className="code code--truncate">{context.sysId}</span>
                      <button
                        className="copy-btn"
                        title="Copy sys_id"
                        onClick={() => void navigator.clipboard.writeText(context.sysId!)}
                      >
                        ⎘
                      </button>
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <QuickLinks instanceUrl={context.instanceInfo.baseUrl} />
          </>
        )}
      </main>

      <footer className="popup__footer">
        <span className="popup__version">v0.1.0</span>
      </footer>
    </div>
  );
}
