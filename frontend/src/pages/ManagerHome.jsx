import { api } from '../api.js';
import { formatDate, localToday, timeAgo } from '../format.js';
import { useWorkCalendar } from '../workplace.js';
import { useLoad } from '../hooks.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Empty, IssueType, Skeleton, Stat } from '../components/ui.jsx';
import { EpicTable } from './Epics.jsx';

const RISK = { overdue: 0, at_risk: 1, on_track: 2, done: 3 };

export default function ManagerHome({ token, user }) {
  const today = localToday();
  const work = useWorkCalendar();
  const [data] = useLoad(async () => {
    const [epics, issues, requests, people, overview] = await Promise.all([
      api('/api/epics', { token }),
      api('/api/issues?status=open', { token }),
      api('/api/weekend-requests', { token }),
      api('/api/users', { token }),
      api('/api/logs/overview', { token }),
    ]);
    return {
      epics: epics.epics,
      issues: issues.issues,
      requests: requests.requests.filter((r) => r.status === 'pending'),
      people: people.users,
      overview: new Map(overview.overview.map((o) => [o.userId, o])),
    };
  }, [token]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!data) {
    return (
      <div className="stack">
        <Skeleton height={60} />
        <Skeleton height={100} />
        <Skeleton height={300} />
      </div>
    );
  }

  const active = data.epics.filter((e) => e.health !== 'done');
  const onTrack = active.filter((e) => e.health === 'on_track').length;
  const atRisk = active.filter((e) => e.health === 'at_risk').length;
  const overdue = active.filter((e) => e.health === 'overdue').length;
  const blockers = data.issues.filter((i) => i.type === 'blocker').length;
  const updatedToday = data.people.filter((p) => data.overview.get(p.id)?.lastLogDate === today);
  const sorted = [...active].sort((a, b) => RISK[a.health] - RISK[b.health] || a.daysLeft - b.daysLeft);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>
            {greeting}, {user.name.split(' ')[0]}
          </h1>
          <p className="muted">
            {formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}
            {active.length > 0 && ` · ${onTrack} of ${active.length} epics on track`}
          </p>
        </div>
        <a className="btn btn-primary" href="#/epics">
          <Icon name="epics" size={16} /> Manage epics
        </a>
      </div>

      <div className="stats-row">
        <Stat label="Active epics" value={active.length} tone="blue" icon={<Icon name="epics" />} />
        <Stat label="On track" value={onTrack} tone="green" icon={<Icon name="target" />} />
        <Stat label="At risk or overdue" value={atRisk + overdue} hint={overdue ? `${overdue} overdue` : undefined} tone="amber" icon={<Icon name="clock" />} />
        <Stat label="Open blockers" value={blockers} hint={data.issues.length > blockers ? `${data.issues.length - blockers} other issues` : undefined} tone="red" icon={<Icon name="alert" />} />
      </div>

      <div className="grid-main-side">
        <section className="card card-flush">
          <div className="card-head padded">
            <h2>Are we on track?</h2>
            <a href="#/epics" className="small">
              All epics
            </a>
          </div>
          {sorted.length === 0 ? (
            <Empty
              title="No active epics"
              action={
                <a className="btn btn-primary btn-sm" href="#/epics">
                  Create an epic
                </a>
              }
            >
              Add epics with deadlines and people to see their health here.
            </Empty>
          ) : (
            <EpicTable epics={sorted} compact />
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Needs your attention</h2>
              {data.issues.length > 0 && <Badge tone="red">{data.issues.length}</Badge>}
            </div>
            {data.issues.length === 0 ? (
              <p className="muted small">No open blockers or issues. 🎉</p>
            ) : (
              <ul className="alert-list">
                {data.issues.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <a href={`#/issues/${i.id}`} className={`alert-item alert-${i.type}`}>
                      <span className="alert-top">
                        <IssueType type={i.type} />
                        <span className="muted small">{timeAgo(i.lastReplyAt ?? i.createdAt)}</span>
                      </span>
                      <strong>{i.title}</strong>
                      <span className="muted small">
                        {i.raisedByName}
                        {i.epicName && ` · ${i.epicName}`}
                        {i.replyCount === 0 ? ' · no reply yet' : ''}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {data.issues.length > 6 && (
              <a href="#/issues" className="small">
                See all {data.issues.length}
              </a>
            )}
          </section>

          {(work.weekendsOff || data.requests.length > 0) && (
          <section className="card">
            <div className="card-head">
              <h2>Weekend requests</h2>
              <a href="#/requests" className="small">
                Review
              </a>
            </div>
            {data.requests.length === 0 ? (
              <p className="muted small">Nothing waiting for approval.</p>
            ) : (
              <ul className="mini-list">
                {data.requests.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <a href={`#/requests/${r.id}`}>
                      {r.userName}: {r.compensation === 'paid' ? 'overtime pay' : 'comp-off'}
                    </a>
                    <span className="muted small">
                      {formatDate(r.workDate, { weekday: 'short', month: 'short', day: 'numeric' })} · {Number(r.hours)} h
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>Updates today</h2>
              <span className="muted small">
                {work.isWeekendOff(today) ? 'Weekend' : `${updatedToday.length} of ${data.people.length}`}
              </span>
            </div>
            {data.people.length === 0 ? (
              <p className="muted small">
                No employees yet. <a href="#/people">Add people</a>.
              </p>
            ) : (
              <ul className="avatar-grid">
                {data.people.map((p) => {
                  const done = data.overview.get(p.id)?.lastLogDate === today;
                  return (
                    <li key={p.id}>
                      <a href={`#/people/${p.id}`} className={done ? '' : 'faded'} title={`${p.name}${done ? ': updated today' : ': no update yet today'}`}>
                        <Avatar name={p.name} size={34} />
                        {done && <span className="avatar-check" aria-hidden="true">✓</span>}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
