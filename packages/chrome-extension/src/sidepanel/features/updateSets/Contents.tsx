import { useMemo, useState } from 'react';
import type { UpdateXmlEntry } from '../../../shared/messaging.js';

export interface ContentsProps {
  entries: UpdateXmlEntry[];
  loading: boolean;
  error: string | null;
  baseUrl: string | null;
}

interface Group {
  key: string;
  label: string;
  icon: string;
  entries: UpdateXmlEntry[];
}

const GROUP_ORDER: Array<{ label: string; icon: string; matches: (type: string) => boolean }> = [
  { label: 'Business Rules',  icon: '📜', matches: (t) => t === 'Business Rule' },
  { label: 'Client Scripts',  icon: '🖱️', matches: (t) => t === 'Client Script' },
  { label: 'UI Policies',     icon: '🎨', matches: (t) => t.startsWith('UI Policy') },
  { label: 'Script Includes', icon: '🧩', matches: (t) => t === 'Script Include' },
  { label: 'UI Actions',      icon: '🔘', matches: (t) => t === 'UI Action' },
  { label: 'Widgets',         icon: '🧱', matches: (t) => t === 'Widget' },
  { label: 'Properties',      icon: '⚙️', matches: (t) => t === 'System Property' },
];

function groupEntries(entries: UpdateXmlEntry[]): Group[] {
  const buckets = new Map<string, UpdateXmlEntry[]>();
  const otherList: UpdateXmlEntry[] = [];

  outer: for (const e of entries) {
    for (const g of GROUP_ORDER) {
      if (g.matches(e.type)) {
        const arr = buckets.get(g.label) ?? [];
        arr.push(e);
        buckets.set(g.label, arr);
        continue outer;
      }
    }
    otherList.push(e);
  }

  const groups: Group[] = [];
  for (const g of GROUP_ORDER) {
    const arr = buckets.get(g.label);
    if (arr && arr.length) groups.push({ key: g.label, label: g.label, icon: g.icon, entries: arr });
  }
  if (otherList.length) {
    groups.push({ key: 'Other', label: 'Other', icon: '📝', entries: otherList });
  }
  return groups;
}

function actionPill(action: string): { label: string; tone: string } | null {
  if (!action) return null;
  if (action === 'INSERT_OR_UPDATE') return { label: 'change', tone: 'gray' };
  if (action === 'DELETE') return { label: 'delete', tone: 'red' };
  return { label: action.toLowerCase(), tone: 'gray' };
}

export function Contents({ entries, loading, error, baseUrl }: ContentsProps) {
  const [expanded, setExpanded] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => groupEntries(entries), [entries]);

  const toggleGroup = (key: string) => {
    setOpenGroups((o) => ({ ...o, [key]: !o[key] }));
  };

  return (
    <section className="us-contents">
      <button
        type="button"
        className="us-contents__head"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="us-contents__chev" aria-hidden>{expanded ? '▾' : '▸'}</span>
        <span className="us-contents__title">What's in this update set</span>
        <span className="us-contents__count">{entries.length}</span>
      </button>

      {expanded && (
        <div className="us-contents__body">
          {loading ? (
            <div className="us-contents__empty">Loading contents…</div>
          ) : error ? (
            <div className="us-contents__empty us-contents__empty--err">{error}</div>
          ) : entries.length === 0 ? (
            <div className="us-contents__empty">This update set has no changes yet.</div>
          ) : (
            <ul className="us-groups">
              {groups.map((g) => {
                const isOpen = openGroups[g.key] ?? false;
                return (
                  <li key={g.key} className="us-group">
                    <button
                      type="button"
                      className="us-group__head"
                      onClick={() => toggleGroup(g.key)}
                      aria-expanded={isOpen}
                    >
                      <span className="us-group__icon" aria-hidden>{g.icon}</span>
                      <span className="us-group__label">{g.label}</span>
                      <span className="us-group__count">{g.entries.length}</span>
                      <span className="us-group__chev" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                    </button>
                    {isOpen && (
                      <ul className="us-group__list">
                        {g.entries.map((e) => {
                          const ap = actionPill(e.action);
                          const href = baseUrl
                            ? `${baseUrl}/sys_update_xml.do?sys_id=${e.sysId}`
                            : undefined;
                          return (
                            <li key={e.sysId} className="us-group__entry">
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="us-group__link"
                                title={e.name}
                              >
                                <span className="us-group__name">
                                  {e.targetName || e.name}
                                </span>
                                {ap && (
                                  <span className={`us-pill us-pill--${ap.tone}`}>{ap.label}</span>
                                )}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
