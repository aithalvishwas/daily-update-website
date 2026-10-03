import { useEffect, useRef } from 'react';
import { HEALTH } from '../format.js';
import Avatar from './Avatar.jsx';

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function HealthBadge({ health }) {
  const h = HEALTH[health] ?? HEALTH.on_track;
  return <Badge tone={h.tone}>{h.label}</Badge>;
}

export function Progress({ value, expected, tone = 'blue' }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill fill-${tone}`} style={{ width: `${value}%` }} />
      {expected !== undefined && expected > 0 && expected < 100 && (
        <div className="progress-marker" style={{ left: `${expected}%` }} title={`Expected by today: ${expected}%`} />
      )}
    </div>
  );
}

export function MemberStack({ members, max = 4 }) {
  const shown = members.slice(0, max);
  return (
    <span className="member-stack" title={members.map((m) => m.userName).join(', ')}>
      {shown.map((m) => (
        <Avatar key={m.userId} name={m.userName} size={28} />
      ))}
      {members.length > max && <span className="member-more">+{members.length - max}</span>}
      {members.length === 0 && <span className="muted small">No one yet</span>}
    </span>
  );
}

export function Stat({ label, value, hint, tone = 'blue', icon }) {
  return (
    <div className="stat">
      <span className={`stat-icon icon-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Skeleton({ height = 120 }) {
  return <div className="skeleton" style={{ height }} />;
}

const TYPE = {
  blocker: { label: 'Blocker', tone: 'red' },
  deadline: { label: 'Deadline', tone: 'amber' },
  other: { label: 'Question', tone: 'gray' },
};

export function IssueType({ type }) {
  const t = TYPE[type] ?? TYPE.other;
  return <Badge tone={t.tone}>{t.label}</Badge>;
}

const REQUEST = {
  pending: { label: 'Pending', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Declined', tone: 'red' },
  alternative: { label: 'Alternative suggested', tone: 'blue' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

export function RequestStatus({ status }) {
  const s = REQUEST[status] ?? REQUEST.pending;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
