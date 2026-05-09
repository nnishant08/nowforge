import type { UibComponentDetail, UibProperty } from '../../../shared/messaging.js';

export interface PropertyInspectorProps {
  detail: UibComponentDetail | null;
  loading: boolean;
  reason: string | null;
}

export function PropertyInspector({ detail, loading, reason }: PropertyInspectorProps) {
  if (loading) return <div className="uib-pi__empty">Reading component…</div>;
  if (!detail) return <div className="uib-pi__empty">{reason ?? 'Select a component to inspect.'}</div>;

  return (
    <div className="uib-pi">
      <div className="uib-pi__head">
        <div className="uib-pi__tag">{detail.tag}</div>
        {detail.description && <div className="uib-pi__desc">{detail.description}</div>}
        {detail.version && <div className="uib-pi__version">v{detail.version}</div>}
      </div>

      <Section title="Properties" empty="No properties found.">
        {detail.properties.length > 0 && (
          <PropList items={detail.properties.filter((p) => !p.isBinding)} />
        )}
      </Section>

      <Section title="Data Bindings" empty="No bindings detected.">
        {detail.bindings.length > 0 ? (
          <PropList items={detail.bindings} showBindingArrow />
        ) : (
          <PropList
            items={detail.properties.filter((p) => p.isBinding)}
            showBindingArrow
          />
        )}
      </Section>

      <Section title="Event Handlers" empty="No handlers attached.">
        {detail.eventHandlers.length > 0 && detail.eventHandlers[0].event !== '(none)' ? (
          <ul className="uib-pi__list">
            {detail.eventHandlers.map((h, i) => (
              <li key={i} className="uib-pi__row">
                <span className="uib-pi__k">{h.event}</span>
                <span className="uib-pi__v">→ {h.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}

function Section({
  title, empty, children,
}: { title: string; empty: string; children: React.ReactNode }) {
  // children might be `null` if the caller decided to render nothing —
  // in that case show the empty hint.
  const hasContent = children !== null && children !== false;
  return (
    <div className="uib-pi__section">
      <div className="uib-pi__section-title">{title}</div>
      {hasContent ? children : <div className="uib-pi__empty-row">{empty}</div>}
    </div>
  );
}

function PropList({
  items, showBindingArrow,
}: { items: UibProperty[]; showBindingArrow?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="uib-pi__list">
      {items.map((p, i) => (
        <li key={i} className="uib-pi__row">
          <span className="uib-pi__k">{p.name}</span>
          {showBindingArrow && <span className="uib-pi__arrow">←</span>}
          <span className={`uib-pi__v${p.isBinding ? ' uib-pi__v--binding' : ''}`}>
            {truncate(p.value, 80)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
