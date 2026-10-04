import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDate, localToday, toIso } from '../format.js';
import { useLoad } from '../hooks.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Skeleton } from '../components/ui.jsx';
import { useWorkCalendar } from '../workplace.js';

function monday(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIso(d);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

const hours = (n) => (Math.round(n * 10) / 10).toString();

function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Managers: hours logged per person per day (timesheet) and how much open work each person has. */
export default function Workload({ token }) {
  const calendar = useWorkCalendar(null);
  const [start, setStart] = useState(() => monday(localToday()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const end = days[6];
  const [entries] = useLoad(() => api(`/api/logs/timesheet?from=${start}&to=${end}`, { token }).then((d) => d.entries), [start, end, token]);
  const [people] = useLoad(() => api('/api/users', { token }).then((d) => d.users), [token]);
  const [workload] = useLoad(() => api('/api/tasks/workload', { token }).then((d) => d.workload), [token]);

  const rows = useMemo(() => {
    if (!entries || !people || !workload) return null;
    const byId = new Map();
    const row = (id, name) => {
      if (!byId.has(id)) byId.set(id, { id, name, days: {}, total: 0, epics: new Set(), load: null });
      return byId.get(id);
    };
    for (const p of people) row(p.id, p.name).position = p.position;
    for (const e of entries) {
      const r = row(e.userId, e.userName);
      const h = Number(e.hours ?? 0);
      r.days[e.workDate] = (r.days[e.workDate] ?? 0) + h;
      r.total += h;
      if (e.epicName) r.epics.add(e.epicName);
    }
    for (const w of workload) row(w.assigneeId, w.assigneeName).load = w;
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, people, workload]);

  const dayTotals = days.map((d) => (rows ?? []).reduce((sum, r) => sum + (r.days[d] ?? 0), 0));
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);
  const thisWeek = start === monday(localToday());

  function exportCsv() {
    downloadCsv(`timesheet-${start}.csv`, [
      ['Person', ...days, 'Total hours', 'Epics'],
      ...rows.map((r) => [r.name, ...days.map((d) => (r.days[d] != null ? hours(r.days[d]) : '')), hours(r.total), [...r.epics].join('; ')]),
    ]);
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Timesheets & workload</h1>
          <p className="muted">Hours from everyone's daily updates, and how much open work each person is carrying.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-light" onClick={exportCsv} disabled={!rows}>
            <Icon name="file" size={16} /> Export CSV
          </button>
        </div>
      </div>

      <section className="card card-flush">
        <div className="card-head padded">
          <h2>Timesheet</h2>
          <div className="week-nav">
            <button type="button" className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">
              <Icon name="chevronLeft" />
            </button>
            <strong>
              {formatDate(start, { month: 'short', day: 'numeric' })} – {formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}
            </strong>
            <button type="button" className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Next week" disabled={thisWeek}>
              <Icon name="chevronRight" />
            </button>
            {!thisWeek && (
              <button type="button" className="link-btn small" onClick={() => setStart(monday(localToday()))}>
                This week
              </button>
            )}
            <span className="muted small">{hours(weekTotal)} h logged</span>
          </div>
        </div>
        {rows === null ? (
          <Skeleton height={200} />
        ) : (
          <div className="table-wrap">
            <table className="table timesheet">
              <thead>
                <tr>
                  <th>Person</th>
                  {days.map((d) => (
                    <th key={d} className={`num ${calendar.isWeekendOff(d) ? 'off-day' : ''}`}>
                      {formatDate(d, { weekday: 'short' })}
                      <span className="cell-sub">{formatDate(d, { day: 'numeric', month: 'short' })}</span>
                    </th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`#/people/${r.id}`} className="person-cell">
                        <Avatar name={r.name} size={28} />
                        <span>
                          <span className="cell-title">{r.name}</span>
                          {r.position && <span className="cell-sub">{r.position}</span>}
                        </span>
                      </a>
                    </td>
                    {days.map((d) => (
                      <td key={d} className={`num ${calendar.isWeekendOff(d) ? 'off-day' : ''}`}>
                        {r.days[d] != null ? <span className={r.days[d] > 10 ? 'text-amber' : ''}>{hours(r.days[d])}</span> : <span className="muted">–</span>}
                      </td>
                    ))}
                    <td className="num">
                      <strong>{hours(r.total)}</strong>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      No one to show yet.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td>Everyone</td>
                    {dayTotals.map((t, i) => (
                      <td key={days[i]} className="num">
                        {t ? hours(t) : '–'}
                      </td>
                    ))}
                    <td className="num">
                      <strong>{hours(weekTotal)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      <section className="card card-flush">
        <div className="card-head padded">
          <h2>Workload</h2>
          <span className="muted small">Open tasks per person, from every epic's board</span>
        </div>
        {rows === null ? (
          <Skeleton height={160} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">Open</th>
                  <th className="num">In progress</th>
                  <th className="num">Overdue</th>
                  <th className="num">Due in 7 days</th>
                  <th className="num">Estimate left</th>
                  <th className="num">Done (7 days)</th>
                  <th>Load</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const w = r.load ?? { open: 0, inProgress: 0, overdue: 0, dueThisWeek: 0, doneLast7Days: 0, openEstimateHours: 0 };
                  const level = w.overdue > 0 ? ['red', 'Behind'] : w.open >= 8 ? ['amber', 'Busy'] : w.open === 0 ? ['gray', 'Free'] : ['green', 'OK'];
                  return (
                    <tr key={r.id}>
                      <td>
                        <a href={`#/people/${r.id}`} className="person-cell">
                          <Avatar name={r.name} size={28} />
                          <span className="cell-title">{r.name}</span>
                        </a>
                      </td>
                      <td className="num">{w.open}</td>
                      <td className="num">{w.inProgress}</td>
                      <td className={`num ${w.overdue ? 'text-red' : ''}`}>{w.overdue}</td>
                      <td className="num">{w.dueThisWeek}</td>
                      <td className="num">{Number(w.openEstimateHours) ? `${hours(Number(w.openEstimateHours))} h` : '–'}</td>
                      <td className="num">{w.doneLast7Days}</td>
                      <td>
                        <Badge tone={level[0]}>{level[1]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
