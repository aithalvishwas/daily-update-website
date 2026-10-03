import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDate, isWeekend, localToday, timeAgo, toIso } from '../format.js';
import { announceChange, useLoad } from '../hooks.js';
import Avatar from '../components/Avatar.jsx';
import { DatePicker } from '../components/Calendar.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { Badge, Empty, Modal, RequestStatus, Skeleton } from '../components/ui.jsx';

const COMP = { comp_off: 'Comp-off day', paid: 'Overtime pay' };

function lastWeekend(today) {
  const d = new Date(`${today}T00:00:00`);
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
  return toIso(d);
}

function minDate(today) {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - 60);
  return toIso(d);
}

function RequestForm({ token, initialDate, onSaved }) {
  const toast = useToast();
  const today = localToday();
  const [date, setDate] = useState(initialDate && isWeekend(initialDate) ? initialDate : lastWeekend(today));
  const [comp, setComp] = useState('comp_off');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      await api('/api/weekend-requests', {
        method: 'POST',
        token,
        body: { workDate: date, hours: Number(form.hours), compensation: comp, reason: form.reason },
      });
      toast('Request sent to your manager', 'success');
      e.target.reset();
      announceChange();
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div>
        <h2>Worked on a weekend?</h2>
        <p className="muted small">The work week is Monday to Friday. For a Saturday or Sunday, pick how you'd like to be compensated.</p>
      </div>
      <div className="form-grid">
        <DatePicker label="Weekend day" value={date} onChange={setDate} min={minDate(today)} max={today} disabled={(iso) => !isWeekend(iso)} />
        <label>
          Hours worked
          <input name="hours" type="number" min="0.5" max="24" step="0.5" defaultValue="4" required />
        </label>
      </div>
      <div className="choice-grid two" role="radiogroup" aria-label="Compensation">
        <button type="button" role="radio" aria-checked={comp === 'comp_off'} className={`choice ${comp === 'comp_off' ? 'active' : ''}`} onClick={() => setComp('comp_off')}>
          <strong>Comp-off</strong>
          <span className="muted small">Take a day off later</span>
        </button>
        <button type="button" role="radio" aria-checked={comp === 'paid'} className={`choice ${comp === 'paid' ? 'active' : ''}`} onClick={() => setComp('paid')}>
          <strong>Get paid</strong>
          <span className="muted small">Paid as overtime</span>
        </button>
      </div>
      <label>
        <span>
          What did you work on? <span className="optional">optional</span>
        </span>
        <textarea name="reason" rows={3} maxLength={2000} placeholder="e.g. Production release support" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}

function DecisionModal({ token, request, onClose, onSaved }) {
  const toast = useToast();
  const suggestions = [
    request.compensation === 'paid' ? 'Take a comp-off day instead of pay' : 'Get paid overtime instead of a day off',
    'Take a half day off this week',
    'Split it: half comp-off, half paid',
  ];
  const [alternative, setAlternative] = useState(suggestions[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/weekend-requests/${request.id}/decision`, { method: 'POST', token, body: { decision: 'alternative', alternative, note } });
      toast(`Suggestion sent to ${request.userName.split(' ')[0]}`, 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Suggest an alternative" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">
          {request.userName} asked for {COMP[request.compensation].toLowerCase()} for {request.hours} hours on {formatDate(request.workDate)}.
        </p>
        <div className="suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" className={`suggestion ${alternative === s ? 'active' : ''}`} onClick={() => setAlternative(s)}>
              {s}
            </button>
          ))}
        </div>
        <label>
          Your suggestion
          <textarea rows={2} value={alternative} onChange={(e) => setAlternative(e.target.value)} maxLength={2000} required />
        </label>
        <label>
          <span>
            Note <span className="optional">optional</span>
          </span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Why this works better" />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send suggestion'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequestCard({ token, request: r, manager, highlighted, onChanged, onSuggest }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function act(path, body, message) {
    setBusy(true);
    try {
      await api(`/api/weekend-requests/${r.id}/${path}`, { method: 'POST', token, body });
      toast(message, 'success');
      announceChange();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li id={`request-${r.id}`} className={`request ${highlighted ? 'highlight' : ''}`}>
      <div className="request-main">
        {manager && <Avatar name={r.userName} size={36} />}
        <div className="request-text">
          <div className="title-row">
            {manager && <strong>{r.userName}</strong>}
            <span className={manager ? 'muted' : ''}>
              {formatDate(r.workDate, { weekday: 'long', month: 'short', day: 'numeric' })} · {Number(r.hours)} h
            </span>
            <Badge tone={r.compensation === 'paid' ? 'blue' : 'purple'}>{COMP[r.compensation]}</Badge>
            <RequestStatus status={r.status} />
          </div>
          {r.reason && <p className="pre small">{r.reason}</p>}
          {r.alternative && (
            <p className="callout">
              <strong>{r.decidedBy} suggested:</strong> {r.alternative}
            </p>
          )}
          {r.managerNote && (
            <p className="muted small">
              Note from {r.decidedBy}: {r.managerNote}
            </p>
          )}
          <span className="muted small">
            Requested {timeAgo(r.createdAt)}
            {r.decidedAt && ` · decided ${timeAgo(r.decidedAt)}`}
          </span>
        </div>
      </div>
      <div className="request-actions">
        {manager && r.status === 'pending' && (
          <>
            <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => act('decision', { decision: 'approve' }, 'Approved')}>
              <Icon name="check" size={16} /> Approve
            </button>
            <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => onSuggest(r)}>
              Suggest alternative
            </button>
            <button type="button" className="btn btn-danger-light btn-sm" disabled={busy} onClick={() => act('decision', { decision: 'reject' }, 'Declined')}>
              Decline
            </button>
          </>
        )}
        {!manager && r.status === 'alternative' && (
          <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => act('accept-alternative', undefined, 'Alternative accepted')}>
            Accept suggestion
          </button>
        )}
        {!manager && (r.status === 'pending' || r.status === 'alternative') && (
          <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => act('cancel', undefined, 'Request cancelled')}>
            Cancel request
          </button>
        )}
      </div>
    </li>
  );
}

export default function Requests({ token, user, id }) {
  const manager = user.role === 'manager';
  const [requests, reload] = useLoad(() => api('/api/weekend-requests', { token }).then((d) => d.requests), [token]);
  const [tab, setTab] = useState(manager ? 'pending' : 'all');
  const [suggesting, setSuggesting] = useState(null);
  const initialDate = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('date');

  useEffect(() => {
    if (id && requests) {
      setTab('all');
      setTimeout(() => document.getElementById(`request-${id}`)?.scrollIntoView({ block: 'center' }), 50);
    }
  }, [id, requests]);

  const shown = (requests ?? []).filter((r) => tab === 'all' || r.status === tab);

  const list = (
    <section className="card card-flush">
      <div className="card-head padded">
        <h2>{manager ? 'Requests' : 'My requests'}</h2>
        {manager && (
          <div className="tabs" role="tablist">
            {[
              ['pending', 'Pending'],
              ['all', 'All'],
            ].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
                {key === 'pending' && <span className="tab-count">{(requests ?? []).filter((r) => r.status === 'pending').length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {requests === null ? (
        <Skeleton />
      ) : shown.length === 0 ? (
        <Empty title={tab === 'pending' ? 'No pending requests' : 'No requests yet'}>
          {manager ? 'Comp-off and overtime requests for weekend work show up here.' : 'Requests you send show up here with your manager’s answer.'}
        </Empty>
      ) : (
        <ul className="request-list">
          {shown.map((r) => (
            <RequestCard key={r.id} token={token} request={r} manager={manager} highlighted={String(r.id) === id} onChanged={reload} onSuggest={setSuggesting} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{manager ? 'Weekend requests' : 'Weekend work'}</h1>
          <p className="muted">
            {manager ? 'Approve comp-off or overtime pay for weekend work, or suggest something else.' : 'Ask for a comp-off day or overtime pay when you work on a Saturday or Sunday.'}
          </p>
        </div>
      </div>
      {manager ? (
        list
      ) : (
        <div className="grid-side-main">
          <RequestForm token={token} initialDate={initialDate} onSaved={reload} />
          {list}
        </div>
      )}
      {suggesting && (
        <DecisionModal
          token={token}
          request={suggesting}
          onClose={() => setSuggesting(null)}
          onSaved={() => {
            setSuggesting(null);
            reload();
            announceChange();
          }}
        />
      )}
    </div>
  );
}
