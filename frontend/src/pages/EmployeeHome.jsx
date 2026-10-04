import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatDate, localToday } from '../format.js';
import { announceChange, useLoad } from '../hooks.js';
import { AttachmentIds, AttachmentPicker } from '../components/Attachments.jsx';
import { Calendar, DatePicker } from '../components/Calendar.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, Skeleton, Stat } from '../components/ui.jsx';
import { EpicCard } from './Epics.jsx';
import { RaiseIssue } from './Issues.jsx';
import { useWorkCalendar, useWorkplace } from '../workplace.js';

const EMPTY = { tasks: '', hours: '', blockers: '', epicId: '' };

export default function EmployeeHome({ token, user }) {
  const toast = useToast();
  const today = localToday();
  const [logs, reloadLogs] = useLoad(() => api('/api/logs/me', { token }).then((d) => d.logs), [token]);
  const [epics, reloadEpics] = useLoad(() => api('/api/epics', { token }).then((d) => d.epics), [token]);
  const [issues] = useLoad(() => api('/api/issues?status=open', { token }).then((d) => d.issues), [token]);
  const work = useWorkCalendar();
  const { weekendRequests } = useWorkplace();
  const [date, setDate] = useState(work.isWeekendOff(today) ? work.weekDays(today)[4] : today);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [raising, setRaising] = useState(false);

  // Picking a date that already has an entry fills the form; a new date starts empty.
  const loadedFor = useRef(null);
  useEffect(() => {
    if (!logs || loadedFor.current === date) return;
    loadedFor.current = date;
    const existing = logs.find((l) => l.workDate === date);
    if (existing) {
      setForm({ tasks: existing.tasks, hours: existing.hours ?? '', blockers: existing.blockers ?? '', epicId: existing.epicId ?? '' });
      setFiles([]);
      if (existing.attachmentIds.length) {
        api(`/api/attachments?ids=${existing.attachmentIds.join(',')}`, { token })
          .then((d) => setFiles(d.attachments))
          .catch(() => {});
      }
    } else {
      setForm(EMPTY);
      setFiles([]);
    }
  }, [date, logs, token]);

  const week = work.weekDays(today);
  const workdays = work.workdays(today);
  const marks = useMemo(() => Object.fromEntries((logs ?? []).map((l) => [l.workDate, 'logged'])), [logs]);
  const stats = useMemo(() => {
    const inWeek = (logs ?? []).filter((l) => week.includes(l.workDate));
    return {
      days: inWeek.filter((l) => workdays.includes(l.workDate)).length,
      hours: Math.round(inWeek.reduce((s, l) => s + (Number(l.hours) || 0), 0) * 10) / 10,
    };
  }, [logs, week, workdays]);
  const holidayToday = work.holiday(today);
  const upcoming = work.upcoming(today);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const editing = (logs ?? []).some((l) => l.workDate === date);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/logs', {
        method: 'POST',
        token,
        body: {
          workDate: date,
          tasks: form.tasks,
          hours: form.hours === '' ? null : Number(form.hours),
          blockers: form.blockers,
          epicId: form.epicId ? Number(form.epicId) : null,
          attachmentIds: files.map((f) => f.id),
        },
      });
      toast(form.blockers.trim() ? 'Saved. Your manager has been alerted about the blocker.' : 'Update saved', 'success');
      loadedFor.current = null;
      await reloadLogs();
      if (form.blockers.trim()) announceChange();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(log) {
    if (!window.confirm(`Delete your update for ${formatDate(log.workDate)}?`)) return;
    try {
      await api(`/api/logs/${log.id}`, { method: 'DELETE', token });
      loadedFor.current = null;
      await reloadLogs();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const loggedToday = (logs ?? []).some((l) => l.workDate === today);
  const activeEpics = (epics ?? []).filter((e) => e.health !== 'done');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">
            {holidayToday
              ? `Today is ${holidayToday}, a holiday at your office. Enjoy the day off!`
              : work.isWeekendOff(today)
              ? "It's the weekend. If you worked today, you can ask for a comp-off day or overtime pay."
              : loggedToday
                ? "Today's update is in. Nice work!"
                : 'What did you get done today?'}
          </p>
        </div>
        <button type="button" className="btn btn-light" onClick={() => setRaising(true)}>
          <Icon name="alert" size={16} /> Raise an issue
        </button>
      </div>

      <div className="stats-row">
        <Stat label="Workdays logged this week" value={`${stats.days}/${workdays.length}`} tone="blue" icon={<Icon name="calendar" />} />
        <Stat label="Hours this week" value={stats.hours} tone="green" icon={<Icon name="clock" />} />
        <Stat label="My active epics" value={epics ? activeEpics.length : '–'} tone="purple" icon={<Icon name="epics" />} />
        <Stat label="My open issues" value={issues ? issues.length : '–'} tone="red" icon={<Icon name="alert" />} />
      </div>

      <div className="grid-main-side">
        <form className="card form" onSubmit={save}>
          <div className="card-head">
            <h2>{editing ? 'Edit your update' : 'Daily update'}</h2>
            {editing && <Badge tone="blue">Editing saved entry</Badge>}
          </div>
          <div className="form-grid">
            <DatePicker label="Date" value={date} onChange={setDate} max={today} marks={marks} />
            <label>
              <span>
                Epic <span className="optional">optional</span>
              </span>
              <select value={form.epicId} onChange={set('epicId')}>
                <option value="">General work</option>
                {(epics ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {work.holiday(date) ? (
            <p className="callout">
              {formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })} is {work.holiday(date)}, a holiday at your office.
            </p>
          ) : (
            work.isWeekendOff(date) && (
              <p className="callout">
                {formatDate(date, { weekday: 'long' })} is outside the Mon–Fri work week.{' '}
                {weekendRequests && <a href={`#/requests?date=${date}`}>Request a comp-off day or overtime pay</a>}
              </p>
            )
          )}
          <label>
            What did you work on?
            <textarea rows={6} maxLength={5000} value={form.tasks} onChange={set('tasks')} placeholder={'- Finished the cart page\n- Reviewed 2 pull requests\n- Met with design'} required />
          </label>
          <div className="form-grid">
            <label>
              <span>
                Hours <span className="optional">optional</span>
              </span>
              <input type="number" min="0" max="24" step="0.5" value={form.hours} onChange={set('hours')} />
            </label>
            <label className="span-2">
              <span>
                Blockers <span className="optional">alerts your manager</span>
              </span>
              <input maxLength={5000} value={form.blockers} onChange={set('blockers')} placeholder="Anything stopping you?" />
            </label>
          </div>
          <AttachmentPicker token={token} value={files} onChange={setFiles} />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update entry' : 'Save update'}
          </button>
        </form>

        <div className="stack">
          <section className="card">
            <h2 className="card-title">This week</h2>
            <ul className="week-strip" style={{ '--days': week.length }}>
              {week.map((d) => {
                const done = Boolean(marks[d]);
                const holiday = work.holiday(d);
                return (
                  <li key={d}>
                    <button
                      type="button"
                      className={`week-day ${done ? 'done' : holiday ? 'holiday' : ''} ${d === date ? 'selected' : ''}`}
                      onClick={() => setDate(d)}
                      disabled={d > today}
                      title={holiday ?? undefined}
                    >
                      <span>{formatDate(d, { weekday: 'short' })}</span>
                      <strong>{done ? '✓' : formatDate(d, { day: 'numeric' })}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="card">
            <h2 className="card-title">Calendar</h2>
            <Calendar value={date} onChange={setDate} max={today} marks={marks} />
            <p className="muted small calendar-legend">
              <span className="legend-dot" /> update saved <span className="legend-holiday" /> holiday
              {work.weekendsOff && ' · weekends shaded'}
            </p>
            {!user.office && (
              <p className="muted small">
                Pick your office in <a href="#/settings">your settings</a> to see your local holidays.
              </p>
            )}
          </section>
          {upcoming.length > 0 && (
            <section className="card">
              <h2 className="card-title">Upcoming holidays{user.office ? ` · ${user.office}` : ''}</h2>
              <ul className="holiday-list">
                {upcoming.map((h) => (
                  <li key={h.date} className="holiday-item">
                    <span className="holiday-date">
                      <strong>{formatDate(h.date, { day: 'numeric' })}</strong>
                      <span>{formatDate(h.date, { month: 'short' })}</span>
                    </span>
                    <span>
                      <strong>{h.name}</strong>
                      <br />
                      <span className="muted small">{formatDate(h.date, { weekday: 'long' })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className="stack">
        <div className="section-head">
          <h2>My epics</h2>
          <a href="#/epics" className="small">
            View all
          </a>
        </div>
        {epics === null ? (
          <Skeleton />
        ) : activeEpics.length === 0 ? (
          <div className="card">
            <Empty title="No active epics">Your manager adds you to epics. They show up here with their deadlines.</Empty>
          </div>
        ) : (
          <div className="card-grid">
            {activeEpics.map((e) => (
              <EpicCard key={e.id} token={token} epic={e} onSaved={reloadEpics} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Recent updates</h2>
          <span className="muted small">Last 30 days</span>
        </div>
        {logs === null ? (
          <Skeleton />
        ) : logs.length === 0 ? (
          <p className="muted">No updates yet. Your first one shows up here.</p>
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
                    <span className="grow" />
                    <button
                      type="button"
                      className="btn btn-light btn-xs"
                      onClick={() => {
                        setDate(l.workDate);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="btn btn-light btn-xs" onClick={() => remove(l)}>
                      Delete
                    </button>
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

      {raising && <RaiseIssue token={token} defaultType="deadline" onClose={() => setRaising(false)} onSaved={(issue) => (window.location.hash = `/issues/${issue.id}`)} />}
    </div>
  );
}
