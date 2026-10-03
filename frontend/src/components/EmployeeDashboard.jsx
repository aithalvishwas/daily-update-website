import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { daysBetween, localToday } from '../format.js';
import { useToast } from './Toast.jsx';
import LogCard from './LogCard.jsx';
import StatCard from './StatCard.jsx';

// Consecutive days with an entry, counting back from today (or yesterday if today is empty).
function streak(logs, today) {
  const dates = new Set(logs.map((l) => l.workDate));
  let count = 0;
  const d = new Date(`${today}T00:00:00`);
  if (!dates.has(today)) d.setDate(d.getDate() - 1);
  while (dates.has(d.toLocaleDateString('en-CA'))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export default function EmployeeDashboard({ token, user }) {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = localToday();
  const [form, setForm] = useState({ workDate: today, tasks: '', hours: '', blockers: '' });

  const load = useCallback(async () => {
    try {
      const data = await api('/api/logs/me', { token });
      setLogs(data.logs);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Picking a date that already has an entry pre-fills it; picking a new date starts empty.
  const lastDate = useRef(form.workDate);
  useEffect(() => {
    const existing = logs.find((l) => l.workDate === form.workDate);
    const dateChanged = lastDate.current !== form.workDate;
    lastDate.current = form.workDate;
    if (existing) {
      setForm((f) => ({ ...f, tasks: existing.tasks, hours: existing.hours ?? '', blockers: existing.blockers ?? '' }));
    } else if (dateChanged) {
      setForm((f) => ({ ...f, tasks: '', hours: '', blockers: '' }));
    }
  }, [form.workDate, logs]);

  const stats = useMemo(() => {
    const week = logs.filter((l) => daysBetween(l.workDate, today) < 7);
    const hours = week.reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
    return {
      streak: streak(logs, today),
      weekDays: week.length,
      weekHours: Math.round(hours * 10) / 10,
      loggedToday: logs.some((l) => l.workDate === today),
    };
  }, [logs, today]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/logs', {
        method: 'POST',
        token,
        body: { ...form, hours: form.hours === '' ? null : Number(form.hours) },
      });
      toast('Update saved', 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(log) {
    if (!window.confirm(`Delete your update for ${log.workDate}?`)) return;
    try {
      await api(`/api/logs/${log.id}`, { method: 'DELETE', token });
      if (log.workDate === form.workDate) setForm((f) => ({ ...f, tasks: '', hours: '', blockers: '' }));
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const editing = logs.some((l) => l.workDate === form.workDate);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">{stats.loggedToday ? 'You have logged today. Nice work!' : "What did you get done today?"}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Current streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} accent="violet" />
        <StatCard label="Days logged this week" value={`${stats.weekDays}/7`} accent="cyan" />
        <StatCard label="Hours this week" value={stats.weekHours} accent="pink" />
      </div>

      <div className="grid-2">
        <form className="glass card form" onSubmit={save}>
          <div className="card-head">
            <h2>{editing ? 'Edit update' : "Log today's work"}</h2>
            {editing && <span className="chip chip-accent">Editing saved entry</span>}
          </div>
          <label>
            Date
            <input type="date" value={form.workDate} max={today} onChange={update('workDate')} required />
          </label>
          <label>
            What did you work on?
            <textarea
              rows={7}
              maxLength={5000}
              value={form.tasks}
              onChange={update('tasks')}
              placeholder={'- Fixed the login bug\n- Reviewed 2 pull requests\n- Met with the design team'}
              required
            />
          </label>
          <div className="form-row">
            <label>
              <span>Hours <span className="optional">optional</span></span>
              <input type="number" min="0" max="24" step="0.5" value={form.hours} onChange={update('hours')} />
            </label>
            <label className="grow">
              <span>Blockers <span className="optional">optional</span></span>
              <input maxLength={5000} value={form.blockers} onChange={update('blockers')} placeholder="Anything slowing you down?" />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update entry' : 'Save update'}
          </button>
        </form>

        <div className="glass card">
          <div className="card-head">
            <h2>My recent updates</h2>
            <span className="muted small">Last 30 days</span>
          </div>
          {loading ? (
            <div className="skeleton-list" />
          ) : logs.length === 0 ? (
            <p className="empty">No updates yet. Your first one shows up here.</p>
          ) : (
            <ul className="log-list">
              {logs.map((log) => (
                <LogCard key={log.id} log={log} onDelete={remove} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
