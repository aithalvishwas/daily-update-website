import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { daysBetween, formatDate, localToday } from '../format.js';
import { useToast } from './Toast.jsx';
import Avatar from './Avatar.jsx';
import LogCard from './LogCard.jsx';
import StatCard from './StatCard.jsx';
import SummaryText from './SummaryText.jsx';

const ThinkingOrb = lazy(() => import('./ThinkingOrb.jsx'));

function AddUserForm({ token, onCreated, onCancel }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      await api('/api/users', { method: 'POST', token, body });
      toast(`Account created for ${body.name}`, 'success');
      onCreated();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form add-user" onSubmit={submit}>
      <label>
        Name
        <input name="name" maxLength={100} required />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <div className="form-row">
        <label className="grow">
          Team
          <input name="team" maxLength={100} />
        </label>
        <label>
          Role
          <select name="role" defaultValue="employee">
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </label>
      </div>
      <label>
        Temporary password
        <input name="password" type="password" minLength={8} maxLength={128} required />
      </label>
      <div className="form-row">
        <button className="btn btn-primary grow" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function activity(overview, today) {
  if (!overview?.lastLogDate) return { label: 'No updates yet', tone: 'idle' };
  const ago = daysBetween(overview.lastLogDate, today);
  if (ago <= 0) return { label: 'Updated today', tone: 'good' };
  if (ago === 1) return { label: 'Updated yesterday', tone: 'good' };
  if (ago <= 3) return { label: `Updated ${ago} days ago`, tone: 'warn' };
  return { label: `Last update ${formatDate(overview.lastLogDate, { month: 'short', day: 'numeric' })}`, tone: 'idle' };
}

function EmployeeDetail({ token, employee, overview }) {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState(null);
  const [days, setDays] = useState(7);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    setSummary(null);
    setLogs(null);
    Promise.all([api(`/api/summaries/${employee.id}`, { token }), api(`/api/logs/user/${employee.id}`, { token })])
      .then(([s, l]) => {
        if (!alive) return;
        setSummary(s.summary);
        setLogs(l.logs);
      })
      .catch((err) => alive && toast(err.message, 'error'));
    return () => {
      alive = false;
    };
  }, [employee.id, token, toast]);

  async function generate() {
    setGenerating(true);
    try {
      const data = await api(`/api/summaries/${employee.id}`, { method: 'POST', token, body: { days } });
      setSummary(data.summary);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  const hours = (logs ?? []).filter((l) => daysBetween(l.workDate, localToday()) < 7).reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const blockers = (logs ?? []).filter((l) => l.blockers).length;

  return (
    <div className="glass card detail">
      <div className="detail-head">
        <Avatar name={employee.name} size={56} />
        <div>
          <h2>{employee.name}</h2>
          <p className="muted">{[employee.team, employee.email].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <div className="mini-stats">
        <div>
          <span className="mini-value">{overview?.logsLast7Days ?? 0}/7</span>
          <span className="mini-label">days logged</span>
        </div>
        <div>
          <span className="mini-value">{Math.round(hours * 10) / 10}</span>
          <span className="mini-label">hours this week</span>
        </div>
        <div>
          <span className="mini-value">{blockers}</span>
          <span className="mini-label">blockers (30 days)</span>
        </div>
      </div>

      <div className="summary-card">
        <div className="card-head">
          <h3>
            <span className="sparkle" aria-hidden="true">✦</span> AI summary
          </h3>
          <div className="summary-actions">
            <div className="segmented small" role="radiogroup" aria-label="Summary period">
              {[7, 14, 30].map((d) => (
                <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                  {d}d
                </button>
              ))}
            </div>
            <button className="btn btn-primary" type="button" onClick={generate} disabled={generating}>
              {generating ? 'Summarizing…' : 'Generate'}
            </button>
          </div>
        </div>

        {generating ? (
          <div className="thinking">
            <Suspense fallback={<div className="thinking-orb" />}>
              <ThinkingOrb />
            </Suspense>
            <p className="muted">Reading {employee.name.split(' ')[0]}'s updates and writing a summary…</p>
          </div>
        ) : summary ? (
          <>
            <p className="summary-meta">
              {summary.source === 'ai' ? 'AI summary' : 'Basic summary (AI key not configured)'} of {summary.logCount} update
              {summary.logCount === 1 ? '' : 's'}, {formatDate(summary.periodFrom)} to {formatDate(summary.periodTo)} · generated{' '}
              {new Date(summary.createdAt).toLocaleString()}
            </p>
            <SummaryText text={summary.summary} />
          </>
        ) : (
          <p className="empty">No summary yet. Pick a period and press Generate to see what {employee.name.split(' ')[0]} has been working on.</p>
        )}
      </div>

      <h3 className="section-title">Daily updates · last 30 days</h3>
      {logs === null ? (
        <div className="skeleton-list" />
      ) : logs.length === 0 ? (
        <p className="empty">No updates in the last 30 days.</p>
      ) : (
        <ul className="log-list timeline">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ManagerDashboard({ token, user }) {
  const toast = useToast();
  const [employees, setEmployees] = useState(null);
  const [overview, setOverview] = useState(new Map());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const today = localToday();

  const load = useCallback(async () => {
    try {
      const [u, o] = await Promise.all([api('/api/users', { token }), api('/api/logs/overview', { token })]);
      setEmployees(u.users);
      setOverview(new Map(o.overview.map((row) => [row.userId, row])));
    } catch (err) {
      toast(err.message, 'error');
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (employees ?? []).filter((e) => [e.name, e.email, e.team ?? ''].some((v) => v.toLowerCase().includes(q)));
  }, [employees, query]);

  const teamStats = useMemo(() => {
    const list = employees ?? [];
    const activeToday = list.filter((e) => overview.get(e.id)?.lastLogDate === today).length;
    const activeWeek = list.filter((e) => (overview.get(e.id)?.logsLast7Days ?? 0) > 0).length;
    return { total: list.length, activeToday, activeWeek };
  }, [employees, overview, today]);

  const selected = employees?.find((e) => e.id === selectedId);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Team overview</h1>
          <p className="muted">Welcome back, {user.name.split(' ')[0]}. Pick someone to read their AI summary.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Employees" value={teamStats.total} accent="violet" />
        <StatCard label="Updated today" value={teamStats.activeToday} hint={`of ${teamStats.total}`} accent="cyan" />
        <StatCard label="Active this week" value={teamStats.activeWeek} hint={`of ${teamStats.total}`} accent="pink" />
      </div>

      <div className="grid-manager">
        <aside className="glass card roster">
          <div className="card-head">
            <h2>Employees</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding((a) => !a)}>
              {adding ? 'Close' : '+ Add'}
            </button>
          </div>
          {adding && (
            <AddUserForm
              token={token}
              onCancel={() => setAdding(false)}
              onCreated={() => {
                setAdding(false);
                load();
              }}
            />
          )}
          <input className="search" type="search" placeholder="Search by name, team or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search employees" />
          {employees === null ? (
            <div className="skeleton-list" />
          ) : filtered.length === 0 ? (
            <p className="empty">{query ? 'No matches.' : 'No employees yet. They appear here once they sign up.'}</p>
          ) : (
            <ul className="roster-list">
              {filtered.map((e) => {
                const act = activity(overview.get(e.id), today);
                return (
                  <li key={e.id}>
                    <button type="button" className={`roster-item ${e.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(e.id)}>
                      <Avatar name={e.name} size={38} />
                      <span className="roster-text">
                        <strong>{e.name}</strong>
                        <span className="muted small">{e.team || 'No team'}</span>
                      </span>
                      <span className={`status-dot tone-${act.tone}`} title={act.label} aria-label={act.label} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {selected ? (
          <EmployeeDetail key={selected.id} token={token} employee={selected} overview={overview.get(selected.id)} />
        ) : (
          <div className="glass card placeholder">
            <div className="placeholder-art" aria-hidden="true">✦</div>
            <h2>Select an employee</h2>
            <p className="muted">Their daily updates and AI summary will show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
