import { useEffect, useState } from 'react';
import { ScriptRunner } from './features/scriptRunner/ScriptRunner.js';
import { UpdateSetDashboard } from './features/updateSets/UpdateSetDashboard.js';
import { Navigation } from './features/navigation/Navigation.js';
import { DebugRouter } from './features/debug/DebugRouter.js';
import { Pipeline } from './features/pipeline/Pipeline.js';
import { IntegrationWorkbench } from './features/integrations/IntegrationWorkbench.js';
import './features/debug/styles.css';
import './App.css';

type TabId = 'nav' | 'scripts' | 'updates' | 'deploy' | 'rest' | 'debug';

const TABS: { id: TabId; label: string }[] = [
  { id: 'nav', label: 'Nav' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'updates', label: 'Updates' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'rest', label: 'REST' },
  { id: 'debug', label: 'Debug' },
];


export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('nav');

  // When a "pending script" arrives from the right-click → Open in Script
  // Runner menu, auto-switch to the Scripts tab so the user sees it.
  useEffect(() => {
    const onChanged = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && 'nowforge_pending_script' in changes) {
        const next = changes['nowforge_pending_script'].newValue as { ts?: number } | undefined;
        if (next?.ts && Date.now() - next.ts < 30_000) {
          setActiveTab('scripts');
        }
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  return (
    <div className="sidepanel">
      <header className="sidepanel__header">
        <span className="sidepanel__logo-mark">NF</span>
        <span className="sidepanel__title">NowForge</span>
      </header>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-bar__tab${activeTab === tab.id ? ' tab-bar__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="sidepanel__body sidepanel__body--flush">
        {activeTab === 'nav' && <Navigation />}
        {activeTab === 'scripts' && <ScriptRunner />}
        {activeTab === 'updates' && <UpdateSetDashboard />}
        {activeTab === 'deploy' && <Pipeline />}
        {activeTab === 'rest' && <IntegrationWorkbench />}
        {activeTab === 'debug' && <DebugRouter />}
      </main>
    </div>
  );
}
