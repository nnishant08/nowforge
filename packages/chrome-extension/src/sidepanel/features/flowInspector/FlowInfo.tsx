import type { FlowInfo as FlowInfoT } from '../../../shared/messaging.js';
import { formatRelativeTime } from '../../../shared/navigation.js';

export interface FlowInfoProps {
  info: FlowInfoT | null;
  loading: boolean;
  error: string | null;
}

export function FlowInfo({ info, loading, error }: FlowInfoProps) {
  if (loading && !info) {
    return <div className="fl-info fl-info--skeleton">Loading flow…</div>;
  }
  if (error && !info) {
    return <div className="fl-info fl-info--err">{error}</div>;
  }
  if (!info) return null;

  const kind =
    info.sysClassName === 'sys_hub_subflow' ? 'Subflow' :
    info.sysClassName === 'sys_hub_action_type_definition' ? 'Action' :
    'Flow';

  return (
    <div className="fl-info">
      <div className="fl-info__top">
        <div>
          <div className="fl-info__kind">{kind}</div>
          <div className="fl-info__name" title={info.name}>{info.name}</div>
        </div>
        <span className={`fl-pill fl-pill--${info.status === 'Active' ? 'green' : 'gray'}`}>
          {info.status}
        </span>
      </div>

      <dl className="fl-info__list">
        {info.triggerTable && (
          <div className="fl-info__row">
            <dt>Table</dt>
            <dd className="fl-info__mono">{info.triggerTable}</dd>
          </div>
        )}
        {info.triggerType && (
          <div className="fl-info__row">
            <dt>Trigger</dt>
            <dd>{info.triggerType}</dd>
          </div>
        )}
        {info.updatedOn > 0 && (
          <div className="fl-info__row">
            <dt>Updated</dt>
            <dd>{formatRelativeTime(info.updatedOn)}</dd>
          </div>
        )}
        {info.internalName && info.internalName !== info.name && (
          <div className="fl-info__row">
            <dt>Internal</dt>
            <dd className="fl-info__mono">{info.internalName}</dd>
          </div>
        )}
      </dl>

      {info.description && (
        <p className="fl-info__desc">{info.description}</p>
      )}
    </div>
  );
}
