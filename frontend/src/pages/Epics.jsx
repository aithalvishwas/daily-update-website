import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDate, localToday } from '../format.js';
import { announceChange, useLoad } from '../hooks.js';
import { navigate } from '../router.js';
import { AttachmentIds } from '../components/Attachments.jsx';
import Avatar from '../components/Avatar.jsx';
import { DatePicker } from '../components/Calendar.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, HealthBadge, IssueType, MemberStack, Modal, Progress, Skeleton } from '../components/ui.jsx';

const FILL = { on_track: 'green', at_risk: 'amber', overdue: 'red', done: 'blue' };

export function deadlineText(epic) {
  if (epic.health === 'done') return 'Completed';
  if (epic.daysLeft < 0) return `${-epic.daysLeft} day${epic.daysLeft === -1 ? '' : 's'} overdue`;
  if (epic.daysLeft === 0) return 'Due today';
  return `${epic.daysLeft} day${epic.daysLeft === 1 ? '' : 's'} left`;
}

export function EpicTable({ epics, compact }) {
  if (epics.length === 0) return null;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Epic</th>
            {!compact && <th>Team</th>}
            <th>People</th>
            <th>Deadline</th>
            <th className="col-progress">Progress</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {epics.map((e) => (
            <tr key={e.id} className="row-link" onClick={() => navigate(`/epics/${e.id}`)}>
              <td>
                <a href={`#/epics/${e.id}`} className="cell-title" onClick={(ev) => ev.stopPropagation()}>
                  {e.name}
                </a>
                {e.openIssues > 0 && (
                  <span className="cell-sub text-red">
                    {e.openIssues} open issue{e.openIssues === 1 ? '' : 's'}
                  </span>
                )}
              </td>
              {!compact && <td>{e.team || <span className="muted">—</span>}</td>}
              <td>
                <MemberStack members={e.members} />
              </td>
              <td>
                <span className="cell-title-plain">{formatDate(e.dueDate, { month: 'short', day: 'numeric' })}</span>
                <span className={`cell-sub ${e.health === 'overdue' ? 'text-red' : ''}`}>{deadlineText(e)}</span>
              </td>
              <td className="col-progress">
                <div className="progress-cell">
                  <Progress value={e.progress} expected={e.health === 'done' ? undefined : e.expectedProgress} tone={FILL[e.health]} />
                  <span className="progress-num">{e.progress}%</span>
                </div>
              </td>
              <td>
                <HealthBadge health={e.health} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EpicForm({ token, epic, onClose, onSaved }) {
  const toast = useToast();
  const [people] = useLoad(() => api('/api/users', { token }).then((d) => d.users), [token]);
  const [teams] = useLoad(() => api('/api/teams', { token }).then((d) => d.teams), [token]);
  const [form, setForm] = useState({
    name: epic?.name ?? '',
    description: epic?.description ?? '',
    team: epic?.team ?? '',
    startDate: epic?.startDate ?? localToday(),
    dueDate: epic?.dueDate ?? '',
    status: epic?.status ?? 'planned',
    progress: epic?.progress ?? 0,
    memberIds: epic?.members.map((m) => m.userId) ?? [],
  });
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target ? e.target.value : e }));

  function toggle(id) {
    setForm((f) => ({ ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id] }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.dueDate) return toast('Pick a deadline', 'error');
    setBusy(true);
    try {
      const body = { ...form, progress: Number(form.progress) };
      const data = epic
        ? await api(`/api/epics/${epic.id}`, { method: 'PUT', token, body })
        : await api('/api/epics', { method: 'POST', token, body });
      toast(epic ? 'Epic updated' : 'Epic created', 'success');
      onSaved(data.epic);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const q = filter.trim().toLowerCase();
  const visible = (people ?? []).filter((p) => [p.name, p.team ?? '', p.position ?? ''].some((v) => v.toLowerCase().includes(q)));

  return (
    <Modal title={epic ? 'Edit epic' : 'New epic'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={form.name} onChange={set('name')} maxLength={150} required placeholder="e.g. Checkout redesign" />
        </label>
        <label>
          <span>
            Description <span className="optional">optional</span>
          </span>
          <textarea rows={3} value={form.description} onChange={set('description')} maxLength={5000} />
        </label>
        <div className="form-grid">
          <label>
            Team
            <input list="team-options" value={form.team} onChange={set('team')} maxLength={100} placeholder="e.g. Infinity" />
            <datalist id="team-options">
              {(teams ?? []).map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </label>
          <DatePicker label="Start" value={form.startDate} onChange={set('startDate')} />
          <DatePicker label="Deadline" value={form.dueDate} onChange={set('dueDate')} min={form.startDate} />
        </div>
        {epic && (
          <div className="form-grid">
            <label>
              Status
              <select value={form.status} onChange={set('status')}>
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label>
              Progress ({form.progress}%)
              <input type="range" min="0" max="100" step="5" value={form.progress} onChange={set('progress')} />
            </label>
          </div>
        )}
        <fieldset className="picker">
          <legend>
            People on this epic <span className="optional">{form.memberIds.length} selected</span>
          </legend>
          <input type="search" placeholder="Search people" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search people" />
          <div className="picker-list">
            {people === null ? (
              <Skeleton height={80} />
            ) : visible.length === 0 ? (
              <p className="muted small">No employees found. Add people on the People page.</p>
            ) : (
              visible.map((p) => (
                <label key={p.id} className="picker-item">
                  <input type="checkbox" checked={form.memberIds.includes(p.id)} onChange={() => toggle(p.id)} />
                  <Avatar name={p.name} size={28} />
                  <span>
                    <strong>{p.name}</strong>
                    <span className="muted small">{[p.position, p.team].filter(Boolean).join(' · ') || 'No team yet'}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </fieldset>
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : epic ? 'Save changes' : 'Create epic'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProgressUpdater({ token, epic, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(epic.progress);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const data = await api(`/api/epics/${epic.id}/progress`, { method: 'PATCH', token, body: { progress: Number(value) } });
      toast('Progress updated', 'success');
      onSaved(data.epic);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="progress-updater">
      <input type="range" min="0" max="100" step="5" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Progress for ${epic.name}`} />
      <span className="progress-num">{value}%</span>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || Number(value) === epic.progress} onClick={save}>
        {busy ? 'Saving…' : 'Update'}
      </button>
    </div>
  );
}

export function EpicCard({ token, epic, onSaved }) {
  return (
    <article className="card epic-card">
      <div className="epic-card-head">
        <a href={`#/epics/${epic.id}`} className="epic-card-title">
          {epic.name}
        </a>
        <HealthBadge health={epic.health} />
      </div>
      <p className="muted small">
        {epic.team ? `${epic.team} · ` : ''}Due {formatDate(epic.dueDate, { month: 'short', day: 'numeric' })} · {deadlineText(epic)}
      </p>
      <Progress value={epic.progress} expected={epic.health === 'done' ? undefined : epic.expectedProgress} tone={FILL[epic.health]} />
      <ProgressUpdater key={epic.progress} token={token} epic={epic} onSaved={onSaved} />
      <div className="epic-card-foot">
        <MemberStack members={epic.members} max={5} />
        {epic.openIssues > 0 && <Badge tone="red">{epic.openIssues} open</Badge>}
      </div>
    </article>
  );
}

function EpicDetail({ token, user, id }) {
  const toast = useToast();
  const manager = user.role === 'manager';
  const [epic, reload] = useLoad(() => api(`/api/epics/${id}`, { token }).then((d) => d.epic), [id, token]);
  const [issues] = useLoad(
    () => api('/api/issues', { token }).then((d) => d.issues.filter((i) => i.epicId === Number(id))),
    [id, token],
  );
  const [logs] = useLoad(
    () =>
      manager
        ? api(`/api/logs/epic/${id}`, { token }).then((d) => d.logs)
        : api('/api/logs/me', { token }).then((d) => d.logs.filter((l) => l.epicId === Number(id))),
    [id, token, manager],
  );
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete the epic "${epic.name}"? Issues stay but lose their link.`)) return;
    try {
      await api(`/api/epics/${id}`, { method: 'DELETE', token });
      toast('Epic deleted', 'success');
      navigate('/epics');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!epic) return <Skeleton height={300} />;

  return (
    <div className="stack">
      <a href="#/epics" className="back-link">
        <Icon name="chevronLeft" size={16} /> All epics
      </a>
      <div className="page-head">
        <div>
          <div className="title-row">
            <h1>{epic.name}</h1>
            <HealthBadge health={epic.health} />
          </div>
          <p className="muted">
            {epic.team ? `${epic.team} · ` : ''}
            {formatDate(epic.startDate, { month: 'short', day: 'numeric' })} to {formatDate(epic.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })} ·{' '}
            {deadlineText(epic)}
          </p>
        </div>
        {manager && (
          <div className="head-actions">
            <button type="button" className="btn btn-light" onClick={remove}>
              Delete
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} /> Edit epic
            </button>
          </div>
        )}
      </div>

      <div className="grid-main-side">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Progress</h2>
              <span className="muted small">
                {epic.progress}% done · {epic.expectedProgress}% of the time used
              </span>
            </div>
            <Progress value={epic.progress} expected={epic.health === 'done' ? undefined : epic.expectedProgress} tone={FILL[epic.health]} />
            {(manager || epic.members.some((m) => m.userId === user.id)) && (
              <ProgressUpdater key={epic.progress} token={token} epic={epic} onSaved={reload} />
            )}
            {epic.description && <p className="pre epic-description">{epic.description}</p>}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Daily updates on this epic</h2>
              <span className="muted small">Last 30 days</span>
            </div>
            {logs === null ? (
              <Skeleton />
            ) : logs.length === 0 ? (
              <p className="muted">No daily updates linked to this epic yet.</p>
            ) : (
              <ul className="feed">
                {logs.map((l) => (
                  <li key={l.id} className="feed-item">
                    <Avatar name={l.userName} size={32} />
                    <div className="feed-body">
                      <div className="feed-head">
                        <strong>{l.userName}</strong>
                        <span className="muted small">{formatDate(l.workDate)}</span>
                        {l.hours != null && <span className="muted small">· {Number(l.hours)} h</span>}
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

        <div className="stack">
          <section className="card">
            <h2 className="card-title">People ({epic.members.length})</h2>
            {epic.members.length === 0 ? (
              <p className="muted small">No one is on this epic yet.</p>
            ) : (
              <ul className="people-list">
                {epic.members.map((m) => (
                  <li key={m.userId}>
                    <Avatar name={m.userName} size={30} />
                    {manager ? <a href={`#/people/${m.userId}`}>{m.userName}</a> : <span>{m.userName}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Issues</h2>
              <a href="#/issues" className="small">
                {manager ? 'All issues' : 'Raise an issue'}
              </a>
            </div>
            {issues === null ? (
              <Skeleton height={60} />
            ) : issues.length === 0 ? (
              <p className="muted small">No issues on this epic.</p>
            ) : (
              <ul className="alert-list">
                {issues.map((i) => (
                  <li key={i.id}>
                    <a href={`#/issues/${i.id}`} className={`alert-item alert-${i.status === 'open' ? i.type : 'done'}`}>
                      <span className="alert-top">
                        <IssueType type={i.type} />
                        {i.status === 'resolved' && <Badge tone="green">Resolved</Badge>}
                      </span>
                      <strong>{i.title}</strong>
                      <span className="muted small">{i.raisedByName}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <EpicForm
          token={token}
          epic={epic}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
            announceChange();
          }}
        />
      )}
    </div>
  );
}

export default function Epics({ token, user, id }) {
  const manager = user.role === 'manager';
  const [epics, reload] = useLoad(() => api('/api/epics', { token }).then((d) => d.epics), [token]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');

  const shown = useMemo(() => (epics ?? []).filter((e) => filter === 'all' || e.health === filter), [epics, filter]);

  if (id) return <EpicDetail key={id} token={token} user={user} id={id} />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{manager ? 'Epics' : 'My epics'}</h1>
          <p className="muted">{manager ? 'Every epic, who is on it, and whether it will make its deadline.' : 'The epics you are working on. Move the slider to report progress.'}</p>
        </div>
        {manager && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New epic
          </button>
        )}
      </div>

      {epics === null ? (
        <Skeleton height={240} />
      ) : epics.length === 0 ? (
        <div className="card">
          <Empty
            title={manager ? 'No epics yet' : 'You are not on any epic yet'}
            action={
              manager && (
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                  Create the first epic
                </button>
              )
            }
          >
            {manager ? 'Create an epic, set its deadline and add the people working on it.' : 'Your manager adds you to epics. They show up here.'}
          </Empty>
        </div>
      ) : manager ? (
        <section className="card card-flush">
          <div className="card-head padded">
            <div className="tabs" role="tablist">
              {[
                ['all', 'All'],
                ['on_track', 'On track'],
                ['at_risk', 'At risk'],
                ['overdue', 'Overdue'],
                ['done', 'Done'],
              ].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                  {label}
                  <span className="tab-count">{key === 'all' ? epics.length : epics.filter((e) => e.health === key).length}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? <p className="muted padded">Nothing here.</p> : <EpicTable epics={shown} />}
        </section>
      ) : (
        <div className="card-grid">
          {epics.map((e) => (
            <EpicCard key={e.id} token={token} epic={e} onSaved={reload} />
          ))}
        </div>
      )}

      {creating && (
        <EpicForm
          token={token}
          onClose={() => setCreating(false)}
          onSaved={(epic) => {
            setCreating(false);
            reload();
            navigate(`/epics/${epic.id}`);
          }}
        />
      )}
    </div>
  );
}
