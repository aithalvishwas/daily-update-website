import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDate, localToday } from '../format.js';
import { DatePicker } from '../components/Calendar.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, Modal, Stat } from '../components/ui.jsx';
import { useWorkplace } from '../workplace.js';

function HolidayForm({ token, holiday, offices, onClose, onSaved }) {
  const toast = useToast();
  const [date, setDate] = useState(holiday?.date ?? localToday());
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      const body = { date, city: form.city, name: form.name };
      if (holiday) {
        await api(`/api/admin/holidays/${holiday.id}`, { method: 'PATCH', token, body });
      } else {
        await api('/api/admin/holidays', { method: 'POST', token, body });
      }
      toast(holiday ? 'Holiday saved' : `${form.name} added`, 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={holiday ? 'Edit holiday' : 'Add a holiday'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Holiday name
          <input name="name" defaultValue={holiday?.name ?? ''} maxLength={100} required placeholder="e.g. Onam" />
        </label>
        <div className="form-grid">
          <DatePicker label="Date" value={date} onChange={setDate} office={null} />
          <label>
            Office
            <select name="city" defaultValue={holiday?.city ?? ''}>
              <option value="">Every office</option>
              {offices.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : holiday ? 'Save' : 'Add holiday'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Admins: the comp-off and overtime pay feature flag, and office holidays. */
export default function WorkplaceSettings({ token }) {
  const toast = useToast();
  const workplace = useWorkplace();
  const { weekendRequests, offices, holidays, reload } = workplace;
  const thisYear = localToday().slice(0, 4);
  const years = useMemo(() => [...new Set([thisYear, ...holidays.map((h) => h.date.slice(0, 4))])].sort(), [holidays, thisYear]);
  const [year, setYear] = useState(thisYear);
  const [office, setOffice] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const shown = holidays.filter((h) => h.date.startsWith(year) && (!office || !h.city || h.city === office));
  const upcoming = holidays.filter((h) => h.date >= localToday()).length;

  async function toggleFlag() {
    setSaving(true);
    try {
      await api('/api/admin/settings', { method: 'PUT', token, body: { weekendRequests: !weekendRequests } });
      await reload();
      toast(
        weekendRequests
          ? 'Comp-off and overtime pay turned off. Every day is now a workday.'
          : 'Comp-off and overtime pay turned on. The work week is now Monday to Friday.',
        'success',
      );
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(h) {
    if (!window.confirm(`Delete ${h.name} on ${formatDate(h.date, { month: 'long', day: 'numeric', year: 'numeric' })}?`)) return;
    try {
      await api(`/api/admin/holidays/${h.id}`, { method: 'DELETE', token });
      await reload();
      toast('Holiday deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Holidays & settings</h1>
          <p className="muted">Feature flags and the office holiday calendar for India.</p>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Feature flags</h2>
        <div className="flag-row">
          <div>
            <strong>Comp-off and overtime pay</strong>
            <p className="muted small">
              {weekendRequests
                ? 'On: the work week is Monday to Friday. People can ask for a comp-off day or overtime pay for Saturday or Sunday work, and managers approve it.'
                : 'Off: all 7 days of the week are normal workdays, and there are no weekend requests. Turn it on for a Monday to Friday week with comp-off or overtime pay.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={weekendRequests}
            aria-label="Comp-off and overtime pay"
            onClick={toggleFlag}
            disabled={saving}
          />
        </div>
      </section>

      <div className="stats-row">
        <Stat label="Offices" value={offices.length} tone="blue" icon={<Icon name="people" />} />
        <Stat label={`Holidays in ${year}`} value={holidays.filter((h) => h.date.startsWith(year)).length} tone="amber" icon={<Icon name="calendar" />} />
        <Stat label="Upcoming holidays" value={upcoming} tone="green" icon={<Icon name="flag" />} />
      </div>

      <section className="card card-flush">
        <div className="card-head padded toolbar">
          <h2>Holidays</h2>
          <span className="grow" />
          <select value={office} onChange={(e) => setOffice(e.target.value)} aria-label="Office">
            <option value="">All offices</option>
            {offices.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ holiday: null })}>
            <Icon name="plus" size={16} /> Add holiday
          </button>
        </div>
        {shown.length === 0 ? (
          <Empty title={`No holidays in ${year}`}>Add the days your offices are closed.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Holiday</th>
                  <th>Office</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((h) => (
                  <tr key={h.id} className={h.date < localToday() ? 'row-muted' : undefined}>
                    <td>
                      <strong>{formatDate(h.date, { month: 'short', day: 'numeric' })}</strong>
                      <span className="cell-sub">{formatDate(h.date, { weekday: 'long' })}</span>
                    </td>
                    <td>{h.name}</td>
                    <td>{h.city ? <Badge tone="blue">{h.city}</Badge> : <Badge tone="green">Every office</Badge>}</td>
                    <td>
                      <span className="row-actions">
                        <button type="button" className="btn btn-light btn-xs" onClick={() => setModal({ holiday: h })}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-light btn-xs" onClick={() => remove(h)}>
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small padded">
          Festival dates follow the lunar calendar and change every year. Check them against your official holiday list.
        </p>
      </section>

      {modal && (
        <HolidayForm
          token={token}
          holiday={modal.holiday}
          offices={offices}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}
