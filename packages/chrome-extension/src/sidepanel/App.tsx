import { useState } from 'react';
import './App.css';

type TabId = 'scripts' | 'updates' | 'debug';

const TABS: { id: TabId; label: string }[] = [
  { id: 'scripts', label: 'Scripts' },
  { id: 'updates', label: 'Updates' },
  { id: 'debug', label: 'Debug' },
];

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon__icon">🚧</div>
      <p className="coming-soon__title">{title}</p>
      <p className="coming-soon__subtitle">This feature is coming in a future release.</p>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('scripts');

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

      <main className="sidepanel__body">
        {activeTab === 'scripts' && <ComingSoon title="Script Browser" />}
        {activeTab === 'updates' && <ComingSoon title="Update Set Inspector" />}
        {activeTab === 'debug' && <ComingSoon title="Debug Console" />}
      </main>
    </div>
  );
}
