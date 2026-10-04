import { useState } from 'react';
import { api } from '../api.js';
import { daysBetween, formatDate, isManager, localToday } from '../format.js';
import { useLoad } from '../hooks.js';
import { DatePicker } from './Calendar.jsx';
import Icon from './Icon.jsx';
import { useToast } from './Toast.jsx';
import { Skeleton } from './ui.jsx';

/** Dated checkpoints inside an epic. Managers add them; anyone on the epic can tick one off. */
export default function Milestones({ token, user, epic }) {
  const toast = useToast();
  const manager = isManager(user);
  const canTick = manager || epic.members.some((m) => m.userId === user.id);
  const [milestones, reload] = useLoad(() => api(`/api/epics/${epic.id}/milestones`, { token }).then((d) => d.milestones), [epic.id, token]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const today = localToday();

  async function add(e) {
    e.preventDefault();
    if (!dueDate) return toast('Pick a date for the milestone', 'error');
    try {
      await api(`/api/epics/${epic.id}/milestones`, { method: 'POST', token, body: { name, dueDate } });
      setName('');
      setDueDate('');
      setAdding(false);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggle(m) {
    try {
      await api(`/api/epics/${epic.id}/milestones/${m.id}`, { method: 'PATCH', token, body: { done: !m.done } });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove(m) {
    if (!window.confirm(`Delete the milestone "${m.name}"?`)) return;
    try {
      await api(`/api/epics/${epic.id}/milestones/${m.id}`, { method: 'DELETE', token });
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Milestones</h2>
        {manager && !adding && (
          <button type="button" className="link-btn small" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Add
          </button>
        )}
      </div>
      {milestones === null ? (
        <Skeleton height={60} />
      ) : (
        <ul className="milestones">
          {milestones.map((m) => {
            const days = daysBetween(today, m.dueDate);
            const late = !m.done && days < 0;
            return (
              <li key={m.id} className={m.done ? 'done' : ''}>
                <label className="milestone-check">
                  <input type="checkbox" checked={m.done} disabled={!canTick} onChange={() => toggle(m)} aria-label={`Mark ${m.name} done`} />
                  <span className="milestone-flag" aria-hidden="true">
                    <Icon name="flag" size={14} />
                  </span>
                  <span>
                    <strong>{m.name}</strong>
                    <span className={`small ${late ? 'text-red' : 'muted'}`}>
                      {formatDate(m.dueDate, { month: 'short', day: 'numeric' })}
                      {m.done ? ' · reached' : late ? ` · ${-days} day${days === -1 ? '' : 's'} late` : days === 0 ? ' · today' : ` · in ${days} day${days === 1 ? '' : 's'}`}
                    </span>
                  </span>
                </label>
                {manager && (
                  <button type="button" className="icon-btn small-icon" onClick={() => remove(m)} aria-label={`Delete ${m.name}`}>
                    ✕
                  </button>
                )}
              </li>
            );
          })}
          {milestones.length === 0 && !adding && <p className="muted small">{manager ? 'Add checkpoints such as "Design approved" or "Beta release".' : 'No milestones yet.'}</p>}
        </ul>
      )}
      {adding && (
        <form className="form milestone-form" onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required placeholder="e.g. Beta release" aria-label="Milestone name" autoFocus />
          <DatePicker label="Date" value={dueDate} onChange={setDueDate} min={epic.startDate} />
          <div className="form-actions">
            <button type="button" className="btn btn-light btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Add milestone
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
