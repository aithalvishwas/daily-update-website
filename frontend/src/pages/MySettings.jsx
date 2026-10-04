import { useState } from 'react';
import { api } from '../api.js';
import { formatDate, localToday, ROLE_LABEL } from '../format.js';
import Avatar from '../components/Avatar.jsx';
import { useToast } from '../components/Toast.jsx';
import { workCalendar, useWorkplace } from '../workplace.js';

/** Your own settings. The office you pick decides which holidays you get. */
export default function MySettings({ token, user, onUserChanged }) {
  const toast = useToast();
  const workplace = useWorkplace();
  const [office, setOffice] = useState(user.office ?? '');
  const [busy, setBusy] = useState(false);
  const preview = workCalendar(workplace, office || null).upcoming(localToday(), 5);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api('/api/auth/me', { method: 'PATCH', token, body: { office } });
      onUserChanged(data.user);
      toast(office ? `Saved. You now get the ${office} holidays.` : 'Saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack narrow">
      <div className="page-head">
        <div>
          <h1>My settings</h1>
          <p className="muted">Where you work from decides your office holidays.</p>
        </div>
      </div>
      <section className="card profile-head">
        <Avatar name={user.name} size={56} />
        <div className="grow">
          <h2>{user.name}</h2>
          <p className="muted">{[user.position || ROLE_LABEL[user.role], user.team && `Team ${user.team}`, user.email].filter(Boolean).join(' · ')}</p>
        </div>
      </section>
      <form className="card form" onSubmit={save}>
        <label>
          Office location
          <select value={office} onChange={(e) => setOffice(e.target.value)}>
            <option value="">Not set (only holidays for every office)</option>
            {workplace.offices.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        {preview.length > 0 && (
          <div>
            <p className="field-label">Next holidays{office ? ` in ${office}` : ''}</p>
            <ul className="mini-list">
              {preview.map((h) => (
                <li key={h.date}>
                  <span>{h.name}</span>
                  <span className="muted small">{formatDate(h.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || office === (user.office ?? '')}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
