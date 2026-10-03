import { formatDate } from '../format.js';

export default function LogCard({ log, onDelete }) {
  return (
    <li className="log-card">
      <div className="log-card-head">
        <span className="log-date">{formatDate(log.workDate)}</span>
        <div className="log-card-actions">
          {log.hours !== null && log.hours !== undefined && <span className="chip">{Number(log.hours)} h</span>}
          {onDelete && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => onDelete(log)}>
              Delete
            </button>
          )}
        </div>
      </div>
      <p className="pre">{log.tasks}</p>
      {log.blockers && (
        <p className="blocker pre">
          <span className="blocker-label">Blocker</span> {log.blockers}
        </p>
      )}
    </li>
  );
}
