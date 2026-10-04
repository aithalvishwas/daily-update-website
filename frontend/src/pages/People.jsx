import { lazy, Suspense, useMemo, useState } from 'react';
import { api } from '../api.js';
import { daysBetween, formatDate, localToday, ROLE_LABEL } from '../format.js';
import { useLoad } from '../hooks.js';
import { navigate } from '../router.js';
import { AttachmentIds } from '../components/Attachments.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import SummaryText from '../components/SummaryText.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, HealthBadge, Modal, Skeleton, Stat } from '../components/ui.jsx';
import { useWorkCalendar, useWorkplace, workCalendar } from '../workplace.js';

const ThinkingOrb = lazy(() => import('../components/ThinkingOrb.jsx'));

function lastUpdate(overview, today, work) {
  if (!overview?.lastLogDate) return { label: 'No updates yet', tone: 'gray' };
  const ago = daysBetween(overview.lastLogDate, today);
  // Days off (holidays, and weekends in a Mon–Fri week) don't count against anyone.
  const missed = work.missed(overview.lastLogDate, today);
  const tone = missed <= 1 ? 'green' : missed <= 3 ? 'amber' : 'gray';
  if (ago <= 0) return { label: 'Today', tone };
  if (ago === 1) return { label: 'Yesterday', tone };
  if (ago < 7) return { label: formatDate(overview.lastLogDate, { weekday: 'long' }), tone };
  return { label: formatDate(overview.lastLogDate, { month: 'short', day: 'numeric' }), tone };
}

function PersonForm({ token, person, teams, onClose, onSaved }) {
  const toast = useToast();
  const { offices } = useWorkplace();
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      if (person) {
        await api(`/api/users/${person.id}`, { method: 'PATCH', token, body: { team: body.team, position: body.position, role: body.role } });
        toast(body.role !== person.role ? `${person.name} is now a ${body.role}` : 'Saved', 'success');
      } else {
        await api('/api/users', { method: 'POST', token, body });
        toast(`Account created for ${body.name}`, 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={person ? `Edit ${person.name}` : 'Add a person'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!person && (
          <>
            <label>
              Full name
              <input name="name" maxLength={100} required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
          </>
        )}
        {!person && (
          <label>
            <span>
              Office <span className="optional">sets their holidays</span>
            </span>
            <select name="office" defaultValue="">
              <option value="">Not set</option>
              {offices.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        )}
        <div className="form-grid">
          <label>
            Team
            <input name="team" list="people-teams" defaultValue={person?.team ?? ''} maxLength={100} placeholder="e.g. Infinity" />
            <datalist id="people-teams">
              {teams.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </label>
          <label>
            Position
            <input name="position" defaultValue={person?.position ?? ''} maxLength={100} placeholder="e.g. Senior Engineer" />
          </label>
        </div>
        <label>
          Access
          <select name="role" defaultValue={person?.role ?? 'employee'}>
            <option value="employee">Employee: logs their own work</option>
            <option value="manager">Manager: sees the whole team</option>
          </select>
        </label>
        {!person && (
          <label>
            Temporary password
            <input name="password" type="password" minLength={8} maxLength={128} required />
          </label>
        )}
        {person && <p className="muted small">Promoted or moved teams? Update the position and team here; they apply right away.</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : person ? 'Save' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TeamsCard({ token, teams, onChanged }) {
  const toast = useToast();
  const [name, setName] = useState('');
  async function add(e) {
    e.preventDefault();
    try {
      await api('/api/teams', { method: 'POST', token, body: { name } });
      setName('');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">Teams</h2>
      <ul className="team-list">
        {teams.map((t) => (
          <li key={t.id}>
            <span className="team-swatch" aria-hidden="true" />
            <span className="grow">{t.name}</span>
            <span className="muted small">
              {t.memberCount} {t.memberCount === 1 ? 'person' : 'people'}
            </span>
          </li>
        ))}
        {teams.length === 0 && <li className="muted small">No teams yet.</li>}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name" maxLength={100} required aria-label="New team name" />
        <button type="submit" className="btn btn-light btn-sm">
          Add
        </button>
      </form>
    </section>
  );
}

function PersonDetail({ token, id }) {
  const toast = useToast();
  const [person] = useLoad(() => api(`/api/users/${id}`, { token }).then((d) => d.user), [id, token]);
  const [logs] = useLoad(() => api(`/api/logs/user/${id}`, { token }).then((d) => d.logs), [id, token]);
  const [epics] = useLoad(() => api('/api/epics', { token }).then((d) => d.epics.filter((e) => e.members.some((m) => m.userId === Number(id)))), [id, token]);
  const [summary, setSummary] = useState(undefined);
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  useLoad(() => api(`/api/summaries/${id}`, { token }).then((d) => setSummary(d.summary)), [id, token]);

  async function generate() {
    setGenerating(true);
    try {
      const data = await api(`/api/summaries/${id}`, { method: 'POST', token, body: { days } });
      setSummary(data.summary);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  const work = useWorkCalendar(person?.office ?? null);
  const workdays = work.workdays(localToday());
  const weekLogs = (logs ?? []).filter((l) => work.weekDays(localToday()).includes(l.workDate));
  const hours = weekLogs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const blockers = (logs ?? []).filter((l) => l.blockers).length;

  if (!person) return <Skeleton height={300} />;
  const first = person.name.split(' ')[0];

  return (
    <div className="stack">
      <a href="#/people" className="back-link">
        <Icon name="chevronLeft" size={16} /> All people
      </a>
      <div className="profile-head card">
        <Avatar name={person.name} size={64} />
        <div className="grow">
          <h1>{person.name}</h1>
          <p className="muted">{[person.position, person.team && `Team ${person.team}`, person.office, person.email].filter(Boolean).join(' · ')}</p>
        </div>
        <Badge tone={person.role === 'employee' ? 'gray' : 'purple'}>{ROLE_LABEL[person.role]}</Badge>
      </div>

      <div className="stats-row">
        <Stat label="Workdays logged this week" value={`${weekLogs.filter((l) => workdays.includes(l.workDate)).length}/${workdays.length}`} tone="blue" icon={<Icon name="calendar" />} />
        <Stat label="Hours this week" value={Math.round(hours * 10) / 10} tone="green" icon={<Icon name="clock" />} />
        <Stat label="Epics" value={epics?.length ?? '–'} tone="purple" icon={<Icon name="epics" />} />
        <Stat label="Blockers (30 days)" value={blockers} tone="red" icon={<Icon name="alert" />} />
      </div>

      <div className="grid-main-side">
        <div className="stack">
          <section className="card summary-card">
            <div className="card-head">
              <h2>
                <Icon name="spark" /> AI summary
              </h2>
              <div className="summary-actions">
                <div className="tabs small" role="radiogroup" aria-label="Summary period">
                  {[7, 14, 30].map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                      {d} days
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" type="button" onClick={generate} disabled={generating}>
                  {generating ? 'Summarizing…' : 'Generate'}
                </button>
              </div>
            </div>
            {generating ? (
              <div className="thinking">
                <Suspense fallback={<div className="thinking-orb" />}>
                  <ThinkingOrb />
                </Suspense>
                <p className="muted">Reading {first}'s updates and writing a summary…</p>
              </div>
            ) : summary ? (
              <>
                <p className="summary-meta">
                  {summary.source === 'ai' ? 'AI summary' : 'Basic summary (AI key not configured)'} of {summary.logCount} update
                  {summary.logCount === 1 ? '' : 's'}, {formatDate(summary.periodFrom)} to {formatDate(summary.periodTo)} · generated {new Date(summary.createdAt).toLocaleString()}
                </p>
                <SummaryText text={summary.summary} />
              </>
            ) : summary === null ? (
              <p className="muted">No summary yet. Pick a period and press Generate to see what {first} has been working on.</p>
            ) : (
              <Skeleton height={80} />
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Daily updates</h2>
              <span className="muted small">Last 30 days</span>
            </div>
            {logs === null ? (
              <Skeleton />
            ) : logs.length === 0 ? (
              <p className="muted">No updates in the last 30 days.</p>
            ) : (
              <ul className="feed">
                {logs.map((l) => (
                  <li key={l.id} className="feed-item">
                    <span className="feed-date">
                      <strong>{formatDate(l.workDate, { day: 'numeric' })}</strong>
                      <span>{formatDate(l.workDate, { month: 'short' })}</span>
                    </span>
                    <div className="feed-body">
                      <div className="feed-head">
                        <span className="muted small">{formatDate(l.workDate, { weekday: 'long' })}</span>
                        {l.hours != null && <span className="muted small">· {Number(l.hours)} h</span>}
                        {l.epicName && <Badge tone="blue">{l.epicName}</Badge>}
                      </div>
                      <p className="pre">{l.tasks}</p>
                      {l.blockers && (
                        <p className="blocker-line pre">
                          <Badge tone="red">Blocker</Badge> {l.blockers}
                        </p>
                      )}
                      <AttachmentIds token={token} ids={l.attachmentIds} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card">
          <h2 className="card-title">Epics</h2>
          {epics === null ? (
            <Skeleton height={60} />
          ) : epics.length === 0 ? (
            <p className="muted small">{first} is not on any epic.</p>
          ) : (
            <ul className="mini-list">
              {epics.map((e) => (
                <li key={e.id}>
                  <a href={`#/epics/${e.id}`}>{e.name}</a>
                  <span className="mini-list-meta">
                    <span className="muted small">{e.progress}%</span>
                    <HealthBadge health={e.health} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function People({ token, id }) {
  const [people, reload] = useLoad(() => api('/api/users?all=true', { token }).then((d) => d.users), [token]);
  const [teams, reloadTeams] = useLoad(() => api('/api/teams', { token }).then((d) => d.teams), [token]);
  const [overview] = useLoad(() => api('/api/logs/overview', { token }).then((d) => new Map(d.overview.map((o) => [o.userId, o]))), [token]);
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  const [editing, setEditing] = useState(null);
  const today = localToday();
  const workplace = useWorkplace();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter(
      (p) => (!team || p.team === team) && [p.name, p.email, p.team ?? '', p.position ?? ''].some((v) => v.toLowerCase().includes(q)),
    );
  }, [people, query, team]);

  if (id) return <PersonDetail key={id} token={token} id={id} />;

  const refresh = () => {
    setEditing(null);
    reload();
    reloadTeams();
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p className="muted">Everyone on the team, their position and team. Open someone to read their AI summary.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Add person
        </button>
      </div>

      <div className="grid-main-side">
        <section className="card card-flush">
          <div className="card-head padded toolbar">
            <input type="search" placeholder="Search name, position, team or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search people" />
            <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Filter by team">
              <option value="">All teams</option>
              {(teams ?? []).map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {people === null ? (
            <Skeleton />
          ) : shown.length === 0 ? (
            <Empty title={query || team ? 'No matches' : 'No one here yet'}>{query || team ? null : 'Add people, or let them sign up.'}</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Team</th>
                    <th>Office</th>
                    <th>Last update</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const last = lastUpdate(overview?.get(p.id), today, workCalendar(workplace, p.office));
                    return (
                      <tr key={p.id} className="row-link" onClick={() => navigate(`/people/${p.id}`)}>
                        <td>
                          <span className="person-cell">
                            <Avatar name={p.name} size={34} />
                            <span>
                              <a href={`#/people/${p.id}`} className="cell-title" onClick={(e) => e.stopPropagation()}>
                                {p.name}
                              </a>
                              <span className="cell-sub">{p.email}</span>
                            </span>
                          </span>
                        </td>
                        <td>
                          {p.position || <span className="muted">—</span>}
                          {p.role !== 'employee' && (
                            <>
                              {' '}
                              <Badge tone="purple">{ROLE_LABEL[p.role]}</Badge>
                            </>
                          )}
                        </td>
                        <td>{p.team ? <Badge tone="blue">{p.team}</Badge> : <span className="muted">—</span>}</td>
                        <td>{p.office || <span className="muted">—</span>}</td>
                        <td>
                          <span className={`dot-label dot-${last.tone}`}>{last.label}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-light btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(p);
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {teams && <TeamsCard token={token} teams={teams} onChanged={reloadTeams} />}
      </div>

      {editing && <PersonForm token={token} person={editing === 'new' ? null : editing} teams={teams ?? []} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}
